-- SD Worx Data Trust — boîte de réception, transferts résolubles, fiches clients
-- À exécuter après 0002_trust_workflow.sql.

-- ---------------------------------------------------------------------------
-- Boîte de réception : une notification reste « à traiter » jusqu'à ce qu'on la traite
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists status text not null default 'open'
    check (status in ('open', 'done'));

grant update (read_at, status) on public.notifications to authenticated;

-- Les notifications de conflits déjà tranchés sont traitées
update public.notifications n
set status = 'done', read_at = coalesce(n.read_at, now())
where n.conflict_id in (select id from public.conflicts where status <> 'pending');

-- ---------------------------------------------------------------------------
-- Transfert à un expert : peut porter sur un conflit précis
-- ---------------------------------------------------------------------------
drop function if exists public.request_expert_help(uuid, text, uuid, uuid);

create or replace function public.request_expert_help(
  p_expert_id uuid,
  p_message text,
  p_client_id uuid default null,
  p_context_id uuid default null,
  p_conflict_id uuid default null
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
  if p_conflict_id is not null and not exists (select 1 from public.conflicts where id = p_conflict_id) then
    raise exception 'Conflit inconnu' using errcode = '22023';
  end if;
  if (select count(*) from public.notifications
      where sender_id = me and kind = 'handoff' and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Trop de demandes, réessaie dans une minute' using errcode = '54000';
  end if;

  insert into public.notifications (recipient_id, sender_id, kind, client_id, context_id, conflict_id, message)
  values (p_expert_id, me, 'handoff', p_client_id, p_context_id, p_conflict_id, p_message);
end;
$$;

-- L'expert à qui on a transféré un conflit peut le trancher
create or replace function public.can_resolve_conflict(p_conflict_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.current_employee_id() in (c.assignee_id, o.employee_id, public.top_expert(c.context_id))
        or exists (
          select 1 from public.notifications h
          where h.kind = 'handoff' and h.conflict_id = c.id
            and h.recipient_id = public.current_employee_id()
        )
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

  update public.conflicts x
  set status = 'obsolete', resolved_at = now()
  where x.status = 'pending'
    and exists (
      select 1 from public.infos i
      where i.id in (x.original_info_id, x.challenger_info_id) and i.status <> 'active'
    );

  -- Demandes de validation et transferts liés : traités pour tout le monde
  update public.notifications n
  set status = 'done', read_at = coalesce(n.read_at, now())
  where n.status = 'open'
    and n.conflict_id in (select id from public.conflicts where status <> 'pending');

  if c.context_id is not null then
    insert into public.expertise_scores (employee_id, context_id, score)
    values (me, c.context_id, 1)
    on conflict (employee_id, context_id)
    do update set score = public.expertise_scores.score + 1, updated_at = now();
  end if;

  if v_ch.employee_id is not null and v_ch.employee_id <> me then
    select full_name into v_name from public.employees where id = me;
    insert into public.notifications (recipient_id, sender_id, kind, conflict_id, context_id, message, status)
    values (
      v_ch.employee_id, me, 'resolution', c.id, c.context_id,
      format('Ta contribution « %s » a été %s par %s.',
             v_ch.title, case when p_decision = 'accept' then 'validée' else 'rejetée' end, v_name),
      'open'
    );
  end if;

  return case when p_decision = 'accept' then 'accepted' else 'rejected' end;
end;
$$;

-- Répondre à une demande d'aide (sans conflit) : l'expert répond, le demandeur est notifié
create or replace function public.answer_handoff(p_notification_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := public.current_employee_id();
  h      public.notifications%rowtype;
  v_name text;
begin
  if me is null then
    raise exception 'Non connecté' using errcode = '42501';
  end if;
  if p_answer is null or char_length(btrim(p_answer)) = 0 or char_length(p_answer) > 2000 then
    raise exception 'Réponse invalide' using errcode = '22023';
  end if;

  select * into h from public.notifications
  where id = p_notification_id and recipient_id = me and kind = 'handoff'
  for update;
  if not found then
    raise exception 'Demande introuvable' using errcode = '22023';
  end if;

  update public.notifications set status = 'done', read_at = coalesce(read_at, now()) where id = h.id;

  if h.sender_id is not null then
    select full_name into v_name from public.employees where id = me;
    insert into public.notifications (recipient_id, sender_id, kind, client_id, context_id, message)
    values (h.sender_id, me, 'resolution', h.client_id, h.context_id,
            left(format(E'%s a répondu à ta demande :\n%s', v_name, p_answer), 2000));
  end if;

  -- Aider un collègue compte aussi dans le score d'expertise
  if h.context_id is not null then
    insert into public.expertise_scores (employee_id, context_id, score)
    values (me, h.context_id, 1)
    on conflict (employee_id, context_id)
    do update set score = public.expertise_scores.score + 1, updated_at = now();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fiches clients : création et édition par tout le personnel
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists description   text check (char_length(description) <= 4000),
  add column if not exists headcount     integer check (headcount >= 0),
  add column if not exists contact_name  text check (char_length(contact_name) <= 200),
  add column if not exists contact_email text check (char_length(contact_email) <= 200),
  add column if not exists created_by    uuid references public.employees (id) on delete set null;

create policy "staff create clients" on public.clients
  for insert to authenticated
  with check (created_by = public.current_employee_id());
create policy "staff update clients" on public.clients
  for update to authenticated using (true) with check (true);

-- Problèmes en cours d'un client
create table public.client_issues (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  context_id   uuid references public.contexts (id) on delete set null,
  title        text not null check (char_length(title) between 1 and 200),
  description  text check (char_length(description) <= 4000),
  status       text not null default 'open' check (status in ('open', 'resolved')),
  created_by   uuid references public.employees (id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index client_issues_client_idx on public.client_issues (client_id, status);

alter table public.client_issues enable row level security;

create policy "client issues readable by staff" on public.client_issues
  for select to authenticated using (true);
create policy "staff create client issues" on public.client_issues
  for insert to authenticated
  with check (created_by = public.current_employee_id());
create policy "staff update client issues" on public.client_issues
  for update to authenticated using (true) with check (true);

revoke delete on public.clients, public.client_issues from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------
revoke all on function public.request_expert_help(uuid, text, uuid, uuid, uuid) from public, anon;
revoke all on function public.answer_handoff(uuid, text)                       from public, anon;
grant execute on function public.request_expert_help(uuid, text, uuid, uuid, uuid) to authenticated;
grant execute on function public.answer_handoff(uuid, text)                       to authenticated;
