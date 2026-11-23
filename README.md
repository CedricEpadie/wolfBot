# 🐺 Bot WhatsApp — Loup-Garou

Bot autonome (Baileys), lancé en arrière-plan avec **pm2** via **yarn**. Préfixe par défaut : `/`.

## Rôles

| Rôle | Pouvoir |
|---|---|
| 🐺 Loup-Garou | choisit une victime chaque nuit avec ses complices |
| 🧙‍♀️ Sorcière | 1 potion de vie + 1 potion de mort (une seule potion par nuit) |
| 🏹 Chasseur | à sa mort (nuit ou vote), il tire une dernière balle |
| 🔮 Voyante bavarde | découvre un rôle chaque nuit… et **le village l'apprend** (sans son nom) |
| 🛡️ Garde | protège un joueur chaque nuit (pas deux fois de suite le même) |
| 🧑‍🌾 Simple villageois | aucun pouvoir, sa voix compte |

Composition automatique (6 à 16 joueurs) : 4 rôles spéciaux + 1 loup tous les 3 joueurs, le reste en villageois
(6 joueurs : 2 loups ; 9 joueurs : 3 loups ; 12 joueurs : 4 loups…). Voir `/loup roles`.

## Installation

```bash
yarn install
cp .env.example .env     # puis ajuste si besoin
yarn dev                 # première connexion : scanne le QR (WhatsApp → Appareils connectés), puis Ctrl+C
yarn start               # lance le bot en arrière-plan (pm2)
```

Sans QR : renseigne `PAIRING_NUMBER` dans `.env`, lance `yarn start`, puis lis le code de jumelage avec `yarn logs`.

| Commande | Effet |
|---|---|
| `yarn start` / `stop` / `restart` / `delete` | gère le bot en arrière-plan |
| `yarn logs` | logs en direct |
| `yarn status` | état du processus |

Démarrage automatique au boot du serveur : `yarn pm2 startup` (copie la commande `sudo` affichée), puis `yarn start` et `yarn pm2 save`.

## Important : le bot doit être ADMIN du groupe

La nuit, le bot **ferme le groupe** (seuls les admins peuvent écrire) et le **rouvre** au lever du jour.
S'il n'est pas admin, il prévient et la partie continue, mais le silence de nuit repose sur le fair-play.
Si le groupe reste fermé après un plantage : `/loup ouvrir`.

## Groupe secret des loups

Au début de la partie, le bot **crée un groupe WhatsApp réservé aux loups** (« 🐺 Meute — Loup-Garou ») et y ajoute les loups.
Ils y discutent librement ; le vote de la victime se fait toujours par la carte numérotée reçue en privé, et le bot annonce
dans le groupe de la meute qui vote contre qui et la victime retenue.

| `WOLF_GROUP` | Comportement |
|---|---|
| `keep` (défaut) | le bot reste admin du groupe, **retire les loups morts** et **dissout le groupe à la fin** (il retire tous les membres puis le quitte : WhatsApp supprime un groupe vide). Un groupe resté ouvert après un plantage est dissous au redémarrage suivant. |
| `leave` | le bot crée le groupe puis **le quitte aussitôt** : il n'a plus accès aux messages. Mais il ne peut plus retirer les morts ni supprimer le groupe : à la fin, il prévient les loups de le quitter. |
| `off` | pas de groupe : le bot relaie les messages des loups en privé (comme avant). |

- Si un loup ne peut pas être ajouté (réglage « Qui peut m'ajouter à des groupes »), le bot lui envoie un **lien d'invitation** en privé.
- Si la création du groupe échoue, la partie continue avec le **relais en privé**.
- WhatsApp n'a pas de bouton « supprimer le groupe » pour un bot : « dissoudre » veut dire vider puis quitter.
- **Équité :** en mode `keep`, le bot est membre du groupe, donc le **téléphone du bot** voit ses membres (= la liste des loups) et ses messages.
  Utilise un numéro dédié et ne regarde pas ce téléphone pendant la partie, ou choisis `leave` (le bot quitte aussitôt et efface la conversation de son côté,
  mais une brève fenêtre d'exposition subsiste à la création).

## Cartes en image avec emojis

Chaque joueur reçoit en privé une **carte image** avec l'emoji de son rôle (🐺 🧙‍♀️ 🏹 🔮 🛡️ 🧑‍🌾) :
- les emojis (`assets/emoji/`) et les polices (`fonts/`) sont **embarqués** dans le projet : aucun paquet de polices à installer sur le serveur ;
- les cartes de choix de nuit (« Qui protéger ? », « Qui dévorer ? », « Tes potions »…) sont des listes numérotées ;
- chaque carte est **supprimée** après `ROLE_SELF_DESTRUCT` secondes (60 par défaut) et la conversation est **effacée côté bot** ;
- `ROLE_DELIVERY=text` envoie la même chose en texte (sans image).

### Noms des joueurs sur les cartes

Les cartes de choix affichent le nom WhatsApp de chaque joueur, tel qu'il l'a défini dans son profil :
- les **emojis** (😎 🔥 🇨🇲 💖 👑…) sont dessinés en couleur (`assets/emoji-names.json`) ;
- les lettres « fantaisie » (𝓤𝓻𝓼𝓾𝓵𝓮, ＭＯＨＡＭＥＤ…) sont converties en lettres normales ;
- les caractères que la police ne sait pas afficher (alphabets non pris en charge) sont retirés, sans carrés vides ;
- si deux joueurs ont le même nom, ou un nom vide ou réduit à des points, le bot ajoute les 4 derniers chiffres de son numéro (« Alex ·0009 », « Joueur 0008 »).

Les cartes affichent le nom de **profil** du joueur, pas le nom enregistré dans ton répertoire : ils peuvent différer.

### Équité : ce que l'hébergeur du bot peut voir

- **Les numéros sont mélangés différemment pour chaque joueur** : voir qu'un joueur répond « 3 » ne dit rien sans avoir vu sa carte.
- Les cartes disparaissent vite et la conversation est effacée côté bot quelques secondes après chaque envoi.
- Le bot n'écrit jamais les rôles ni les choix dans ses logs.
- **Limite** : les réponses des joueurs arrivent quand même sur le téléphone du bot (un instant), et celui qui contrôle le serveur
  pourrait modifier le programme. Pour que la partie soit équitable : utilise un **numéro dédié**, ne regarde pas le téléphone du bot
  pendant la partie, et si tu veux jouer, fais-le avec ton compte habituel.

## Déroulement

1. `/loup` ouvre le salon (rappels de décompte), `/loup join` pour rejoindre, `/loup go` pour lancer (départ auto sinon).
2. **Distribution** des cartes avec barre de progression, puis composition annoncée.
3. **Nuit** (groupe fermé) : 🛡️ Garde → 🔮 Voyante → 🐺 Loups → 🧙‍♀️ Sorcière. Chaque étape est annoncée dans le groupe ;
   un rôle mort attend un temps aléatoire pour ne rien révéler. Les loups discutent dans leur groupe secret (ou via le relais du bot si le groupe est désactivé).
4. **Jour** (groupe rouvert) : annonce des morts (et de leur rôle), annonce de la voyante bavarde, débat chronométré,
   puis **vote** : la liste des joueurs en vie est envoyée dans le groupe, on vote en **mentionnant (@)** le suspect : un seul @ par message, et répondre à un message ne vote pas.
   Votes publics, fin anticipée quand tout le monde a voté, égalité = personne n'est éliminé.
5. Le Chasseur tire quand il meurt (30 s). Fin de partie : récap des rôles et classement `/loup top`.

Toutes les mentions de joueurs sont de vraies mentions WhatsApp (@).

## Commandes (dans un groupe)

| Commande | Effet |
|---|---|
| `/loup` | ouvrir une partie |
| `/loup join` | rejoindre |
| `/loup go` | lancer (lanceur) |
| `/loup stop` | annuler (lanceur) |
| `/loup role` | renvoyer sa carte (aussi en privé avec le bot) |
| `/loup roles` | rôles disponibles et composition |
| `/loup regles` | règles du jeu |
| `/loup etat` | phase en cours et temps restant |
| `/loup vivants` | joueurs en vie |
| `/loup vote @x` | voter (ou simplement mentionner @x pendant le vote) |
| `/loup passer` | passer le débat (lanceur) |
| `/loup top` | classement des victoires |
| `/loup ouvrir` | rouvrir le groupe (hors partie) |
| `/loup aide` | liste des commandes |

**Actions de nuit (en privé avec le bot)** : répondre par le **numéro** affiché sur la carte. La Sorcière répond
`vie`, `mort 3` ou `rien`.

## Réglages

Dans `.env` : `PREFIX`, `ROLE_DELIVERY`, `ROLE_SELF_DESTRUCT`, `WIPE_DM_CHAT`, `VOYANTE_REVEAL_NAME`
(annoncer aussi le nom du joueur sondé), `REVEAL_ROLES` (révéler le rôle des morts), `WOLF_GROUP` (`keep`, `leave` ou `off`), `MIN_PLAYERS`.
Les durées (débat, vote, étapes de nuit…) sont en haut de `index.js`.

Le bot Imposteur et ce bot utilisent chacun leur propre commande (`/imposteur …` et `/loup …`) : ils peuvent cohabiter, mais un bot = une session WhatsApp (un numéro).

## Licences

Emojis (cartes de rôle et noms) : images Noto Color Emoji (Google), licence Apache-2.0 (`assets/emoji/NOTO-EMOJI-LICENSE.txt`).
Police : DejaVu Sans (`fonts/DEJAVU-LICENSE.txt`).