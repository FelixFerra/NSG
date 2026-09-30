# SD Worx Data Trust

Tectonic hackathon, défi SD Worx : **« Unlock the Knowledge Within : Find it. Understand it. Trust it. »**

Un consultant doit répondre vite à un client. Sa recherche remonte plusieurs documents : une note juridique récente, un vieux fichier sans auteur, une règle valable pour un autre pays, et un message Teams qui dit autre chose. Lequel croire ?

**SD Worx Data Trust ne se contente pas de trouver l'information : il montre pourquoi on peut s'y fier ou non, signale les contradictions au lieu de les cacher, et fait trancher les humains qui savent.** Rien n'est une boîte noire : chaque point du score de confiance est expliqué à l'écran.

> **Démo en ligne : [nsgtest.vercel.app](https://nsgtest.vercel.app/)** — crée un compte pour y accéder (données de démonstration fictives).
>
> Installation, scénario de démo et déploiement : voir [INSTALLATION.md](INSTALLATION.md).

---

## 1. L'application aujourd'hui

### Les écrans

| Écran | Ce qu'on y fait |
| --- | --- |
| **Rechercher** | On choisit un client (facultatif) et un sujet (facultatif, sinon il est détecté), puis on pose une question en langage naturel. On obtient une **carte de réponse directe** par sujet : la phrase qui répond, son **score de confiance**, ses preuves de fiabilité et les autres sources du même sujet. Si des sources se contredisent, une **alerte rouge** liste chaque version et renvoie vers la comparaison. Si rien n'est trouvé ou qu'un conflit reste ouvert, l'appli propose les **collègues les plus compétents** sur ce sujet. |
| **Boîte de réception** | Une **file de travail** où tout se traite sur place, en trois sections. **Contradictions à trancher** : une carte par sujet contesté, avec chaque version sur une ligne (chiffre contesté, source, auteur, date, score) et un bouton « C'est la bonne ». **Questions de collègues** : on y répond directement, et la réponse peut enrichir la base. **Réponses et décisions** : on en prend connaissance. Un onglet *Historique* garde ce qui est traité, et un compteur dans le menu indique ce qui reste à faire. |
| **Documents** | Le tableau de toute la base : titre, sujet, périmètre, score, source, auteur, date. Un clic sur une ligne ouvre, sur toute la largeur, le contenu, les preuves et le **détail du score facteur par facteur**. On peut filtrer sur les infos actives, toutes les infos ou ses propres infos. On peut **ajouter** une info, et **modifier ou supprimer** celles dont on est l'auteur. |
| **Conflits** | Un sujet contesté par ligne, avec toutes ses versions en désaccord. La page d'un conflit montre les versions côte à côte, les chiffres en désaccord surlignés, et un bouton « Cette version est la bonne ». |
| **Clients** | La liste des clients, puis une **fiche par client** : profil (contact, effectif, particularités), **problèmes en cours**, conflits qui le concernent, **uniquement ses documents** (les règles générales de son pays sont dans une section à part). On peut créer et modifier des clients. |
| **Collaborateurs** | La liste des employés, classée par expertise. Le **profil** de chacun montre son score par sujet, ses infos publiées, ses clients et les conflits qu'il a tranchés. On peut lui poser une question. |
| **Sources connectées** | Outlook, Gmail, Teams, Slack, SharePoint, OneDrive, Google Drive, Confluence. *La connexion est simulée* (voir la partie 3). |
| **Mon profil** | Chacun modifie son nom, son poste, son service et son pays. |

### Le cycle de vie d'une information

```
 ajoutée (saisie, réponse d'expert, bientôt : import depuis les outils)
    │
    ▼
 ACTIVE ──── contredite par une autre info ───► CONFLIT (groupé par sujet)
    │                                               │  l'auteur de l'original est notifié ;
    │                                               │  n'importe quel collègue peut trancher
    │                                               ▼
    │                                  « Cette version est la bonne »
    │                                    ├─ version choisie : reste ACTIVE
    │                                    ├─ versions plus anciennes : ARCHIVÉES (remplacées)
    │                                    └─ versions plus récentes : REJETÉES
    ▼
 modifiée par son auteur ──► date remise à jour, contradictions réévaluées
```

---

## 2. Comment ça marche

### 2.1 Le score de confiance (0 à 100)

Chaque info reçoit un score calculé à partir de 5 facteurs, plus une pénalité en cas de conflit. Chaque point est affiché avec sa justification. Le code est dans `src/lib/trust.ts`.

| Facteur | Max | Règle |
| --- | --- | --- |
| **Fraîcheur** | 25 | Mise à jour il y a 90 jours ou moins : **25**. Entre 91 et 365 jours : **12**. Plus d'un an : **0**. Toujours **0** si l'info est expirée (date de validité dépassée), archivée, remplacée ou rejetée. |
| **Auteur** | 20 | Auteur identifié : **20**. Sans auteur : **0**, car personne ne maintient l'info. |
| **Statut** | 20 | Document officiel : **+12**. Document signé : **+8**. Une info ajoutée depuis l'appli ne peut s'attribuer ni l'un ni l'autre : c'est imposé par la base. |
| **Source** | 15 | SharePoint **15**, Confluence **13**, OneDrive / Google Drive **8**, Outlook / Gmail **6**, saisie manuelle **5**, Teams / Slack **3**. Un référentiel documentaire vaut plus qu'une conversation. |
| **Périmètre** | 20 | Info propre à un client : **20**. Info générale du même pays que le pays de référence : **15**. Pas de pays de référence, ou info sans pays : **8**. Autre pays : **0**. Le pays de référence est celui du client choisi dans la recherche ; dans les listes, c'est le pays de l'info elle-même. |
| **Conflit** | −10 | Retiré tant qu'une autre source contredit l'info et que le conflit n'est pas tranché. |

Le total est borné entre 0 et 100, puis converti en niveau : **Fiable** à partir de 70, **À vérifier** de 45 à 69, **Peu fiable** en dessous de 45.

*Exemple : recherche pour Brasserie Lambert (Belgique), où trois versions du taux d'indexation se contredisent.*

| Version | Fraîcheur | Auteur | Statut | Source | Périmètre | Conflit | **Score** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Note juridique SharePoint, officielle et signée, 20 jours, experte | 25 | 20 | 20 | 15 | 15 | −10 | **85 · Fiable** |
| Message Teams d'un collègue, propre au client, 5 jours | 25 | 20 | 0 | 3 | 20 | −10 | **58 · À vérifier** |
| Vieux fichier OneDrive sans auteur, 400 jours | 0 | 0 | 0 | 8 | 15 | −10 | **13 · Peu fiable** |

Le score **n'élimine rien** : les trois versions restent visibles. Il aide seulement à voir laquelle est la plus probable.

### 2.2 La recherche

Le code est dans `src/lib/search.ts`.

1. **Nettoyage de la question** : minuscules, suppression des accents et des mots vides (« le », « quel », « pour »…).
2. **Sujet** : celui que l'utilisateur a choisi, sinon celui dont les mots-clés correspondent le plus à la question. Par exemple, `indexation, taux, augmentation…` correspondent à « Indexation salariale ». Deux mots correspondent aussi si l'un commence par l'autre (4 lettres minimum) : « congé » trouve donc « congés ». **Si un sujet est trouvé, seules les infos de ce sujet sont gardées.**
3. **Périmètre** : avec un client, on garde ses infos propres et les infos générales de son pays (ou sans pays). Sans client, on garde toute la base. Les infos rejetées sont exclues.
4. **Pertinence** : le nombre de mots de la question retrouvés dans l'info, plus 2 si elle porte sur le sujet retenu.
5. **Cartes de réponse** : une par sujet, 3 au maximum. La réponse principale est choisie d'abord parmi les infos **utilisables** (actives, non remplacées, non expirées), puis par **score de confiance**, puis par pertinence. On affiche la phrase qui contient le plus de mots de la question. Toutes les autres sources du sujet restent consultables.

### 2.3 La détection des contradictions

Elle se fait **dans la base de données**, par un trigger PostgreSQL (`detect_info_conflicts`) qui se déclenche quand une info est **ajoutée** ou quand son contenu, son sujet, son client ou son pays est **modifié**.

Deux infos A et B sont en conflit si **toutes** ces conditions sont vraies :
1. A et B sont **actives** ;
2. A et B portent sur le **même sujet** ;
3. A et B ont le **même périmètre** : soit le même client, soit le même pays (deux pays vides comptent comme identiques) à condition qu'au moins l'une des deux soit générale, c'est-à-dire sans client ;
4. A et B contiennent **chacune au moins un fait chiffré** ;
5. leurs ensembles de faits chiffrés sont **différents**.

Un **fait chiffré** est un nombre suivi d'une unité, extrait par une expression régulière (`info_facts`) : « 2,21 % » donne `2.21%`, « 28 jours » donne `28j`, « 8 € » donne `8€`, « 3 mois » donne `3m`.

Quand un conflit est créé :
- l'info la plus ancienne est l'**original** ;
- son **auteur reçoit une demande de validation**, ou, si l'original n'a pas d'auteur, l'employé le plus compétent sur le sujet ;
- une même paire d'infos ne crée jamais deux conflits.

### 2.4 Regroupement et résolution

Les conflits en attente qui partagent au moins une info forment un **groupe** (une composante connexe). Quatre versions d'un même taux font donc **un seul** conflit, pas six paires. La boîte de réception, la fiche client et la recherche affichent le groupe entier.

N'importe quel employé connecté peut trancher en choisissant **la bonne version**. La fonction SQL `resolve_conflict_group` alors :
- garde la version choisie **active** ;
- **archive** les versions plus anciennes et les marque comme remplacées par la version choisie ;
- **rejette** les versions plus récentes ;
- clôt tous les conflits du groupe et les demandes liées ;
- **prévient chaque auteur** que sa version a été retenue ou non ;
- ajoute **+1** au score d'expertise de la personne qui a tranché, sur ce sujet.

### 2.5 L'expertise et l'orientation vers le bon collègue

- Chaque employé a un score **par sujet**. Trancher un conflit ou répondre à une question transférée rapporte **+1** sur ce sujet.
- Les niveaux sont **Référent** à partir de 10 points, **Confirmé** à partir de 5, **Contributeur** à partir de 1.
- Quand une recherche ne trouve rien, ou quand un conflit reste ouvert, l'appli propose les collègues qui ont le meilleur score sur le sujet ; à score égal, elle privilégie ceux du pays du client.
- Un clic **transfère le contexte** au collègue choisi : la question, le client et les versions en conflit. La demande arrive dans sa boîte de réception, où il peut répondre ou trancher directement. Un e-mail prérempli est aussi proposé.

### 2.6 Sécurité

Toutes les tables sont protégées par **Row Level Security** :
- rien n'est lisible sans être connecté ;
- chacun ne voit que ses propres notifications et sources connectées ;
- chacun ne modifie que **ses** infos et **son** profil, et seulement certains champs (droits par colonne) : impossible de se déclarer « officiel », de changer l'auteur ou les dates ;
- les conflits, les scores d'expertise et les notifications ne s'écrivent que par des **fonctions SQL** qui vérifient la session : impossible de gonfler un score ou d'envoyer une notification au nom d'un autre ;
- les ajouts d'infos (20 par heure) et les transferts à un collègue (5 par minute) sont **limités en débit** ;
- la session est vérifiée par la signature du jeton (clés ES256), et **aucune clé secrète** ne figure dans le code ;
- les en-têtes HTTP de sécurité sont activés (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).

---

## 3. La suite : de la capture à la confiance

### 3.1 Capturer l'information là où elle naît

Aujourd'hui, les infos viennent des données de démo et des saisies dans l'appli ; les connecteurs sont simulés. À terme, le savoir est capté directement dans les outils où il circule déjà : mails, Teams, SharePoint, Drive. Voici le pipeline visé.

```
 Outlook · Teams · SharePoint · Gmail · Drive · Confluence
      │ 1. CONNEXION : OAuth par employé, droits minimaux, révocable
      ▼
 Nouveaux messages et fichiers (notifications de changement + synchronisation delta)
      │ 2. FILTRAGE : ne garder que ce qui ressemble à du savoir métier
      ▼
 Candidats (un fil de mails, un message, un document)
      │ 3. PROTECTION : masquage des données personnelles
      ▼
      │ 4. EXTRACTION : règle(s) structurée(s) + métadonnées de fiabilité
      ▼
      │ 5. DÉDOUBLONNAGE et traçabilité jusqu'à la source
      ▼
 BROUILLON soumis à l'auteur ──► validé ──► ACTIVE ──► détection des contradictions (partie 3.2)
```

1. **Connexion.** Chaque employé connecte ses propres outils via OAuth : Microsoft Graph pour Outlook, Teams, SharePoint et OneDrive ; les API Google pour Gmail et Drive. On demande les **droits minimaux** en lecture seule. L'employé choisit **quels dossiers, canaux ou bibliothèques** partager. Les jetons restent chiffrés côté serveur, jamais dans le navigateur, et l'accès est révocable à tout moment. La table `data_sources` existe déjà pour cela.
2. **Collecte et filtrage.** Les nouveautés arrivent par notifications de changement (abonnements Microsoft Graph, notifications Gmail) et synchronisation incrémentale ; on ne relit pas tout à chaque fois. On ne garde que ce qui ressemble à du savoir métier : mention d'un client connu, d'un sujet de paie, d'un chiffre avec une unité, d'une pièce jointe réglementaire. Les échanges personnels sont écartés.
3. **Protection des données.** La paie est un domaine très sensible. Avant tout traitement, les données personnelles de salariés (noms, numéros de registre national, IBAN, salaires individuels) sont **masquées** : on ne conserve que la règle, jamais la fiche de paie. Chaque info garde les **droits d'accès de sa source** : un mail privé ne devient pas visible par toute l'entreprise.
4. **Extraction.** Chaque candidat est traduit en règle structurée (voir la partie 3.2), et ses **métadonnées de fiabilité** sont relevées automatiquement :
   - **auteur** = l'expéditeur ou le propriétaire du fichier ;
   - **date** = la date d'envoi ou de dernière modification ;
   - **client** = reconnu par le domaine e-mail de l'expéditeur ou le nom du dossier, comparé à l'annuaire clients ;
   - **officiel** = le document vient d'une bibliothèque déclarée officielle (par exemple « Legal Updates ») ;
   - **signé** = signature électronique détectée dans le PDF ou via l'outil de signature ;
   - **lien vers la source**, pour que chacun puisse vérifier l'original.
5. **Dédoublonnage.** Un même contenu transféré cinq fois ne crée qu'une seule info. On garde la trace de ses apparitions (empreinte du texte et similarité sémantique).
6. **Validation par l'auteur.** L'info extraite arrive en **brouillon** (le statut `draft` existe déjà) dans la boîte de réception de son auteur : « Voici ce qu'on a compris de ton mail, est-ce juste ? ». Elle ne devient active qu'après sa confirmation. Les sources informelles, comme Teams, gardent leur faible poids dans le score.

### 3.2 Savoir si deux infos se contredisent vraiment

**Ce qu'on a aujourd'hui est une première version d'un raisonnement logique.** Le trigger `detect_info_conflicts` est une **règle de déni**, au sens de Datalog : « deux faits actifs, sur le même sujet et le même périmètre, avec des valeurs différentes, ne peuvent pas coexister ». Sa limite est l'**extraction** : l'expression régulière ne voit que les nombres suivis d'une unité.
- **Faux positifs.** Dans « 28 jours de congés, minimum légal 20 jours sur 5 jours/semaine », les trois chiffres sont comparés comme s'ils portaient sur la même chose.
- **Contradictions invisibles.** « Pas d'indexation automatique en France » contre « indexation de 2 % en France » n'est pas détecté, faute de chiffre des deux côtés.

On garde le même principe, en séparant proprement **l'extraction**, qui peut s'appuyer sur l'IA, et **le raisonnement**, qui reste déterministe et vérifiable.

```
 Info (texte)
      │ 1. EXTRACTION : LLM contraint à un schéma fixe, résultat visible et corrigeable
      ▼
 Règle structurée
   { sujet: "conges", client: "Lambert", pays: "BE",
     population: { contrat: "CDI", anciennete: [5, ∞[ },
     periode: [2026-01-01, 2026-12-31],
     attribut: "jours_conges_annuels", valeur: 24, unite: "jours" }
      │ 2. CANDIDATS : même attribut, périmètres compatibles
      ▼
      │ 3. RAISONNEMENT : les conditions se chevauchent-elles ? les valeurs sont-elles compatibles ?
      ▼
      │ 4. QUALIFICATION : contradiction, évolution, précision ou doublon
      ▼
 « Pour les CDI de 5 à 8 ans d'ancienneté chez Brasserie Lambert en 2026 :
   24 jours (Teams, Lucas) contre 20 jours (Outlook, Félix) »
```

1. **Extraction structurée.** Un LLM (par exemple Claude) traduit chaque info dans un schéma fixe : sujet, périmètre (client, pays), **population concernée** (type de contrat, ancienneté, statut), **période de validité**, **attribut** et **valeur**. Le résultat est **affiché à côté du texte et corrigeable par l'auteur** : l'IA propose, l'humain valide.
2. **Recherche des candidats.** On ne compare que les règles qui portent sur le **même attribut** (`jours_conges_annuels`, `taux_indexation`, `indexation_automatique`…) avec des périmètres compatibles. La similarité sémantique (embeddings) sert à repérer deux formulations différentes d'un même attribut.
3. **Raisonnement déterministe.** Deux règles ne se contredisent que si leurs **conditions se chevauchent**, c'est-à-dire si l'intersection des populations, des périodes, des clients et des pays n'est pas vide, **et** si leurs valeurs sont incompatibles. Pour des conditions simples, un calcul d'intersection d'intervalles suffit. Pour des conditions composées (ET/OU imbriqués, exceptions), on confie la vérification à un **solveur SMT comme Z3**. Son *unsat core* désigne exactement les règles qui s'excluent : c'est une preuve, pas une estimation.
4. **Qualification.** Toute différence n'est pas une contradiction. Le système distingue :
   - une **contradiction** : mêmes conditions, valeurs incompatibles. On ouvre un conflit, comme aujourd'hui ;
   - une **évolution** : même règle, périodes successives (2025 puis 2026). La nouvelle remplace l'ancienne, sans conflit ;
   - une **précision** : une règle plus spécifique qui complète la générale, par exemple l'accord d'entreprise d'un client face à la convention collective. On garde les deux, en les reliant ;
   - un **doublon** : même règle, même valeur. On fusionne.
5. **Explication.** L'écran de résolution montre le **cas exact** en désaccord (population, période, valeurs, sources) au lieu de deux textes entiers.

Ce que cela apporte :
- **plus de faux positifs** dus à des chiffres sans rapport ;
- des **contradictions sans chiffres** détectées (`indexation_automatique = faux` contre `vrai`) ;
- des **conflits partiels** : « 2 jours après 5 ans » et « 1 jour entre 3 et 8 ans » ne se contredisent que pour 5 à 8 ans d'ancienneté, et le système le dit précisément.

**Le reste de l'appli ne change pas** : groupes de conflits, validation par les pairs, choix de la bonne version, score d'expertise.

Les autres approches étudiées :

| Approche | Pour nous | Pourquoi |
| --- | --- | --- |
| **SMT (Z3)** | Oui, pour les conditions composées | Idéal pour vérifier le chevauchement de conditions sur des valeurs numériques |
| **Datalog** | Oui, c'est déjà le principe | Règles d'intégrité comme « un seul statut fiscal actif par période » ; notre trigger SQL en est une version simple |
| **Tables de décision** | Utile comme représentation | Très lisible pour la paie ; la détection se fait en comparant les lignes deux à deux (Quine-McCluskey sert à simplifier une fonction, pas à détecter un conflit) |
| **Ontologie OWL** | Plus tard | Bonne pour les classifications exclusives (avantage en nature ou frais professionnel), faible sur les valeurs numériques, lourde à modéliser |

### 3.3 Répondre, pas seulement retrouver

La recherche actuelle repose sur des mots-clés. L'étape suivante :
- une **recherche sémantique** (embeddings), qui retrouve « préavis » quand on demande « délai de départ » ;
- une **réponse rédigée** par un LLM **uniquement à partir des infos trouvées**, chaque phrase citant sa source avec son score. S'il existe une contradiction, la réponse le dit au lieu de choisir en silence.

---

## 4. Modèle de données

| Table | Rôle |
| --- | --- |
| `employees` | Employés (liés à `auth.users` quand ils ont un compte) |
| `clients` | Clients : pays, secteur, responsable, contact, effectif, description |
| `client_issues` | Problèmes en cours d'un client |
| `contexts` | Sujets (types de problème), avec leurs mots-clés |
| `infos` | Le savoir : `employee_id` (auteur), `client_id`, `context_id`, source, pays, officiel, signé, validité, statut, remplacée par |
| `conflicts` | Paires d'infos contradictoires (original, challenger, validateur, statut), regroupées à l'affichage |
| `notifications` | Demandes de validation, questions transférées, réponses ; statut *à traiter* ou *traité* |
| `expertise_scores` | Score par employé et par sujet |
| `data_sources` | Outils connectés par chaque employé |

## 5. Stack

Next.js 16 (App Router, Server Actions), Tailwind CSS 4, Supabase (Postgres, Auth, Row Level Security, fonctions PL/pgSQL), déployé sur Vercel (région Francfort).

## 6. Ce qui n'est pas fini

- **Connecteurs** : ils n'appellent pas encore les vraies API (Microsoft Graph, Google, Slack). Les infos viennent des données de démo, des saisies et des réponses d'experts. Le pipeline visé est décrit dans la partie 3.1.
- **Détection des contradictions** : elle ne compare que les faits chiffrés. La version visée (extraction structurée, puis raisonnement sur le chevauchement des conditions) est décrite dans la partie 3.2.
- **Recherche** : elle repose sur des mots-clés, sans recherche sémantique ni réponse rédigée (partie 3.3).
- **Droits d'accès** : tout employé connecté voit toutes les infos. Avec de vraies sources, chaque info devra hériter des droits de son document d'origine.
- **Notifications** : elles restent dans l'appli, sans envoi par e-mail ni dans Teams.
