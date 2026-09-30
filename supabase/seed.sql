-- Données de démo : scénario « consultant paie qui répond à un client ».
-- À exécuter après les migrations 0001 et 0002. Relançable : remet la démo à zéro
-- (les comptes utilisateurs et leurs sources connectées sont conservés).
-- Les conflits et notifications sont générés automatiquement par le trigger sur infos.

delete from public.notifications;
delete from public.conflicts;
delete from public.expertise_scores;
delete from public.infos;
delete from public.clients;
delete from public.contexts;

insert into public.contexts (id, slug, label, description, keywords) values
  ('c0000000-0000-0000-0000-000000000001', 'indexation', 'Indexation salariale', 'Règles d''indexation automatique des salaires',
   '{indexation,index,indexer,augmentation,taux,salaire,salaires,barème,lohnerhöhung}'),
  ('c0000000-0000-0000-0000-000000000002', 'conges', 'Congés & absences', 'Pécule de vacances, congés légaux, absences',
   '{congé,congés,vacances,absence,absences,jours,pécule,urlaub,holiday,leave}'),
  ('c0000000-0000-0000-0000-000000000003', 'prime-annuelle', 'Prime de fin d''année', '13e mois et primes de fin d''année',
   '{prime,primes,13e,treizième,fin,bonus,gratification}'),
  ('c0000000-0000-0000-0000-000000000004', 'fiscalite', 'Précompte & fiscalité', 'Précompte professionnel, barèmes fiscaux',
   '{précompte,fiscal,fiscalité,impôt,impôts,taxe,retenue,steuer}');

insert into public.employees (id, email, full_name, job_title, department, country) values
  ('e0000000-0000-0000-0000-000000000001', 'sophie.peeters@example.com', 'Sophie Peeters', 'Legal payroll expert',      'Legal & Compliance', 'BE'),
  ('e0000000-0000-0000-0000-000000000002', 'jonas.weber@example.com',    'Jonas Weber',    'Payroll consultant',        'Payroll Services',   'DE'),
  ('e0000000-0000-0000-0000-000000000003', 'camille.durand@example.com', 'Camille Durand', 'HR policy lead',            'HR Advisory',        'FR'),
  ('e0000000-0000-0000-0000-000000000004', 'lucas.janssens@example.com', 'Lucas Janssens', 'Senior payroll consultant', 'Payroll Services',   'BE'),
  ('e0000000-0000-0000-0000-000000000005', 'anna.schmidt@example.com',   'Anna Schmidt',   'Client service manager',    'Client Success',     'DE')
on conflict (id) do update set
  full_name = excluded.full_name, job_title = excluded.job_title,
  department = excluded.department, country = excluded.country;

insert into public.clients (id, name, country, sector, account_owner_id) values
  ('a0000000-0000-0000-0000-000000000001', 'Brasserie Lambert', 'BE', 'Horeca (CP 302)', 'e0000000-0000-0000-0000-000000000004'),
  ('a0000000-0000-0000-0000-000000000002', 'Nordwind GmbH',     'DE', 'Logistique',      'e0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000003', 'Café Lumière',      'FR', 'Restauration',    'e0000000-0000-0000-0000-000000000003');

-- Graphe d'expertise (avant les infos : sert à choisir le validateur des infos sans auteur)
insert into public.expertise_scores (employee_id, context_id, score) values
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 12),
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 8),
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 6),
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 9),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 10),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 4),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 7),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 6),
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 3);

insert into public.infos (title, content, source_type, source_label, employee_id, client_id, context_id, country, status, is_official, is_signed, valid_until, source_updated_at) values
  ('Indexation CP 302 — janvier 2026',
   'Les salaires de la CP 302 sont indexés de 2,21 % au 1er janvier 2026. Appliquer l''indexation sur les barèmes minimums et les salaires réels.',
   'sharepoint', 'Legal Updates / BE / Indexations 2026.docx',
   'e0000000-0000-0000-0000-000000000001', null, 'c0000000-0000-0000-0000-000000000001', 'BE', 'active', true, true, '2026-12-31', now() - interval '20 days'),

  ('Indexation CP 302 (ancienne note)',
   'Indexation de 1,79 % au 1er janvier. Voir tableau joint.',
   'onedrive', 'Divers/indexation_302_v2_FINAL.xlsx',
   null, null, 'c0000000-0000-0000-0000-000000000001', 'BE', 'active', false, false, null, now() - interval '400 days'),

  ('Indexation des salaires — France',
   'Il n''existe pas d''indexation automatique des salaires en France (hors SMIC). Les augmentations passent par les NAO.',
   'confluence', 'HR Knowledge / FR / Rémunération',
   'e0000000-0000-0000-0000-000000000003', null, 'c0000000-0000-0000-0000-000000000001', 'FR', 'active', true, false, null, now() - interval '60 days'),

  ('Re: indexation Brasserie Lambert',
   'Attention, pour Brasserie Lambert on applique 2,0 % d''indexation cette année, le client a un accord d''entreprise spécifique.',
   'teams', 'Canal Payroll BE — #clients-horeca',
   'e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'BE', 'active', false, false, null, now() - interval '5 days'),

  ('Prime de fin d''année CP 302',
   'La prime de fin d''année est égale à un salaire mensuel brut, payée en décembre, au prorata des prestations.',
   'sharepoint', 'Legal Updates / BE / Primes.docx',
   'e0000000-0000-0000-0000-000000000001', null, 'c0000000-0000-0000-0000-000000000003', 'BE', 'active', true, false, null, now() - interval '150 days'),

  ('Urlaubsanspruch Nordwind GmbH',
   'Nordwind accorde 28 jours de congés par an (minimum légal : 20 jours sur 5 jours/semaine).',
   'outlook', 'Mail de HR Nordwind — 12/03',
   'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'DE', 'active', false, true, null, now() - interval '200 days'),

  ('Nordwind : nouveaux congés',
   'Depuis le nouvel accord, Nordwind donne 30 jours de congés par an à tous les salariés.',
   'teams', 'Chat avec le RH de Nordwind',
   'e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'DE', 'active', false, false, null, now() - interval '10 days'),

  ('Congés payés — acquisition',
   'Les salariés acquièrent 2,5 jours ouvrables de congés par mois de travail effectif.',
   'confluence', 'HR Knowledge / FR / Congés',
   'e0000000-0000-0000-0000-000000000003', null, 'c0000000-0000-0000-0000-000000000002', 'FR', 'active', true, false, null, now() - interval '30 days'),

  ('Barème précompte 2025',
   'Barème du précompte professionnel applicable aux revenus 2025.',
   'google_drive', 'Payroll BE / Fiscal / bareme_2025.pdf',
   'e0000000-0000-0000-0000-000000000004', null, 'c0000000-0000-0000-0000-000000000004', 'BE', 'archived', true, true, '2025-12-31', now() - interval '300 days');
