# Installation et démo

**Démo en ligne : [nsgtest.vercel.app](https://nsgtest.vercel.app/)** — crée un compte pour y accéder. Le scénario ci-dessous fonctionne aussi sur la démo en ligne.

## Lancer le projet

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécuter dans l'ordre :
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_trust_workflow.sql`
   3. `supabase/migrations/0003_inbox_clients.sql`
   4. `supabase/migrations/0004_open_conflict_resolution.sql`
   5. `supabase/migrations/0005_conflict_groups.sql`
   6. `supabase/migrations/0006_edit_own_infos.sql`
   7. `supabase/seed.sql` (données de démo, relançable pour remettre la démo à zéro)
3. Pour la démo, désactiver la confirmation d'e-mail : *Authentication > Sign In / Providers > Email > Confirm email*.
4. Configurer l'environnement puis lancer :
   ```bash
   cp .env.example .env.local   # URL + clé publishable/anon (jamais la clé secrète)
   npm install
   npm run dev
   ```
5. Ouvrir http://localhost:3000.

## Scénario de démo

1. Crée un compte avec `sophie.peeters@example.com`. Il est automatiquement relié à la fiche de l'experte du seed.
2. Dans **Rechercher**, choisis *Brasserie Lambert* et demande « Quel taux d'indexation appliquer en janvier ? ». Tu obtiens la réponse officielle à 2,21 % (85/100) et une alerte : 3 versions se contredisent (2,21 %, 2,0 % sur Teams, 1,79 % dans une vieille note sans auteur).
3. Clique sur **Comparer les versions** et choisis la bonne. Les autres sont archivées ou rejetées, leurs auteurs sont prévenus et ton score d'indexation augmente.
4. Pose une question sans réponse documentée (par exemple « télétravail ») : l'appli recommande des collègues à qui transférer la demande.

## Déploiement sur Vercel

1. Importer le repo (Framework Preset : Next.js).
2. Ajouter les variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. L'appli tourne à Francfort (`vercel.json`), près de la base.
4. Dans Supabase, ajouter l'URL Vercel dans *Authentication > URL Configuration*.
