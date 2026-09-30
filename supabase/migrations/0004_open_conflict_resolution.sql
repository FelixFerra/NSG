-- SD Worx Data Trust — tout employé connecté peut trancher un conflit en attente
-- (plus seulement l'auteur original, la personne assignée ou l'expert n°1).
-- À exécuter après 0003_inbox_clients.sql.

create or replace function public.can_resolve_conflict(p_conflict_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_employee_id() is not null
     and exists (
       select 1 from public.conflicts c
       where c.id = p_conflict_id and c.status = 'pending'
     )
$$;
