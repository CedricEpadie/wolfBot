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

## Les morts ne parlent plus

Un joueur éliminé reste dans le groupe pour regarder la partie, mais le bot **supprime tous ses messages** dans le groupe principal
(texte, images, vocaux, stickers…). Il prévient le joueur une seule fois et affiche un rappel général à la première mort.
- Le bot doit être **admin** du groupe pour supprimer les messages des autres (sinon il prévient une fois et la règle repose sur le fair-play).
- Les commandes de consultation restent autorisées aux morts : `/loup etat`, `/loup vivants`, `/loup role`, `/loup roles`, `/loup regles`, `/loup top`, `/loup aide`.
- La suppression est quasi immédiate, mais un message peut rester visible une seconde ou deux, et les réactions ne peuvent pas être supprimées.
- `DEAD_SILENCE=off` désactive ce comportement.

**Annonces de nuit :** quand le joueur d'un rôle est éliminé, le bot **n'annonce plus son réveil** dans le groupe (et la nuit est plus courte).
Avec `REVEAL_ROLES=false` (rôles des morts cachés), il continue de tout annoncer : se taire révélerait le rôle du mort.
Un rôle encore en vie mais sans pouvoir utilisable (par exemple une sorcière sans potion) continue d'être annoncé, pour ne rien révéler.

## Groupe secret des loups

Au début de la partie, le bot **crée un groupe WhatsApp réservé aux loups** (« 🐺 Meute — Loup-Garou ») et y ajoute les loups.

**Mode `keep` (défaut) :**
- Le groupe est **fermé** (seul le bot peut écrire) et ne s'ouvre que **pendant l'étape de nuit où les loups votent**.
- À ce moment, le bot **rouvre le groupe** et y envoie la **carte « Qui dévorer ? »** (une seule carte commune, **pas de carte privée**). Les loups se concertent librement, puis votent en envoyant **seulement un numéro** (ex. `3`).
  Un message qui n'est pas un numéro seul n'est jamais pris pour un vote ; le dernier vote de chacun compte.
- Le bot annonce chaque vote dans le groupe, rappelle le temps restant (30 s, 10 s), annonce la victime retenue, puis **referme** le groupe jusqu'à la nuit suivante.
- Un loup éliminé est **retiré** du groupe. À la fin de la partie, le bot **dissout** le groupe (il retire tous les membres puis le quitte : WhatsApp supprime un groupe vide).
  Un groupe resté ouvert après un plantage est dissous au redémarrage suivant.

| `WOLF_GROUP` | Comportement |
|---|---|
| `keep` (défaut) | comme ci-dessus : vote dans le groupe, ouvert uniquement pendant l'étape des loups, dissous à la fin |
| `leave` | le bot crée le groupe puis **le quitte aussitôt** : il ne voit plus rien, donc il ne peut pas recevoir leurs votes dans le groupe. Les loups reçoivent alors leur **carte de vote en privé** et le groupe reste ouvert. Le bot ne peut plus le dissoudre : il prévient les loups de le quitter à la fin. |
| `off` | pas de groupe : cartes de vote privées, et le bot relaie les messages des loups en privé |

- Si un loup ne peut pas être ajouté (réglage « Qui peut m'ajouter à des groupes »), le bot lui envoie un **lien d'invitation** en privé.
- Si la création du groupe ou l'envoi de la carte dans le groupe échoue, la partie continue avec les **cartes de vote privées**.
- WhatsApp n'a pas de bouton « supprimer le groupe » pour un bot : « dissoudre » veut dire vider puis quitter.
- **Équité :** en mode `keep`, le bot est membre du groupe, donc le **téléphone du bot** voit ses membres (= la liste des loups), la carte et leurs messages.
  Utilise un numéro dédié et ne regarde pas ce téléphone pendant la partie, ou choisis `leave` (mais les votes repassent alors par des cartes privées).

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
   un rôle mort attend un temps aléatoire pour ne rien révéler. Les loups discutent et votent dans leur groupe secret, ouvert seulement pendant leur étape (ou par cartes privées si le groupe est désactivé).
4. **Jour** (groupe rouvert) : annonce dramatique des morts (rôle révélé + épitaphe), annonce de la voyante bavarde, débat chronométré,
   puis **vote** : la liste des joueurs en vie est envoyée dans le groupe, on vote en **mentionnant (@)** le suspect : un seul @ par message, et répondre à un message ne vote pas.
   Votes publics, fin anticipée quand tout le monde a voté. L'annonce des morts de nuit est volontairement neutre : on ne dit jamais *comment* le joueur est mort.
5. Le Chasseur tire quand il meurt (30 s). Fin de partie : récap des rôles, statistiques mises à jour, classement `/loup top`.

### Le maire 👑
Au **jour 1**, avant le débat, le village élit un maire (60 s, on vote en mentionnant le candidat, on peut voter pour soi ; égalité ou aucun vote = tirage au sort).
- Sa **voix compte double** (affiché dans le décompte).
- Il **tranche les égalités** du vote : le bot lui envoie en privé la liste des ex æquo (30 s) ; sans réponse, le sort décide. Sans maire, une égalité n'élimine personne.
- S'il meurt, il **désigne son successeur** en privé (25 s) ; sans réponse, le sort décide.
- Désactivable avec `MAYOR=false`.

### Statistiques et reprise après plantage 💾
Les données sont écrites dans `DATA_DIR` (par défaut `./data`, **à placer sur un volume persistant** en hébergement) :
- `stats.json` : par groupe et par joueur — parties, victoires (loup / village), série en cours et record, survies, mandats de maire, rôles joués. Voir `/loup top` et `/loup stats [@x]`.
- `games.json` : sauvegarde des parties en cours, écrite au début de chaque nuit et de chaque jour. Après un redémarrage, le bot **reprend la partie** (rôles, morts, potions, maire et groupe des loups conservés) ; la phase en cours recommence depuis son début. Une partie sauvegardée depuis plus de `RESUME_MAX_MINUTES` (120) est abandonnée et le groupe rouvert. Le salon d'attente et la distribution des cartes ne sont pas repris.
- Ce sont de simples fichiers JSON (écriture atomique, aucune dépendance native). Pour passer à SQLite plus tard, seuls les 3 fichiers de `src/persistence/` sont à adapter.

### Règles, rôles et composition en image 🖼️
`/loup regles`, `/loup roles` (rôles + tableau de composition) et la composition annoncée au lancement sont envoyées en **images lisibles**.
`INFO_DELIVERY=text` (ou un problème de génération d'image) les remplace automatiquement par du texte.

### Le narrateur 🎙️
Toutes les annonces ont plusieurs variantes tirées au hasard (jamais deux fois la même d'affilée) : nuit qui tombe, réveil des rôles, aube, morts de nuit / de vote / du chasseur, vote, maire, victoire… avec une **épitaphe** pour chaque mort
(propre au rôle si `REVEAL_ROLES=true`, générique sinon). Tout est dans `src/game/narrator.js` : ajouter une phrase = ajouter une ligne dans la liste de l'événement.

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
| `/loup stats [@x]` | statistiques d'un joueur (les siennes par défaut) |
| `/loup ouvrir` | rouvrir le groupe (hors partie) |
| `/loup aide` | liste des commandes |

**Actions de nuit (en privé avec le bot)** : répondre par le **numéro** affiché sur la carte. La Sorcière répond
`vie`, `mort 3` ou `rien`.

## Réglages

Dans `.env` : `PREFIX`, `ROLE_DELIVERY`, `ROLE_SELF_DESTRUCT`, `WIPE_DM_CHAT`, `VOYANTE_REVEAL_NAME`
(annoncer aussi le nom du joueur sondé), `REVEAL_ROLES` (révéler le rôle des morts), `DEAD_SILENCE` (supprimer les messages des morts), `WOLF_GROUP` (`keep`, `leave` ou `off`), `MIN_PLAYERS`, `MAYOR` (maire, true/false), `DATA_DIR`, `RESUME_GAMES`, `RESUME_MAX_MINUTES`, `INFO_DELIVERY` (`photo` ou `text`).
Les durées (débat, vote, étapes de nuit…) sont dans `src/config.js`.

Le bot Imposteur et ce bot utilisent chacun leur propre commande (`/imposteur …` et `/loup …`) : ils peuvent cohabiter, mais un bot = une session WhatsApp (un numéro).

## Structure du code

`index.js` est un simple point d'entrée ; toute la logique est dans `src/` :

```
src/
├── main.js            démarrage (vérifie les cartes, lance la connexion)
├── config.js          variables .env + durées/limites du jeu
├── env.js, paths.js   chargement du .env, racine du projet
├── state.js           parties en cours (en mémoire)
├── persistence/       jsonStore.js • stats.js (data/stats.json) • saves.js (data/games.json)
├── utils.js           petits utilitaires génériques
├── whatsapp/          socket.js (socket courant) • connection.js (QR, reconnexion)
│                      messaging.js (say, sendText, sendCard…) • group.js (admin, verrouillage, dissolution)
├── cards/             render.js (SVG→JPEG) • names.js (noms/emojis) • assets.js • fonts.js • roleCard.js
│                      infoCards.js (règles, rôles, composition en image)
├── game/              roles.js (rôles + composition) • players.js • timers.js • prompts.js
│                      flow.js (lancement, distribution, boucle) • night.js • day.js • mayor.js • resume.js
│                      narrator.js (phrases variées + épitaphes)
│                      deaths.js (morts, chasseur, silence) • lifecycle.js (fin/annulation)
│                      wolfGroup.js (groupe secret des loups)
├── handlers/          messages.js (aiguillage) • private.js (réponses aux cartes en privé)
└── commands/          index.js (registre) • info.js • lobby.js • play.js • admin.js • texts.js
```

- **Ajouter une commande** : une entrée `{ names, groupOnly, run }` dans `src/commands/*.js`.
- **Ajouter un rôle** : `src/game/roles.js` (+ image dans `assets/emoji/`), puis une étape dans `src/game/night.js`.
- **Changer un réglage** : `src/config.js`.

## Licences

Emojis (cartes de rôle et noms) : images Noto Color Emoji (Google), licence Apache-2.0 (`assets/emoji/NOTO-EMOJI-LICENSE.txt`).
Police : DejaVu Sans (`fonts/DEJAVU-LICENSE.txt`).