// 🎭 Définition des rôles et composition d’une partie
// → pour ajouter un rôle : l’ajouter dans ROLES + ROLE_ORDER (+ une image assets/emoji/<img>.png), puis dans composition().
import { NECROMANCER, MENTALIST, NECRO_MIN_PLAYERS, MENTALIST_MIN_PLAYERS, COMPOSITION_RANDOM } from '../config.js'
import { chance, int, pick, weightedPick } from '../random.js'

export const ROLES = {
  loup: {
    label: 'LOUP-GAROU',
    emoji: '🐺',
    img: 'loup',
    color: '#ff5d5d',
    camp: 'Camp : les Loups-Garous',
    lines: ['Chaque nuit, avec tes complices, vous', 'choisissez une victime à dévorer.', 'Le jour, mens, accuse et survis !'],
    short: 'dévore un villageois chaque nuit avec ses complices',
  },
  sorciere: {
    label: 'SORCIÈRE',
    emoji: '🧙‍♀️',
    img: 'sorciere',
    color: '#b57cff',
    camp: 'Camp : le Village',
    lines: ['Tu possèdes 2 potions à usage unique :', 'VIE = sauve la victime des loups,', 'MORT = élimine le joueur de ton choix.'],
    short: 'une potion de vie et une potion de mort, à usage unique (une seule potion par nuit)',
  },
  chasseur: {
    label: 'CHASSEUR',
    emoji: '🏹',
    img: 'chasseur',
    color: '#f5a524',
    camp: 'Camp : le Village',
    lines: ['Si tu meurs (de nuit ou par le vote), tu tires', 'ta dernière balle EN PUBLIC : tu désignes dans', 'le groupe le joueur que tu emportes avec toi.'],
    short: 'quand il meurt, il tire une dernière balle sur un joueur, en public dans le groupe',
  },
  voyante: {
    label: 'VOYANTE BAVARDE',
    emoji: '🔮',
    img: 'voyante',
    color: '#4dc3ff',
    camp: 'Camp : le Village',
    lines: ['Chaque nuit, découvre le rôle d’un joueur.', 'Bavarde : le rôle que tu découvres est', 'annoncé à tout le village (sans ton nom).'],
    short: 'voit un rôle chaque nuit, mais le village l’apprend aussi',
  },
  garde: {
    label: 'GARDE',
    emoji: '🛡️',
    img: 'garde',
    color: '#3ddc84',
    camp: 'Camp : le Village',
    lines: ['Chaque nuit, protège un joueur des loups.', 'Pas deux nuits de suite le même joueur.', 'Tu peux te protéger toi-même.'],
    short: 'protège un joueur des loups chaque nuit (jamais le même deux nuits de suite)',
  },
  necromancien: {
    label: 'NÉCROMANCIEN',
    emoji: '👻',
    img: 'necromancien',
    color: '#b8c2d8',
    camp: 'Camp : le Village',
    lines: ['Chaque nuit, tu rejoins le groupe des morts', 'jusqu’à l’aube : interroge-les pour glaner', 'des indices… mais ils peuvent mentir !'],
    short: 'parle aux morts chaque nuit pour glaner des indices',
  },
  mentaliste: {
    label: 'MENTALISTE',
    emoji: '🎩',
    img: 'mentaliste',
    color: '#ff7ac6',
    camp: 'Camp : le Village',
    lines: ['Pendant le vote, tu as des prémonitions :', 'je te dis en privé si le village va dans', 'la bonne direction… ou pas. Reste vague !'],
    short: 'pressent en privé si le vote du village prend la bonne direction',
  },
  villageois: {
    label: 'SIMPLE VILLAGEOIS',
    emoji: '🧑‍🌾',
    img: 'villageois',
    color: '#e0b36a',
    camp: 'Camp : le Village',
    lines: ['Pas de pouvoir spécial : observe, débats', 'et vote pour démasquer les loups-garous.', 'Ta voix peut sauver le village !'],
    short: 'aucun pouvoir, mais sa voix compte',
  },
}
export const ROLE_ORDER = ['loup', 'sorciere', 'chasseur', 'voyante', 'garde', 'necromancien', 'mentaliste', 'villageois']

const CORE_SPECIALS = ['sorciere', 'chasseur', 'voyante', 'garde']
const GUEST_MIN_PLAYERS = 7 // sous ce nombre de joueurs, la composition reste classique
const GUEST_CHANCE = 0.25 // chance qu’un rôle « invité » (Nécromancien / Mentaliste) apparaisse avant son seuil habituel

// Composition d’une partie de n joueurs (liste de rôles, non mélangée).
//  • random = false : composition « type », toujours identique (tableaux d’aide, règles).
//  • random = true  : variantes tirées au sort (voir COMPOSITION_RANDOM) :
//      - dès 10 joueurs : 1 loup de plus ou de moins (25 % / 50 % / 25 %), sans dépasser 42 % de loups ;
//      - dès 7 joueurs : un rôle spécial peut manquer (30 %) ou deux (10 %) — toujours au moins 3 ;
//      - dès 7 joueurs : le Nécromancien / Mentaliste peut venir « en invité » remplacer un autre rôle spécial.
export const composition = (n, { random = COMPOSITION_RANDOM } = {}) => {
  const base = Math.max(1, Math.floor(n / 3))
  const specials = [...CORE_SPECIALS]
  const guests = []
  if (NECROMANCER) (n >= NECRO_MIN_PLAYERS ? specials : guests).push('necromancien')
  if (MENTALIST) (n >= MENTALIST_MIN_PLAYERS ? specials : guests).push('mentaliste')

  let wolves = base
  if (random) {
    if (n >= 10) wolves = Math.min(Math.max(base + weightedPick([-1, 0, 1], [1, 2, 1]), 2), Math.floor(n * 0.42))
    if (n >= GUEST_MIN_PLAYERS) {
      for (const guest of guests) {
        const swappable = specials.map((r, i) => i).filter((i) => !['necromancien', 'mentaliste'].includes(specials[i]))
        if (chance(GUEST_CHANCE) && swappable.length) specials[pick(swappable)] = guest
      }
      const drop = weightedPick([0, 1, 2], [60, 30, 10])
      for (let i = 0; i < drop && specials.length > 3; i++) specials.splice(int(specials.length), 1)
    }
  }
  const list = [...specials.slice(0, Math.max(0, n - wolves)), ...Array(wolves).fill('loup')]
  while (list.length < n) list.push('villageois')
  return list.slice(0, n)
}
export const countRoles = (list) => {
  const c = {}
  for (const r of list) c[r] = (c[r] || 0) + 1
  return c
}
// Texte de composition : à partir d’une liste de rôles (la vraie composition d’une partie) ou d’un nombre de joueurs
// (composition « type »).
export const compoText = (source) => {
  const counts = countRoles(Array.isArray(source) ? source : composition(source, { random: false }))
  return ROLE_ORDER.filter((r) => counts[r])
    .map((r) => `${counts[r]} ${ROLES[r].emoji} ${ROLES[r].label}`)
    .join(' • ')
}

// Ce joueur a-t-il gagné ? winner : 'village' | 'loups' | 'egalite' (égalité : personne ne gagne)
export const didWin = (role, winner) => (winner === 'village' ? role !== 'loup' : winner === 'loups' ? role === 'loup' : false)
