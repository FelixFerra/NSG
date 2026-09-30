-- SD Worx Data Trust — chacun peut modifier ou supprimer les infos qu'il a ajoutées.
-- À exécuter après 0005_conflict_groups.sql.

-- Uniquement ses propres infos (RLS)
create policy "authors update own infos" on public.infos
  for update to authenticated
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

create policy "authors delete own infos" on public.infos
  for delete to authenticated
  using (employee_id = public.current_employee_id());

-- Uniquement le contenu : ni le statut, ni « officiel / signé », ni l'auteur, ni les dates
revoke update on public.infos from anon, authenticated;
grant update (title, content, context_id, client_id, country, source_type, source_label, source_url, valid_until)
  on public.infos to authenticated;
revoke delete on public.infos from anon;

-- Une info modifiée redevient « fraîche » ; ses conflits sont réévalués
create or replace function public.before_info_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.content, new.context_id, new.client_id, new.country)
     is distinct from (old.content, old.context_id, old.client_id, old.country) then
    new.source_updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.after_info_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.content, new.context_id, new.client_id, new.country)
     is distinct from (old.content, old.context_id, old.client_id, old.country) then
    -- Les anciens conflits ne sont plus valables : on les clôt puis on relance la détection
    update public.conflicts
    set status = 'obsolete', resolved_at = now()
    where status = 'pending' and new.id in (original_info_id, challenger_info_id);

    update public.notifications
    set status = 'done', read_at = coalesce(read_at, now())
    where status = 'open'
      and conflict_id in (select id from public.conflicts where status <> 'pending');

    perform public.detect_info_conflicts(new.id);
  end if;
  return null;
end;
$$;

create trigger infos_before_update
  before update on public.infos
  for each row execute function public.before_info_update();

create trigger infos_after_update
  after update on public.infos
  for each row execute function public.after_info_update();

revoke all on function public.before_info_update() from public, anon, authenticated;
revoke all on function public.after_info_update()  from public, anon, authenticated;
