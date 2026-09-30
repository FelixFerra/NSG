# SD Worx Data Trust

Tectonic hackathon, défi SD Worx : **« Unlock the Knowledge Within : Find it. Understand it. Trust it. »**

Un consultant paie doit répondre vite à un client. La recherche remonte plusieurs documents : un récent, un sans auteur, un pour un autre pays, et un message Teams qui dit autre chose. SD Worx Data Trust l'aide à savoir **à quelle réponse se fier, et pourquoi**.

## Fonctionnalités

- **Recherche** : on choisit un client (facultatif) et un sujet (facultatif, sinon il est détecté), puis on pose une question en langage naturel. Chaque sujet donne une **carte de réponse directe**, avec la phrase pertinente et un **score de confiance expliqué**.
- **Preuves de fiabilité** : des pastilles indiquent la source, si le document est officiel ou signé, l'auteur, la date de mise à jour, s'il est expiré, remplacé ou rejeté.
- **Conflits groupés** : toutes les versions contradictoires d'un même sujet (par exemple 4 taux d'indexation différents pour un client) forment **un seul conflit**. On les voit côte à côte, avec les chiffres en désaccord surlignés, et on choisit **la bonne version** en un clic.
- **Validation par les pairs** : quand une nouvelle info en contredit une autre, l'auteur de l'info d'origine reçoit une demande de validation. La base se nettoie ainsi d'elle-même.
- **Boîte de réception** : elle regroupe les validations, les questions transférées par des collègues et les réponses reçues. On traite chaque demande tout de suite ou plus tard.
- **Collaborateurs** : on voit le profil de chaque collègue (score d'expertise par domaine, infos publiées, clients suivis, conflits tranchés) et on peut lui poser une question.
- **Clients** : on crée et on édite des fiches clients (profil, contact, problèmes en cours). Chaque fiche n'affiche que les documents et conflits du client ; les règles générales de son pays sont dans une section à part.
- **Documents** : un tableau de toute la base, avec le score de chaque document ; un clic sur une ligne déplie le détail. On peut ajouter une info, et **modifier ou supprimer celles dont on est l'auteur**. Une info modifiée voit ses contradictions réévaluées.
- **Mon profil** : chacun modifie son nom, son poste, son service et son pays.
- **Sources connectées** : Outlook, Gmail, Teams, Slack, SharePoint, OneDrive, Google Drive, Confluence. *La connexion est simulée.*

## Comment ça marche

### 1. Le score de confiance (0 à 100)

Chaque info reçoit un score calculé à partir de 5 facteurs. Chaque point est affiché et justifié dans l'interface (« Pourquoi ce score ? ») : aucune boîte noire. Le code est dans `src/lib/trust.ts`.

| Facteur | Max | Règle |
| --- | --- | --- |
| **Fraîcheur** | 25 | Mise à jour il y a 90 jours ou moins : **25**. Entre 91 et 365 jours : **12**. Plus d'un an : **0**. Toujours **0** si l'info est expirée (`valid_until` dépassée), archivée, remplacée ou rejetée. |
| **Auteur** | 20 | Auteur identifié : **20**. Sans auteur : **0**, car personne ne maintient l'info. |
| **Statut** | 20 | Document officiel : **+12**. Document signé : **+8**. Une info ajoutée depuis l'appli ne peut s'attribuer ni l'un ni l'autre : c'est imposé côté base. |
| **Source** | 15 | SharePoint **15**, Confluence **13**, OneDrive / Google Drive **8**, Outlook / Gmail **6**, saisie manuelle **5**, Teams / Slack **3**. Un référentiel documentaire vaut plus qu'une conversation. |
| **Périmètre** | 20 | Info propre au client recherché : **20**. Même pays que le client : **15**. Pays inconnu : **8**. Autre pays : **0**. |
| **Conflit** | −10 | Retiré si une autre source contredit l'info et que le conflit n'est pas encore tranché. |

Le score total est borné entre 0 et 100, puis converti en niveau : **Fiable** à partir de 70, **À vérifier** de 45 à 69, **Peu fiable** en dessous de 45.

*Exemple.* Pour Brasserie Lambert, la note SharePoint officielle et signée de 20 jours, écrite par une experte, valable en Belgique et contredite, obtient 25 + 20 + 20 + 15 + 15 − 10 = **85**. Le message Teams d'un collègue, propre au client, obtient 25 + 20 + 0 + 3 + 20 − 10 = **58**. La vieille note OneDrive sans auteur obtient 0 + 0 + 0 + 8 + 15 − 10 = **13**.

### 2. La recherche

Le code est dans `src/lib/search.ts`.
1. **Nettoyage de la question** : elle est mise en minuscules et débarrassée de ses accents et des mots vides (« le », « quel », « pour »…).
2. **Détection du sujet** : les mots de la question sont comparés aux mots-clés de chaque sujet, par exemple `indexation, taux, augmentation…` pour « Indexation salariale ». Le sujet qui obtient le plus de correspondances est retenu, sauf si l'utilisateur en a choisi un. Deux mots correspondent aussi si l'un commence par l'autre (4 lettres minimum) : « congé » trouve donc « congés ».
3. **Périmètre** : avec un client, on garde ses infos propres et les infos générales de son pays. Sans client, on garde toute la base. Les infos rejetées sont exclues.
4. **Pertinence** : c'est le nombre de mots de la question retrouvés dans le document, plus 2 si le document porte sur le sujet détecté.
5. **Carte de réponse** : il y en a une par sujet, 3 au maximum. La réponse principale est choisie **d'abord parmi les infos utilisables** (actives, non remplacées, non expirées), puis **par score de confiance**, puis par pertinence. On affiche la phrase du document qui contient le plus de mots de la question. Les autres sources restent visibles : rien n'est masqué.

### 3. La détection des conflits

Elle se fait en base de données. Un trigger PostgreSQL, `detect_info_conflicts`, se déclenche à chaque nouvelle info. Il y a conflit entre deux infos si :
1. elles sont **actives** toutes les deux ;
2. elles portent sur le **même sujet** ;
3. elles ont le **même périmètre** : même client, ou même pays quand l'une des deux est générale ;
4. leurs **faits chiffrés diffèrent**.

Les faits chiffrés sont extraits par une expression régulière (fonction `info_facts`) : ce sont les nombres suivis d'une unité. Par exemple « 2,21 % » donne `2.21%`, « 28 jours » donne `28j`, « 8 € » donne `8€` et « 3 mois » donne `3m`.

L'info la plus ancienne est « l'original » ; son **auteur** reçoit une demande de validation. Si elle n'a pas d'auteur, c'est l'expert n°1 du sujet qui la reçoit.

### 4. Le regroupement et la résolution des conflits

Les conflits en attente qui partagent au moins un document sont réunis en **groupe** (une composante connexe) : 4 versions d'un même taux font 1 conflit, et non 6 paires.

N'importe quel employé connecté peut trancher, en choisissant **la bonne version**. La fonction SQL `resolve_conflict_group` alors :
- garde la version choisie **active** ;
- **archive** les versions plus anciennes et les marque comme remplacées par la version choisie ;
- **rejette** les versions plus récentes ;
- clôt tous les conflits du groupe et les demandes de validation liées ;
- prévient chaque auteur que sa version a été retenue ou non ;
- ajoute **+1** au score d'expertise de la personne qui a tranché, sur ce sujet.

### 5. Prochaine étape : une détection logique des contradictions

**Ce qu'on a aujourd'hui est déjà une première version d'un raisonnement logique.** Le trigger `detect_info_conflicts` est une **règle de déni**, au sens de Datalog : « deux faits actifs, sur le même sujet et le même périmètre, avec des valeurs différentes, ne peuvent pas coexister ». Les faits sont extraits du texte par une expression régulière, qui ne capte que les nombres suivis d'une unité.

Cette version a deux limites connues :
- **Des faux positifs.** Dans « 28 jours de congés, minimum légal 20 jours sur 5 jours/semaine », la phrase contient trois chiffres qui ne portent pas sur la même chose. Pourtant, ils sont comparés comme s'ils l'étaient.
- **Des contradictions sans chiffres qu'on ne voit pas.** « Pas d'indexation automatique en France » contre « indexation de 2 % en France » n'est pas détecté.

Le problème n'est pas le raisonnement, mais **l'extraction**. Un solveur logique (SMT, Datalog, OWL) ne lit pas un mail : il raisonne sur des règles déjà structurées. On garde donc le même principe, en séparant proprement les deux étapes.

```
 Document (texte)
      │  1. EXTRACTION : LLM contraint à un schéma fixe, résultat visible et corrigeable
      ▼
 Règle structurée
   { sujet: "conges", client: "Lambert", pays: "BE",
     population: { contrat: "CDI", anciennete: [5, ∞[ },
     periode: [2026-01-01, 2026-12-31],
     attribut: "jours_conges_annuels", valeur: 24, unite: "jours" }
      │  2. RAISONNEMENT : déterministe, pas d'IA
      ▼
 Conflit si : même attribut ∧ conditions qui se chevauchent ∧ valeurs incompatibles
      │  3. EXPLICATION
      ▼
 « Pour les CDI de 5 à 8 ans d'ancienneté chez Brasserie Lambert en 2026 :
   24 jours (Teams, Lucas) contre 20 jours (Outlook, Félix) »
```

1. **Extraction structurée.** Un LLM (par exemple Claude) traduit chaque document dans un schéma fixe : sujet, périmètre, population concernée, période, attribut, valeur. Le résultat est **affiché à côté du texte et corrigeable par l'auteur**. On garde ainsi la transparence : l'IA propose, l'humain valide.
2. **Raisonnement déterministe.** Deux règles se contredisent si elles portent sur le **même attribut** (`jours_conges_annuels`, `indexation_automatique`…), si leurs **conditions se chevauchent** (intersection non vide des intervalles d'ancienneté, des périodes, des clients et des pays) et si leurs **valeurs sont incompatibles**. Pour des conditions simples, un calcul d'intersection d'intervalles suffit. Pour des conditions composées (ET/OU imbriqués, exceptions), on peut confier la vérification à un **solveur SMT comme Z3**. Son *unsat core* désigne exactement les règles qui s'excluent.
3. **Explication.** Le cas précis qui pose problème est montré à l'utilisateur : population, période, valeurs et sources. C'est l'équivalent lisible de l'unsat core.

Ce que cela apporte :
- **Plus de faux positifs** : seuls les chiffres qui portent sur le même attribut sont comparés.
- **Détection des contradictions sans chiffres** : par exemple `indexation_automatique = faux` contre `vrai`.
- **Des conflits partiels** : « 2 jours après 5 ans » et « 1 jour entre 3 et 8 ans » ne se contredisent que pour les salariés de 5 à 8 ans d'ancienneté. Le système le dit précisément au lieu de tout marquer en conflit.
- **Le reste de l'appli ne change pas** : groupes de conflits, validation par les pairs, choix de la bonne version, score d'expertise.

Les autres pistes étudiées et pourquoi on ne les retient pas en premier :

| Approche | Pour nous | Pourquoi |
| --- | --- | --- |
| **SMT (Z3)** | Oui, pour les conditions composées | Idéal pour les chevauchements de conditions et les valeurs numériques |
| **Datalog** | Oui, c'est déjà le principe | Règles d'intégrité comme « un seul statut fiscal actif par période » ; notre trigger SQL en est une version simple |
| **Tables de décision** | Utile comme représentation | Très lisible pour la paie ; la détection se fait en comparant les lignes deux à deux (Quine-McCluskey sert à simplifier, pas à détecter) |
| **Ontologie OWL** | Plus tard | Bonne pour les classifications disjointes (avantage en nature ou frais professionnel), faible sur les valeurs numériques, lourde à modéliser |

### 6. Le score d'expertise

- Chaque employé a un score **par sujet**. Trancher un conflit ou répondre à une question transférée rapporte **+1** sur le sujet concerné.
- Les niveaux sont : **Référent** à partir de 10 points, **Confirmé** à partir de 5, **Contributeur** à partir de 1.
- Quand une recherche ne trouve rien ou qu'un conflit reste ouvert, l'appli recommande les employés qui ont le meilleur score sur ce sujet ; à score égal, elle privilégie ceux du pays du client. On peut leur **transférer le contexte** en un clic : la question, le client et les versions en conflit arrivent dans leur boîte de réception.

## Modèle de données

| Table | Rôle |
| --- | --- |
| `employees` | Employés (liés à `auth.users` quand ils ont un compte) |
| `clients` | Clients : pays, secteur, responsable, contact, effectif, description |
| `client_issues` | Problèmes en cours d'un client |
| `contexts` | Sujets (types de problème), avec mots-clés pour la détection |
| `infos` | Savoir : `employee_id`, `client_id`, `context_id`, source, pays, officiel, signé, validité, statut |
| `conflicts` | Paires d'infos contradictoires, regroupées à l'affichage |
| `notifications` | Demandes de validation, questions transférées, réponses |
| `expertise_scores` | Score par employé et par sujet |
| `data_sources` | Outils connectés par chaque employé |

**Sécurité** (Row Level Security sur toutes les tables) :
- Rien n'est lisible sans être connecté.
- Chacun ne voit que ses propres notifications et sources connectées.
- Chacun ne modifie que **son** profil, et seulement son nom, son poste, son service et son pays (droits par colonne).
- Les conflits, scores et notifications ne s'écrivent que par des fonctions SQL `security definer` qui vérifient la session : impossible de gonfler un score ou d'envoyer une notification au nom d'un autre.
- Une info ajoutée depuis l'appli ne peut pas se déclarer officielle ou signée. Sa date est fixée par le serveur et les ajouts sont limités en débit, comme les transferts à un expert.
- La session est vérifiée par la signature du jeton (clés ES256). Aucune clé secrète ne figure dans le code.

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

**Scénario de démo**
1. Crée un compte avec `sophie.peeters@example.com`. Il est automatiquement relié à la fiche de l'experte du seed.
2. Dans **Rechercher**, choisis *Brasserie Lambert* et demande « Quel taux d'indexation appliquer en janvier ? ». Tu obtiens la réponse officielle à 2,21 % (85/100) et une alerte : 3 versions se contredisent (2,21 %, 2,0 % sur Teams, 1,79 % dans une vieille note sans auteur).
3. Clique sur **Comparer les versions** et choisis la bonne. Les autres sont archivées ou rejetées, leurs auteurs sont prévenus et ton score d'indexation augmente.
4. Pose une question sans réponse documentée (par exemple « télétravail ») : l'appli recommande des collègues à qui transférer la demande.

**Déploiement sur Vercel** : importer le repo (Framework Preset : Next.js) et ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`. L'appli tourne à Francfort (`vercel.json`), près de la base. Dans Supabase, ajouter l'URL Vercel dans *Authentication > URL Configuration*.

## Stack

Next.js 16 (App Router, Server Actions), Tailwind CSS 4, Supabase (Postgres, Auth, RLS, fonctions PL/pgSQL), lucide-react.

## Ce qui n'est pas fini

- **Connecteurs** : ils n'appellent pas encore les vraies API (Microsoft Graph, Google, Slack). Les infos viennent du seed ou d'une saisie manuelle. Les métadonnées « officiel » et « signé » devraient être extraites à l'import.
- **Compréhension des questions** : elle repose sur des mots-clés, sans modèle de langage. L'étape suivante est une recherche sémantique (embeddings) et une réponse rédigée par un LLM, citant ses sources.
- **Détection des contradictions** : elle ne compare que les faits chiffrés (%, jours, €, mois). Deux textes qui se contredisent sans chiffres ne sont pas détectés, et des chiffres qui ne portent pas sur la même chose peuvent créer un faux conflit. La solution (extraction structurée puis raisonnement logique sur le chevauchement des conditions) est décrite dans « Prochaine étape : une détection logique des contradictions ».
- **Notifications** : elles restent dans l'appli, sans envoi par e-mail ni dans Teams.
