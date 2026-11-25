// 🎭 Définition des rôles et composition d’une partie
// → pour ajouter un rôle : l’ajouter dans ROLES + ROLE_ORDER (+ une image assets/emoji/<img>.png), puis dans composition().

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
    short: 'une potion de vie et une potion de mort, à usage unique',
  },
  chasseur: {
    label: 'CHASSEUR',
    emoji: '🏹',
    img: 'chasseur',
    color: '#f5a524',
    camp: 'Camp : le Village',
    lines: ['Si tu meurs (de nuit ou par le vote),', 'tu emportes IMMÉDIATEMENT un joueur', 'de ton choix avec toi.'],
    short: 'quand il meurt, il tire une dernière balle sur un joueur',
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
    short: 'protège un joueur des loups chaque nuit',
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
export const ROLE_ORDER = ['loup', 'sorciere', 'chasseur', 'voyante', 'garde', 'villageois']

export const composition = (n) => {
  const wolves = Math.max(1, Math.floor(n / 3))
  const list = ['sorciere', 'chasseur', 'voyante', 'garde']
  for (let i = 0; i < wolves; i++) list.push('loup')
  while (list.length < n) list.push('villageois')
  return list.slice(0, n)
}
export const countRoles = (list) => {
  const c = {}
  for (const r of list) c[r] = (c[r] || 0) + 1
  return c
}
export const compoText = (n) =>
  ROLE_ORDER.map((r) => ({ r, k: countRoles(composition(n))[r] || 0 }))
    .filter((x) => x.k)
    .map((x) => `${x.k} ${ROLES[x.r].emoji} ${ROLES[x.r].label}`)
    .join(' • ')

// Ce joueur a-t-il gagné ? winner : 'village' | 'loups' | 'egalite' (égalité : personne ne gagne)
export const didWin = (role, winner) => (winner === 'village' ? role !== 'loup' : winner === 'loups' ? role === 'loup' : false)
