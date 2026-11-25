// 🎙️ Le narrateur : plusieurs phrases par événement, tirées au hasard (jamais deux fois la même d’affilée).
//
// Pour AJOUTER une phrase : l’ajouter à la liste de l’événement dans BANK.
// Pour AJOUTER un événement : créer une clé dans BANK, puis l’utiliser avec tell('ma.cle', { player: … }).
// Les {variables} sont remplacées par les valeurs passées à tell().
//
// ⚠️ Règles d’équité à respecter quand tu écris des phrases :
//  • les annonces de mort de NUIT sont neutres (pas de « dévoré » ni « empoisonné ») : on ne dit pas qui a agi ;
//  • les phrases des étapes de nuit (réveil / rendormissement) ne doivent jamais laisser deviner si le rôle a agi ;
//  • les épitaphes propres à un rôle ne sont utilisées que si REVEAL_ROLES=true.
import { REVEAL_ROLES } from '../config.js'

const BANK = {
  // ───── Salon et nuit ─────
  lobbyIntro: [
    '🐺 *LOUP-GAROU* 🌕\n\nLe village dort, les loups rôdent…',
    '🐺 *LOUP-GAROU* 🌕\n\nLa pleine lune se lève et les crocs s’aiguisent…',
    '🐺 *LOUP-GAROU* 🌕\n\nUn hurlement résonne au loin… qui osera affronter la nuit ?',
    '🐺 *LOUP-GAROU* 🌕\n\nLes volets se ferment, les chandelles vacillent… une nouvelle partie commence !',
  ],
  nightFalls: [
    'Le village s’endort… 😴',
    'Les dernières lanternes s’éteignent, le village sombre dans le silence… 😴',
    'La lune monte au-dessus des toits, chacun ferme les yeux… 😴',
    'Un vent froid balaie la place : le village retient son souffle et s’endort… 😴',
    'Les chauves-souris s’envolent, les portes se verrouillent… la nuit tombe. 😴',
  ],
  'garde.start': [
    '🛡️ *Le Garde se réveille* et choisit qui protéger cette nuit…',
    '🛡️ *Le Garde* ouvre les yeux, serre sa lance et veille sur quelqu’un…',
    '🛡️ Dans l’ombre, *le Garde* se lève et désigne celui qu’il couvrira de son bouclier…',
    '🛡️ *Le Garde* sort de sa torpeur : qui bénéficiera de sa protection ?',
  ],
  'garde.end': ['🛡️ Le Garde se rendort.', '🛡️ Le Garde regagne son poste et ferme les yeux.', '🛡️ Son choix est fait : le Garde se rendort.'],
  'voyante.start': [
    '🔮 *La Voyante bavarde se réveille* et sonde un joueur…',
    '🔮 Les brumes de sa boule de cristal s’éclaircissent : *la Voyante* se réveille et cherche une âme à sonder…',
    '🔮 *La Voyante bavarde* ouvre les yeux, les astres lui murmurent un nom…',
    '🔮 Une lueur violette danse dans la nuit : *la Voyante* observe un joueur…',
  ],
  'voyante.end': ['🔮 La Voyante se rendort.', '🔮 La boule de cristal s’éteint : la Voyante se rendort.', '🔮 La Voyante a vu ce qu’elle voulait voir… elle se rendort.'],
  'loups.start': [
    '🐺 *Les Loups-Garous se réveillent* et choisissent leur victime…',
    '🐺 Des yeux jaunes s’allument dans l’obscurité : *les Loups-Garous* se réveillent et choisissent leur proie…',
    '🐺 Un grondement sourd monte des ténèbres… *la meute* se réveille et désigne une victime.',
    '🐺 *Les Loups-Garous* sortent leurs griffes et flairent le village…',
    '🐺 La pleine lune les appelle : *les Loups-Garous* se réveillent, affamés…',
  ],
  'loups.end': ['🐺 Les Loups-Garous se rendorment.', '🐺 La meute se dissipe dans la nuit et se rendort.', '🐺 Les crocs se rétractent : les Loups-Garous se rendorment.'],
  'sorciere.start': [
    '🧙‍♀️ *La Sorcière se réveille* et consulte ses potions…',
    '🧙‍♀️ Dans son chaudron, quelque chose bouillonne : *la Sorcière* se réveille et examine ses fioles…',
    '🧙‍♀️ *La Sorcière* ouvre un œil et caresse ses deux flacons…',
    '🧙‍♀️ Une fumée verdâtre s’élève : *la Sorcière* se réveille et réfléchit…',
  ],
  'sorciere.end': ['🧙‍♀️ La Sorcière se rendort.', '🧙‍♀️ Le chaudron refroidit : la Sorcière se rendort.', '🧙‍♀️ Ses fioles rangées, la Sorcière se rendort.'],

  // ───── Aube ─────
  dawn: [
    'Le soleil se lève sur le village… 🐓',
    'Le coq chante : une nouvelle aube éclaire les toits… 🐓',
    'Les premiers rayons percent la brume, le village se réveille… 🌅',
    'Les cloches sonnent le matin, les volets s’ouvrent un à un… 🔔',
  ],
  nightVictimsIntro: [
    'Le village retient son souffle…',
    'Les villageois s’approchent, l’angoisse au ventre…',
    'L’appel du matin révèle des absences…',
    'Un silence pesant tombe sur la place…',
  ],
  miracle: [
    '🕊️ *Miracle !* Personne n’est mort cette nuit.',
    '🕊️ *Quel soulagement !* La nuit s’est achevée sans le moindre cri.',
    '🕊️ *Les villageois s’embrassent :* tout le monde est encore là ce matin !',
    '🕊️ *Un matin paisible…* personne ne manque à l’appel. Pour combien de temps ?',
  ],
  'voyante.talk': [
    'Cette nuit, elle a vu {what}',
    'Dans sa boule de cristal, elle a aperçu {what}',
    'Elle ne sait pas tenir sa langue : elle a vu {what}',
    'Les astres lui ont soufflé, et elle le crie sur les toits : {what}',
  ],

  // ───── Morts (annonces dramatiques) ─────
  // De nuit : neutre, on ne dit jamais comment la victime est morte
  'death.night': [
    '🩸 Un cri déchire le matin : {player} gît sans vie sur la place du village…',
    '🕯️ On retrouve {player} sans vie, le visage figé dans l’effroi…',
    '🌫️ La brume se dissipe et révèle le corps de {player}. La nuit n’a pas été clémente…',
    '🔔 Le glas sonne pour {player}. Le village ne le reverra plus.',
    '🌑 Les volets claquent, les chiens aboient… {player} n’a pas vu le jour se lever.',
    '🥀 {player} ne répond plus à l’appel du matin. Le silence est assourdissant.',
    '😱 Un villageois hurle : « C’est {player} ! » Il est déjà trop tard…',
  ],
  'death.vote': [
    '🪢 La foule a choisi. {player} est conduit sur la place, sous les cris du village…',
    '🔥 Les torches s’agitent, les accusations fusent… {player} paie le prix du soupçon.',
    '⚰️ Le verdict tombe, implacable : {player} quitte la partie sous le regard du village.',
    '🗡️ « Au nom du village ! » {player} est éliminé. Espérons que la foule ne s’est pas trompée…',
    '🥁 Un dernier roulement de tambour… {player} tire sa révérence.',
  ],
  'death.hunter': [
    '💥 Dans un dernier souffle, {hunter} épaule son arc : la flèche file et {player} s’écroule !',
    '🏹 {hunter} ne tombera pas seul ! Un trait siffle dans l’air et frappe {player} en pleine poitrine.',
    '🎯 Un tir, un seul. {hunter} emporte {player} dans la tombe…',
    '⚡ Le Chasseur n’a pas dit son dernier mot : {hunter} tire, et {player} s’effondre !',
  ],
  hunterStart: [
    '🏹 {player} était le *CHASSEUR* ! Il a *{s} s* pour tirer sa dernière balle…',
    '🏹 Dernier réflexe : {player} était le *CHASSEUR* ! *{s} s* pour viser…',
    '🏹 Attention ! {player} était le *CHASSEUR* et son arc est encore tendu : *{s} s* pour tirer !',
  ],
  hunterMiss: [
    '🕯️ {player} n’a pas tiré à temps… la flèche se perd dans la nuit.',
    '💨 {player} hésite, tremble… et s’éteint avant d’avoir pu viser.',
    '🥀 Le Chasseur s’effondre sans avoir tiré. La flèche reste dans le carquois.',
  ],

  // ───── Débat et vote ─────
  debate: [
    'Qui sont les loups-garous ? Accusez, défendez-vous !',
    'Les regards se croisent, les soupçons montent… qui ment ?',
    'Un loup se cache parmi vous. Observez, accusez, justifiez-vous !',
    'Chaque mot compte, chaque silence aussi. Qui sonne faux ?',
  ],
  voteStart: [
    'Le moment est venu de désigner un coupable.',
    'Assez de paroles : place aux actes !',
    'Le village doit trancher. Qui sera désigné ?',
    'Les torches sont allumées, il faut un nom.',
  ],
  voteClosed: [
    '🔔 *Le vote est clos !* Dépouillement… 🥁',
    '🔔 *Les urnes sont fermées !* Comptons les voix… 🥁',
    '🔔 *Plus un mot !* Le dépouillement commence… 🥁',
  ],
  noVotes: [
    '🤷 Personne n’a voté : le village se rendort, sans éliminer personne.',
    '🤷 Silence radio… personne n’a voté, et la nuit retombe sur un village indécis.',
  ],
  tieAnnounce: [
    'Les voix se valent, le village est coupé en deux !',
    'Match nul : aucune voix ne l’emporte…',
    'Le village n’arrive pas à se décider !',
  ],

  // ───── Maire ─────
  mayorElection: [
    'Le village a besoin d’un chef. Qui portera l’écharpe de maire ?',
    'Avant de chercher les loups, choisissons qui guidera le village.',
    'Une écharpe, un titre, un pouvoir… qui sera digne de la porter ?',
  ],
  mayorElected: [
    '{player} est acclamé et ceint l’écharpe tricolore !',
    'Les villageois ont parlé : {player} devient le maire !',
    '{player} monte sur l’estrade, l’écharpe sur les épaules. Longue vie au maire !',
  ],
  mayorRandom: [
    'Personne n’a voté… le sort désigne lui-même {player} !',
    'Faute de suffrages, c’est le hasard qui nomme {player} maire !',
  ],
  mayorTieElect: [
    'Égalité parfaite pour la mairie : le sort départage les candidats et choisit {player} !',
    'Les urnes ne tranchent pas : le hasard désigne {player} !',
  ],
  tieMayorChose: [
    '👑 {mayor} lève la main et tranche : *{player}* sera éliminé !',
    '👑 Le maire {mayor} rend son verdict : *{player}* ira à l’échafaud.',
    '👑 {mayor} tranche, sans trembler : *{player}* est désigné.',
  ],
  tieRandom: [
    '⏳ Le maire hésite trop longtemps… le sort désigne *{player}* !',
    '⏳ Faute de décision du maire, le hasard frappe : *{player}* est désigné !',
  ],
  mayorDies: [
    '👑 Le maire {player} vient de mourir… l’écharpe doit passer à quelqu’un.',
    '👑 {player} n’est plus. En mourant, le maire peut léguer son écharpe.',
  ],
  mayorSuccessor: [
    '👑 Avant de s’éteindre, {from} confie l’écharpe à {player} : nouveau maire !',
    '👑 Le testament est clair : {player} succède à {from} comme maire.',
  ],
  mayorSuccessorRandom: [
    '👑 Faute de testament, le sort désigne {player} comme nouveau maire.',
    '👑 Pas de dernier mot du maire : c’est le hasard qui nomme {player} !',
  ],

  // ───── Fin de partie ─────
  winVillage: [
    '🎉 *LE VILLAGE GAGNE !*\nTous les loups-garous ont été démasqués. 🏡',
    '🎉 *LE VILLAGE GAGNE !*\nLes derniers crocs sont tombés : l’aube se lève enfin sur un village libre. 🏡',
    '🎉 *LE VILLAGE GAGNE !*\nLa meute est vaincue, les cloches sonnent la victoire ! 🔔',
  ],
  winWolves: [
    '🐺 *LES LOUPS-GAROUS GAGNENT !*\nLe village est tombé sous leurs crocs… 🌕',
    '🐺 *LES LOUPS-GAROUS GAGNENT !*\nLe hurlement de la meute retentit sur un village désert… 🌕',
    '🐺 *LES LOUPS-GAROUS GAGNENT !*\nIl n’y avait plus assez de villageois pour leur résister… 🌕',
  ],
  winDraw: [
    '💀 *ÉGALITÉ !*\nIl ne reste plus personne en vie.',
    '💀 *ÉGALITÉ !*\nLe village est un cimetière : plus personne n’est là pour raconter l’histoire.',
  ],
}

// ───── Épitaphes ─────
const EPITAPHS = {
  any: [
    'Il en savait trop, ou pas assez.',
    'Il est parti sans dire au revoir.',
    'Que la terre lui soit légère.',
    'Il aurait dû voter autrement.',
    'Ci-gît quelqu’un qui avait pourtant l’air sympa.',
    'Il pensait avoir encore un tour devant lui.',
    'Son dernier message fut le plus éloquent : le silence.',
    'Mort comme il a vécu : en pleine accusation.',
    'Il manquera à ses amis, et peut-être à ses ennemis.',
    'Paix à son âme, et à son bulletin de vote.',
    'On dira qu’il a joué jusqu’au bout.',
    'Ici repose un joueur qui ne mentait presque jamais.',
  ],
  loup: [
    'Le plus beau des hurlements s’est tu.',
    'Même les loups finissent par tomber.',
    'Il a mordu la poussière, pour une fois.',
    'La meute pleure l’un des siens.',
  ],
  sorciere: [
    'Sa dernière potion fut la plus amère.',
    'Son chaudron ne bouillonnera plus.',
    'Elle emporte ses secrets dans la tombe.',
  ],
  chasseur: [
    'Sa dernière flèche est restée dans l’histoire.',
    'Il a visé juste, jusqu’à la fin.',
    'Son arc repose enfin.',
  ],
  voyante: [
    'Elle avait tout vu venir… sauf ça.',
    'Sa boule de cristal est désormais aveugle.',
    'Elle savait trop de choses, et l’a bavardé.',
  ],
  garde: [
    'Il veillait sur les autres, personne n’a veillé sur lui.',
    'Son bouclier n’a pas suffi, cette fois.',
    'Le gardien a rendu les armes.',
  ],
  villageois: [
    'Un simple villageois, un grand courage.',
    'Il n’avait aucun pouvoir, mais toute notre estime.',
    'Brave paysan, il a fait de son mieux.',
  ],
}

// ───── Moteur ─────
const lastIndex = new Map()
const choose = (key, list) => {
  if (list.length === 1) return list[0]
  let i
  do i = Math.floor(Math.random() * list.length)
  while (i === lastIndex.get(key))
  lastIndex.set(key, i)
  return list[i]
}

export const tell = (key, vars = {}) => {
  const list = BANK[key]
  if (!list?.length) throw new Error(`narrateur : événement inconnu « ${key} »`)
  return choose(key, list).replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])))
}

// Épitaphe d’un joueur mort. Les épitaphes propres à un rôle ne sont utilisées que si les rôles des morts sont révélés.
export const epitaph = (p) => {
  const specific = REVEAL_ROLES ? EPITAPHS[p.role] : null
  const pool = specific && Math.random() < 0.5 ? specific : EPITAPHS.any
  return `🪦 _« ${choose(specific && pool === specific ? `epitaph.${p.role}` : 'epitaph', pool)} »_`
}

export const narratorKeys = () => Object.keys(BANK)
