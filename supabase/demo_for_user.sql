-- Données de démo pour UN utilisateur inscrit : il devient auteur d'infos
-- contredites par des collègues et reçoit donc des demandes de validation.
-- 1. Remplace l'e-mail ci-dessous par celui de ton compte.
-- 2. Exécute dans Supabase > SQL Editor (après seed.sql). Relançable.

do $$
declare
  v_email text := 'sophie.peeters@example.com';  -- <== e-mail du compte à préparer
  me uuid;
begin
  select id into me from public.employees where email = lower(v_email);
  if me is null then
    raise exception 'Aucun employé avec l''e-mail %. Crée d''abord ton compte dans l''appli.', v_email;
  end if;

  -- Profil
  update public.employees
  set job_title = coalesce(job_title, 'Payroll consultant'),
      department = coalesce(department, 'Payroll Services'),
      country = coalesce(country, 'BE')
  where id = me;

  update public.clients set account_owner_id = me
  where id = 'a0000000-0000-0000-0000-000000000003';  -- Café Lumière

  -- Nettoyage d'un passage précédent
  delete from public.infos where title in (
    'Congés Brasserie Lambert', 'Brasserie Lambert : congés 2026',
    '13e mois Café Lumière', 'Café Lumière : 13e mois nouvel embauché',
    'Précompte : réductions pour enfants à charge'
  );
  delete from public.notifications where recipient_id = me and kind = 'handoff';

  -- Scores d'expertise
  insert into public.expertise_scores (employee_id, context_id, score) values
    (me, 'c0000000-0000-0000-0000-000000000002', 6),
    (me, 'c0000000-0000-0000-0000-000000000003', 4)
  on conflict (employee_id, context_id) do update set score = excluded.score, updated_at = now();

  -- Tes infos (anciennes)...
  insert into public.infos (title, content, source_type, source_label, employee_id, client_id, context_id, country, status, is_official, is_signed, source_updated_at) values
    ('Congés Brasserie Lambert',
     'Brasserie Lambert applique le régime légal : 20 jours de congés par an pour un temps plein.',
     'outlook', 'Mail au client — confirmation régime congés',
     me, 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'BE', 'active', false, true, now() - interval '120 days'),
    ('13e mois Café Lumière',
     'Le 13e mois de Café Lumière est égal à 100 % du salaire mensuel, versé en décembre.',
     'confluence', 'Clients / Café Lumière / Rémunération',
     me, 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'FR', 'active', true, false, now() - interval '200 days'),
    ('Précompte : réductions pour enfants à charge',
     'Les réductions pour enfants à charge sont appliquées directement dans le calcul du précompte mensuel.',
     'sharepoint', 'Payroll BE / Fiscal / Guide précompte',
     me, null, 'c0000000-0000-0000-0000-000000000004', 'BE', 'active', true, false, now() - interval '45 days');

  -- ...contredites par des collègues (plus récentes) : le trigger crée les conflits
  -- et t'envoie les demandes de validation.
  insert into public.infos (title, content, source_type, source_label, employee_id, client_id, context_id, country, status, is_official, is_signed, source_updated_at) values
    ('Brasserie Lambert : congés 2026',
     'Suite à l''accord d''entreprise 2026, Brasserie Lambert accorde 24 jours de congés par an.',
     'teams', 'Canal Payroll BE — #clients-horeca',
     'e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'BE', 'active', false, false, now() - interval '3 days'),
    ('Café Lumière : 13e mois nouvel embauché',
     'Pour Café Lumière, le 13e mois n''est que de 50 % la première année d''ancienneté.',
     'gmail', 'Mail de la RH de Café Lumière',
     'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'FR', 'active', false, false, now() - interval '7 days');

  -- Une demande d'aide transférée par un collègue
  insert into public.notifications (recipient_id, sender_id, kind, client_id, context_id, message) values
    (me, 'e0000000-0000-0000-0000-000000000002', 'handoff',
     'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003',
     E'Question : la prime de fin d''année est-elle due en cas de départ en cours d''année ?\nClient : Café Lumière (FR)\nAucun document fiable trouvé dans la base de savoir. Peux-tu m''aider ?');
end $$;
