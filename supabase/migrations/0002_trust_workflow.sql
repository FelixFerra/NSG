-- NSG Trust — conflits, validation par les pairs, graphe d'expertise
-- À exécuter après 0001_init.sql, puis relancer seed.sql.

-- ---------------------------------------------------------------------------
-- Métadonnées de fiabilité
-- ---------------------------------------------------------------------------
alter table public.contexts
  add column if not exists keywords text[] not null default '{}';

alter table public.infos
  add column if not exists is_official   boolean not null default false,
  add column if not exists is_signed     boolean not null default false,
  add column if not exists superseded_by uuid references public.infos (id) on delete set null;

alter table public.infos drop constraint if exists infos_status_check;
alter table public.infos add constraint infos_status_check
  check (status in ('active', 'draft', 'archived', 'rejected'));

-- ---------------------------------------------------------------------------
-- Score de compétence par employé et par domaine
-- ---------------------------------------------------------------------------
create table public.expertise_scores (
  employee_id  uuid not null references public.employees (id) on delete cascade,
  context_id   uuid not null references public.contexts (id) on delete cascade,
  score        integer not null default 0 check (score >= 0),
  updated_at   timestamptz not null default now(),
  primary key (employee_id, context_id)
);

-- ---------------------------------------------------------------------------
-- Conflits entre deux infos (original = la plus ancienne, challenger = la nouvelle)
-- ---------------------------------------------------------------------------
create table public.conflicts (
  id                  uuid primary key default gen_random_uuid(),
  context_id          uuid references public.contexts (id) on delete set null,
  original_info_id    uuid not null references public.infos (id) on delete cascade,
  challenger_info_id  uuid not null references public.infos (id) on delete cascade,
  assignee_id         uuid references public.employees (id) on delete set null,
  status              text not null default 'pending'
                        check (status in ('pending', 'accepted', 'rejected', 'obsolete')),
  resolved_by         uuid references public.employees (id) on delete set null,
  resolved_at         timestamptz,
  created_at          timestamptz not null default now(),
  check (original_info_id <> challenger_info_id)
);

create unique index conflicts_pair_idx on public.conflicts (
  least(original_info_id, challenger_info_id),
  greatest(original_info_id, challenger_info_id)
);
create index conflicts_status_idx on public.conflicts (status);

-- ---------------------------------------------------------------------------
-- Notifications ciblées (demande de validation, transfert à un expert, résultat)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.employees (id) on delete cascade,
  sender_id     uuid references public.employees (id) on delete set null,
  kind          text not null check (kind in ('review_request', 'handoff', 'resolution')),
  conflict_id   uuid references public.conflicts (id) on delete cascade,
  client_id     uuid references public.clients (id) on delete set null,
  context_id    uuid references public.contexts (id) on delete set null,
  message       text not null check (char_length(message) <= 2000),
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, read_at);

-- ---------------------------------------------------------------------------
-- Faits chiffrés d'un texte : « 2,21 % » -> '2.21%', « 28 jours » -> '28j'.
-- Deux infos du même sujet/périmètre avec des faits différents = contradiction.
-- ---------------------------------------------------------------------------
create or replace function public.info_facts(p_text text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct f order by f), '{}')
  from (
    select replace(m[1], ',', '.') ||
           case
             when m[2] = '%' then '%'
             when lower(m[2]) in ('€', 'eur') then '€'
             when lower(m[2]) like 'mo%' then 'm'
             else 'j'
           end as f
    from regexp_matches(
      p_text,
      '(\d+(?:[.,]\d+)?)\s*(%|€|eur|jours?|days?|tage|mois|months?)',
      'gi'
    ) as m
  ) s
$$;

create or replace function public.top_expert(p_context_id uuid, p_exclude uuid default null)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select employee_id
  from public.expertise_scores
  where context_id = p_context_id
    and (p_exclude is null or employee_id <> p_exclude)
    and score > 0
  order by score desc, updated_at asc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Détection de conflits pour une info + notification de l'auteur original
-- ---------------------------------------------------------------------------
create or replace function public.detect_info_conflicts(p_info_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n            public.infos%rowtype;
  o            public.infos%rowtype;
  v_original   public.infos%rowtype;
  v_challenger public.infos%rowtype;
  v_assignee   uuid;
  v_conflict   uuid;
  v_count      integer := 0;
begin
  select * into n from public.infos where id = p_info_id;
  if not found or n.status <> 'active' or n.context_id is null
     or cardinality(public.info_facts(n.content)) = 0 then
    return 0;
  end if;

  for o in
    select * from public.infos i
    where i.id <> n.id
      and i.status = 'active'
      and i.context_id = n.context_id
      and (
        (n.client_id is not null and i.client_id = n.client_id)
        or (i.country is not distinct from n.country and (n.client_id is null or i.client_id is null))
      )
      and cardinality(public.info_facts(i.content)) > 0
      and public.info_facts(i.content) <> public.info_facts(n.content)
  loop
    if o.source_updated_at <= n.source_updated_at then
      v_original := o; v_challenger := n;
    else
      v_original := n; v_challenger := o;
    end if;

    v_assignee := coalesce(v_original.employee_id, public.top_expert(n.context_id));
    v_conflict := null;

    insert into public.conflicts (context_id, original_info_id, challenger_info_id, assignee_id)
    values (n.context_id, v_original.id, v_challenger.id, v_assignee)
    on conflict do nothing
    returning id into v_conflict;

    if v_conflict is not null then
      v_count := v_count + 1;
      if v_assignee is not null then
        insert into public.notifications (recipient_id, sender_id, kind, conflict_id, client_id, context_id, message)
        values (
          v_assignee, v_challenger.employee_id, 'review_request', v_conflict,
          coalesce(v_challenger.client_id, v_original.client_id), n.context_id,
          format('« %s » contredit « %s ». Valide ou rejette la nouvelle information.',
                 v_challenger.title, v_original.title)
        );
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.on_info_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.detect_info_conflicts(new.id);
  return null;
end;
$$;

create trigger infos_detect_conflicts
  after insert on public.infos
  for each row execute function public.on_info_inserted();

-- Une info ajoutée depuis l'appli : dates et certifications imposées côté serveur,
-- et limite anti-spam (les ajouts déclenchent des notifications).
create or replace function public.before_info_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if (select count(*) from public.infos
        where employee_id = new.employee_id and created_at > now() - interval '1 hour') >= 20 then
      raise exception 'Trop d''ajouts, réessaie plus tard.' using errcode = '54000';
    end if;
    new.source_updated_at := now();
    new.created_at := now();
    new.is_official := false;
    new.is_signed := false;
    new.superseded_by := null;
  end if;
  return new;
end;
$$;

create trigger infos_before_insert
  before insert on public.infos
  for each row execute function public.before_info_insert();

-- ---------------------------------------------------------------------------
-- Résolution d'un conflit : auteur original, personne assignée ou expert n°1
-- ---------------------------------------------------------------------------
create or replace function public.can_resolve_conflict(p_conflict_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.current_employee_id() in (c.assignee_id, o.employee_id, public.top_expert(c.context_id))
    from public.conflicts c
    join public.infos o on o.id = c.original_info_id
    where c.id = p_conflict_id and c.status = 'pending'
  ), false)
$$;

create or replace function public.resolve_conflict(p_conflict_id uuid, p_decision text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := public.current_employee_id();
  c      public.conflicts%rowtype;
  v_ch   public.infos%rowtype;
  v_name text;
begin
  if p_decision not in ('accept', 'reject') then
    raise exception 'Décision invalide' using errcode = '22023';
  end if;
  if me is null or not public.can_resolve_conflict(p_conflict_id) then
    raise exception 'Non autorisé à trancher ce conflit' using errcode = '42501';
  end if;

  select * into c from public.conflicts where id = p_conflict_id for update;
  select * into v_ch from public.infos where id = c.challenger_info_id;

  if p_decision = 'accept' then
    update public.infos set status = 'archived', superseded_by = c.challenger_info_id
    where id = c.original_info_id;
  else
    update public.infos set status = 'rejected' where id = c.challenger_info_id;
  end if;

  update public.conflicts
  set status = case when p_decision = 'accept' then 'accepted' else 'rejected' end,
      resolved_by = me,
      resolved_at = now()
  where id = c.id;

  -- Les autres conflits dont une des infos n'est plus active deviennent sans objet
  update public.conflicts x
  set status = 'obsolete', resolved_at = now()
  where x.status = 'pending'
    and exists (
      select 1 from public.infos i
      where i.id in (x.original_info_id, x.challenger_info_id) and i.status <> 'active'
    );

  update public.notifications n
  set read_at = now()
  where n.read_at is null
    and n.conflict_id in (select id from public.conflicts where status <> 'pending');

  -- Chaque résolution fait monter le score de compétence sur le domaine
  if c.context_id is not null then
    insert into public.expertise_scores (employee_id, context_id, score)
    values (me, c.context_id, 1)
    on conflict (employee_id, context_id)
    do update set score = public.expertise_scores.score + 1, updated_at = now();
  end if;

  if v_ch.employee_id is not null and v_ch.employee_id <> me then
    select full_name into v_name from public.employees where id = me;
    insert into public.notifications (recipient_id, sender_id, kind, conflict_id, context_id, message)
    values (
      v_ch.employee_id, me, 'resolution', c.id, c.context_id,
      format('Ta contribution « %s » a été %s par %s.',
             v_ch.title, case when p_decision = 'accept' then 'validée' else 'rejetée' end, v_name)
    );
  end if;

  return case when p_decision = 'accept' then 'accepted' else 'rejected' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Transfert du contexte d'une recherche à un expert
-- ---------------------------------------------------------------------------
create or replace function public.request_expert_help(
  p_expert_id uuid,
  p_message text,
  p_client_id uuid default null,
  p_context_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_employee_id();
begin
  if me is null then
    raise exception 'Non connecté' using errcode = '42501';
  end if;
  if p_expert_id = me then
    raise exception 'Tu ne peux pas te transférer une demande' using errcode = '22023';
  end if;
  if p_message is null or char_length(btrim(p_message)) = 0 or char_length(p_message) > 2000 then
    raise exception 'Message invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from public.employees where id = p_expert_id) then
    raise exception 'Expert inconnu' using errcode = '22023';
  end if;
  if (select count(*) from public.notifications
      where sender_id = me and kind = 'handoff' and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Trop de demandes, réessaie dans une minute' using errcode = '54000';
  end if;

  insert into public.notifications (recipient_id, sender_id, kind, client_id, context_id, message)
  values (p_expert_id, me, 'handoff', p_client_id, p_context_id, p_message);
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.expertise_scores enable row level security;
alter table public.conflicts        enable row level security;
alter table public.notifications    enable row level security;

create policy "expertise readable by staff" on public.expertise_scores
  for select to authenticated using (true);

create policy "conflicts readable by staff" on public.conflicts
  for select to authenticated using (true);

create policy "own notifications select" on public.notifications
  for select to authenticated using (recipient_id = public.current_employee_id());
create policy "own notifications mark read" on public.notifications
  for update to authenticated
  using (recipient_id = public.current_employee_id())
  with check (recipient_id = public.current_employee_id());

create policy "staff add own infos" on public.infos
  for insert to authenticated
  with check (
    employee_id = public.current_employee_id()
    and status = 'active'
    and (data_source_id is null or exists (
      select 1 from public.data_sources d
      where d.id = data_source_id and d.employee_id = public.current_employee_id()
    ))
  );

-- Écritures uniquement via les fonctions ci-dessus
revoke insert, update, delete on public.expertise_scores, public.conflicts from anon, authenticated;
revoke all on public.notifications from anon;
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Fonctions : exécutables uniquement par les utilisateurs connectés (ou pas du tout)
revoke all on function public.current_employee_id()                        from public, anon;
revoke all on function public.handle_new_user()                            from public, anon, authenticated;
revoke all on function public.info_facts(text)                             from public, anon;
revoke all on function public.top_expert(uuid, uuid)                       from public, anon;
revoke all on function public.detect_info_conflicts(uuid)                  from public, anon, authenticated;
revoke all on function public.on_info_inserted()                           from public, anon, authenticated;
revoke all on function public.before_info_insert()                         from public, anon, authenticated;
revoke all on function public.can_resolve_conflict(uuid)                   from public, anon;
revoke all on function public.resolve_conflict(uuid, text)                 from public, anon;
revoke all on function public.request_expert_help(uuid, text, uuid, uuid)  from public, anon;

grant execute on function public.current_employee_id()                       to authenticated;
grant execute on function public.info_facts(text)                            to authenticated;
grant execute on function public.top_expert(uuid, uuid)                      to authenticated;
grant execute on function public.can_resolve_conflict(uuid)                  to authenticated;
grant execute on function public.resolve_conflict(uuid, text)                to authenticated;
grant execute on function public.request_expert_help(uuid, text, uuid, uuid) to authenticated;
