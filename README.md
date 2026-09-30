# NSG Trust

Tectonic hackathon, défi SD Worx : **« Unlock the Knowledge Within : Find it. Understand it. Trust it. »**

Une plateforme interne où chaque employé crée un compte, connecte ses outils (mails, Teams, Drive, SharePoint…) et retrouve le savoir de l'entreprise **avec un score de confiance expliqué** : source, date, propriétaire, pays, conflits détectés et expert à contacter.

## Fonctionnalités

- **Comptes employés** : inscription et connexion (Supabase Auth). Une fiche `employees` est créée automatiquement.
- **Sources connectées** : Outlook, Gmail, Teams, Slack, SharePoint, OneDrive, Google Drive, Confluence. *La connexion est simulée pour l'instant.*
- **Base de savoir** : recherche avec filtres client et sujet. Chaque info a un score de 0 à 100 décomposé en facteurs visibles :
  - fraîcheur (30) ;
  - propriétaire identifié (25) ;
  - type de source (20) ;
  - périmètre pays ou client (25) ;
  - −10 en cas de conflit avec une autre source.
- **Clients** et **Experts** : qui maintient quoi, qui contacter.

## Modèle de données

| Table | Rôle |
| --- | --- |
| `employees` | Employés (liés à `auth.users` quand ils ont un compte) |
| `clients` | Clients, avec pays et responsable |
| `contexts` | Types de problème (indexation, congés, prime…) |
| `data_sources` | Outils connectés par chaque employé |
| `infos` | Éléments de savoir. Colonnes `employee_id`, `client_id` et `context_id`, plus source, pays, dates |

Row Level Security est activé sur toutes les tables. Rien n'est lisible sans être connecté, et chaque employé ne voit et ne modifie que ses propres `data_sources`.

## Lancer le projet

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécuter `supabase/migrations/0001_init.sql` puis `supabase/seed.sql` (données de démo).
3. Pour la démo, on peut désactiver la confirmation d'e-mail : *Authentication > Providers > Email > Confirm email*.
4. Configurer l'environnement puis lancer :
   ```bash
   cp .env.example .env.local   # renseigner l'URL et la clé anon
   npm install
   npm run dev
   ```
5. Ouvrir http://localhost:3000 et créer un compte.

**Déploiement sur Vercel** : importer le repo et ajouter les deux variables `NEXT_PUBLIC_SUPABASE_*`. Dans Supabase, ajouter l'URL Vercel dans *Authentication > URL Configuration*.

## Stack

Next.js 16 (App Router, Server Actions), Tailwind CSS 4, Supabase (Postgres, Auth, RLS), lucide-react.

## Ce qui n'est pas fini

- Les connecteurs n'appellent pas encore les vraies API (Microsoft Graph, Google, Slack). Aucune donnée n'est importée depuis les outils : les infos viennent de `seed.sql`.
- La détection de conflits est heuristique : même sujet, même pays, contenu différent. Il n'y a pas encore de comparaison sémantique.
- Il n'y a pas d'assistant conversationnel ni de recherche sémantique (embeddings).
- On ne peut pas encore éditer les infos ni les profils depuis l'interface.
