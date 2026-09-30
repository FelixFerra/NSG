-- SD Worx Data Trust — conflits groupés
-- Les conflits en attente qui partagent des documents forment UN groupe
-- (ex. 4 versions du taux d'indexation d'un client). On le tranche en une fois
-- en choisissant la bonne version.
-- À exécuter après 0004_open_conflict_resolution.sql.

create or replace function public.resolve_conflict_group(p_conflict_id uuid, p_winner_info_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me          uuid := public.current_employee_id();
  v_infos     uuid[];
  v_conflicts uuid[];
  v_winner    public.infos%rowtype;
  v_context   uuid;
  v_name      text;
  r           public.infos%rowtype;
begin
  if me is null then
    raise exception 'Non connecté' using errcode = '42501';
  end if;

  -- Toutes les infos reliées par des conflits en attente (composante connexe)
  with recursive comp(info_id) as (
    select x
    from public.conflicts c
    cross join lateral unnest(array[c.original_info_id, c.challenger_info_id]) as x
    where c.id = p_conflict_id and c.status = 'pending'
    union
    select x
    from comp
    join public.conflicts c
      on c.status = 'pending' and comp.info_id in (c.original_info_id, c.challenger_info_id)
    cross join lateral unnest(array[c.original_info_id, c.challenger_info_id]) as x
  )
  select array_agg(info_id) into v_infos from comp;

  if v_infos is null then
    raise exception 'Conflit introuvable ou déjà tranché' using errcode = '22023';
  end if;
  if not (p_winner_info_id = any (v_infos)) then
    raise exception 'La version choisie ne fait pas partie de ce conflit' using errcode = '22023';
  end if;

  select array_agg(id) into v_conflicts
  from public.conflicts
  where status = 'pending'
    and (original_info_id = any (v_infos) or challenger_info_id = any (v_infos));

  select context_id into v_context from public.conflicts where id = p_conflict_id;
  select * into v_winner from public.infos where id = p_winner_info_id;
  select full_name into v_name from public.employees where id = me;

  -- Les autres versions : plus anciennes -> archivées (remplacées), plus récentes -> rejetées
  for r in select * from public.infos where id = any (v_infos) and id <> p_winner_info_id loop
    if r.source_updated_at <= v_winner.source_updated_at then
      update public.infos set status = 'archived', superseded_by = p_winner_info_id where id = r.id;
    else
      update public.infos set status = 'rejected' where id = r.id;
    end if;

    if r.employee_id is not null and r.employee_id <> me then
      insert into public.notifications (recipient_id, sender_id, kind, context_id, message)
      values (r.employee_id, me, 'resolution', v_context,
              format('Ta contribution « %s » n''a pas été retenue : %s a choisi « %s ».',
                     r.title, v_name, v_winner.title));
    end if;
  end loop;

  update public.infos set status = 'active', superseded_by = null where id = p_winner_info_id;

  update public.conflicts
  set status = case
                 when challenger_info_id = p_winner_info_id then 'accepted'
                 when original_info_id = p_winner_info_id then 'rejected'
                 else 'obsolete'
               end,
      resolved_by = me,
      resolved_at = now()
  where id = any (v_conflicts);

  -- Demandes de validation et transferts liés : traités pour tout le monde
  update public.notifications
  set status = 'done', read_at = coalesce(read_at, now())
  where status = 'open' and conflict_id = any (v_conflicts);

  if v_context is not null then
    insert into public.expertise_scores (employee_id, context_id, score)
    values (me, v_context, 1)
    on conflict (employee_id, context_id)
    do update set score = public.expertise_scores.score + 1, updated_at = now();
  end if;

  if v_winner.employee_id is not null and v_winner.employee_id <> me then
    insert into public.notifications (recipient_id, sender_id, kind, context_id, message)
    values (v_winner.employee_id, me, 'resolution', v_context,
            format('Ta contribution « %s » a été retenue par %s.', v_winner.title, v_name));
  end if;

  return cardinality(v_infos);
end;
$$;

revoke all on function public.resolve_conflict_group(uuid, uuid) from public, anon;
grant execute on function public.resolve_conflict_group(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Mon profil : chacun modifie uniquement ses champs descriptifs
-- (pas l'e-mail, ni le lien au compte ; la policy RLS limite à sa propre ligne)
-- ---------------------------------------------------------------------------
revoke update on public.employees from anon, authenticated;
grant update (full_name, job_title, department, country) on public.employees to authenticated;
