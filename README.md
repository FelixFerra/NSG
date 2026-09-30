# SD Worx Data Trust

Tectonic hackathon, défi SD Worx : **« Unlock the Knowledge Within : Find it. Understand it. Trust it. »**

Un consultant paie doit répondre vite à un client. La recherche remonte plusieurs documents : un récent, un sans auteur, un pour un autre pays, et un message Teams qui dit autre chose. SD Worx Data Trust l'aide à savoir **à quelle réponse se fier, et pourquoi**.

## Fonctionnalités

- **Recherche contextuelle** : on choisit d'abord le client, qui est obligatoire, puis on pose une question en langage naturel. L'appli détecte le sujet, ne garde que les documents applicables (ceux du client et les documents généraux de son pays) et affiche une **carte de réponse directe** avec la phrase pertinente.
- **Preuves de fiabilité** : chaque réponse affiche des pastilles (source, document officiel, signé, auteur, date de mise à jour, expiré, remplacé…) et un **score de 0 à 100** détaillé facteur par facteur. Aucune boîte noire.
- **Détection des conflits** : deux infos du même sujet et du même périmètre qui donnent des chiffres différents (%, jours, €, mois) sont signalées. L'appli montre la réponse la plus probable, avec une alerte rouge qui liste la contradiction. Rien n'est masqué.
- **Vue de résolution** : un écran scindé qui compare la source A et la source B. Le point exact de désaccord est surligné (`2.21%` contre `2.0%`), avec des boutons *Valider B* / *Rejeter B* accessibles à tout employé connecté. L'auteur de l'original est notifié en priorité, et des experts sont suggérés en cas de doute.
- **Validation par les pairs** : quand quelqu'un ajoute une info qui en contredit une autre, l'**auteur de l'info d'origine** est notifié (ou l'expert référent du sujet si elle n'a pas d'auteur). Il valide ou rejette depuis la cloche de notifications, en un clic. La base se nettoie ainsi d'elle-même.
- **Graphe d'expertise** : chaque employé a un score par domaine, et chaque conflit tranché ajoute +1. Si une recherche échoue ou si un conflit reste ouvert, l'appli recommande les experts les mieux notés sur le sujet et permet de **leur transférer le contexte** (notification dans l'appli ou e-mail prérempli).
- **Boîte de réception** : chaque demande (validation, question transférée) arrive en notification. Un clic l'ouvre pour la traiter tout de suite, sinon elle reste dans la boîte de réception pour plus tard. Un expert à qui on transfère un conflit peut le trancher directement. S'il s'agit d'une simple question, il répond, et peut ajouter sa réponse à la base de savoir.
- **Profils d'experts** : on peut consulter le profil de chaque collègue (expertise par domaine, infos publiées, clients suivis, conflits tranchés) et lui poser une question.
- **Fiches clients** : on peut créer un client et remplir son profil (contact, effectif, particularités). Sa fiche liste ses problèmes en cours et n'affiche que ses documents ; les règles générales de son pays sont dans une section à part. Les conflits qui le concernent y apparaissent aussi.
- **Sources connectées** : Outlook, Gmail, Teams, Slack, SharePoint, OneDrive, Google Drive, Confluence. *La connexion est simulée.*

## Modèle de données

| Table | Rôle |
| --- | --- |
| `employees` | Employés (liés à `auth.users` quand ils ont un compte) |
| `clients` | Clients, avec pays et responsable |
| `contexts` | Types de problème, avec mots-clés pour la détection du sujet |
| `infos` | Savoir : `employee_id`, `client_id`, `context_id`, source, pays, statut officiel, signature, validité |
| `conflicts` | Paires d'infos contradictoires (original / challenger), validateur, statut |
| `notifications` | Demandes de validation, transferts à un expert, résultats |
| `expertise_scores` | Score par employé et par domaine |
| `data_sources` | Outils connectés par chaque employé |

**Sécurité** (Row Level Security partout) :
- Rien n'est lisible sans être connecté.
- Chacun ne voit que ses propres notifications et sources.
- Les conflits, scores et notifications ne s'écrivent que par des fonctions SQL qui vérifient la session : impossible, par exemple, de gonfler un score ou d'envoyer une notification au nom d'un autre.
- Une info ajoutée depuis l'appli ne peut pas s'auto-déclarer « officielle » ou « signée ». Sa date est fixée par le serveur et les ajouts sont limités en débit.

## Lancer le projet

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécuter dans l'ordre :
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/migrations/0002_trust_workflow.sql`
   3. `supabase/migrations/0003_inbox_clients.sql`
   4. `supabase/migrations/0004_open_conflict_resolution.sql`
   5. `supabase/seed.sql` (données de démo, relançable pour remettre la démo à zéro)
3. Pour la démo, désactiver la confirmation d'e-mail : *Authentication > Sign In / Providers > Email > Confirm email*.
4. Configurer l'environnement puis lancer :
   ```bash
   cp .env.example .env.local   # URL + clé publishable/anon (jamais la clé secrète)
   npm install
   npm run dev
   ```
5. Ouvrir http://localhost:3000.

**Scénario de démo**
1. Crée un compte avec `sophie.peeters@example.com`. Il est automatiquement relié à la fiche de l'experte du seed.
2. Va dans **Rechercher** et choisis *Brasserie Lambert*. Pose la question « Quel taux d'indexation appliquer en janvier ? ». Tu obtiens la réponse officielle à 2,21 %, une alerte de contradiction avec le message Teams (2,0 %) et l'ancienne note sans auteur (1,79 %).
3. Clique sur **Comparer** pour ouvrir la vue scindée, puis tranche. La cloche se vide et ton score d'indexation augmente.
4. Pose une question sans réponse documentée (ex. « télétravail ») : l'appli recommande des experts à qui transférer la demande.

**Déploiement sur Vercel** : importer le repo (Framework Preset : Next.js) et ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Dans Supabase, ajouter l'URL Vercel dans *Authentication > URL Configuration*.

## Stack

Next.js 16 (App Router, Server Actions), Tailwind CSS 4, Supabase (Postgres, Auth, RLS, fonctions PL/pgSQL), lucide-react.

## Ce qui n'est pas fini

- **Connecteurs** : ils n'appellent pas encore les vraies API (Microsoft Graph, Google, Slack). Les infos viennent du seed ou d'une saisie manuelle. Les métadonnées « officiel » et « signé » devraient être extraites à l'import.
- **Compréhension des questions** : elle repose sur des mots-clés, sans modèle de langage. L'étape suivante est une recherche sémantique (embeddings) et une réponse rédigée par un LLM, citant ses sources.
- **Détection des contradictions** : elle compare les faits chiffrés (%, jours, €, mois). Deux textes qui se contredisent sans chiffres ne sont pas détectés.
- **Notifications** : elles restent dans l'appli, sans envoi par e-mail ni dans Teams.
