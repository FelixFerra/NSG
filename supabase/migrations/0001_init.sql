-- SD Worx Data Trust — schéma initial
-- À exécuter dans Supabase > SQL Editor (ou `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Employés : un employé peut exister sans compte (expert importé depuis
-- l'annuaire) ; il est lié à auth.users quand il crée son compte.
-- ---------------------------------------------------------------------------
create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  email         text not null unique,
  full_name     text not null,
  job_title     text,
  department    text,
  country       text check (country ~ '^[A-Z]{2}$'),
  expertise     text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clients de l'entreprise
-- ---------------------------------------------------------------------------
create table public.clients (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  country           text check (country ~ '^[A-Z]{2}$'),
  sector            text,
  account_owner_id  uuid references public.employees (id) on delete set null,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contextes = types de problème (paie, congés, indexation…)
-- ---------------------------------------------------------------------------
create table public.contexts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  label        text not null,
  description  text
);

-- ---------------------------------------------------------------------------
-- Sources de données connectées par un employé (connexion simulée pour l'instant)
-- ---------------------------------------------------------------------------
create table public.data_sources (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees (id) on delete cascade,
  provider        text not null check (provider in (
                    'outlook', 'gmail', 'teams', 'slack',
                    'sharepoint', 'onedrive', 'google_drive', 'confluence')),
  status          text not null default 'disconnected'
                    check (status in ('connected', 'disconnected', 'syncing', 'error')),
  connected_at    timestamptz,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  unique (employee_id, provider)
);

-- ---------------------------------------------------------------------------
-- Infos = éléments de savoir extraits des sources
-- ---------------------------------------------------------------------------
create table public.infos (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  content         text not null,
  source_type     text not null check (source_type in (
                    'outlook', 'gmail', 'teams', 'slack',
                    'sharepoint', 'onedrive', 'google_drive', 'confluence', 'manual')),
  source_label    text,
  source_url      text,
  employee_id     uuid references public.employees (id) on delete set null,
  client_id       uuid references public.clients (id) on delete set null,
  context_id      uuid references public.contexts (id) on delete set null,
  data_source_id  uuid references public.data_sources (id) on delete set null,
  country         text check (country ~ '^[A-Z]{2}$'),
  status          text not null default 'active'
                    check (status in ('active', 'draft', 'archived')),
  valid_until     date,
  source_updated_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index infos_employee_idx on public.infos (employee_id);
create index infos_client_idx   on public.infos (client_id);
create index infos_context_idx  on public.infos (context_id);
create index infos_country_idx  on public.infos (country);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.employees where auth_user_id = auth.uid()
$$;

-- Création / liaison de la fiche employé à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.employees (auth_user_id, email, full_name)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id
    where public.employees.auth_user_id is null;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security : rien n'est lisible sans être connecté
-- ---------------------------------------------------------------------------
alter table public.employees    enable row level security;
alter table public.clients      enable row level security;
alter table public.contexts     enable row level security;
alter table public.data_sources enable row level security;
alter table public.infos        enable row level security;

create policy "employees readable by staff" on public.employees
  for select to authenticated using (true);
create policy "employee updates own profile" on public.employees
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "clients readable by staff" on public.clients
  for select to authenticated using (true);

create policy "contexts readable by staff" on public.contexts
  for select to authenticated using (true);

create policy "infos readable by staff" on public.infos
  for select to authenticated using (true);

create policy "own data sources select" on public.data_sources
  for select to authenticated using (employee_id = public.current_employee_id());
create policy "own data sources insert" on public.data_sources
  for insert to authenticated with check (employee_id = public.current_employee_id());
create policy "own data sources update" on public.data_sources
  for update to authenticated
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());
create policy "own data sources delete" on public.data_sources
  for delete to authenticated using (employee_id = public.current_employee_id());

revoke all on function public.current_employee_id() from anon;
revoke all on function public.handle_new_user() from anon, authenticated;
