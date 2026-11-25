// 🗂️ Cartes d’information PUBLIQUES en image : règles, rôles, composition des parties.
// (Les cartes privées — rôle, choix de nuit — sont dans render.js / roleCard.js.)
import { MIN_PLAYERS, MAX_PLAYERS, VOYANTE_REVEAL_NAME, MAYOR, P } from '../config.js'
import { ROLES, ROLE_ORDER, composition, countRoles } from '../game/roles.js'
import { txt, toJpeg } from './render.js'
import { W, BODY, MUTED, svgPage, emojiImg, roleImg, wrap, cap } from './kit.js'


// ───────── Règles ─────────
const ruleSections = () => [
  {
    icon: '🎯',
    title: 'Objectif',
    color: '#f5a524',
    items: [
      { icon: '🏡', text: 'Village : démasquer et éliminer tous les loups-garous.' },
      { icon: '🐺', text: 'Loups-Garous : devenir aussi nombreux que les autres joueurs.' },
    ],
  },
  {
    icon: '🌙',
    title: 'La nuit — le groupe est fermé',
    color: '#b57cff',
    items: [
      { icon: '⏰', text: 'Réveils dans l’ordre : Garde → Voyante → Loups → Sorcière.' },
      { icon: '📩', text: 'Chaque pouvoir s’utilise en privé : réponds par le numéro affiché sur ta carte.' },
    ],
  },
  {
    icon: '☀️',
    title: 'Le jour — le groupe est rouvert',
    color: '#4dc3ff',
    items: [
      { icon: '💀', text: 'Annonce des morts (et de leur rôle), puis débat.' },
      { icon: '🗳️', text: 'Vote public : mentionne (@) le suspect. Le plus voté est éliminé.' },
      MAYOR
        ? { icon: '👑', text: 'Jour 1 : élection du maire. Sa voix compte double, il tranche les égalités et désigne son successeur s’il meurt.' }
        : { icon: '⚖️', text: 'En cas d’égalité, personne n’est éliminé.' },
    ],
  },
  {
    icon: '✨',
    title: 'Les pouvoirs',
    color: '#3ddc84',
    items: [
      { icon: '🛡️', text: 'Garde : protège un joueur, jamais le même deux nuits de suite.' },
      { icon: '🧙‍♀️', text: 'Sorcière : 1 potion de vie, 1 potion de mort, une seule par nuit.' },
      { icon: '🏹', text: 'Chasseur : en mourant, il emporte un joueur avec lui.' },
      { icon: '🔮', text: `Voyante : le rôle qu’elle découvre est annoncé à tous${VOYANTE_REVEAL_NAME ? ', avec le nom du joueur' : ' (sans le nom)'}.` },
      { icon: '🤐', text: 'Les morts ne parlent plus : leurs messages sont supprimés.' },
    ],
  },
]

export const rulesCard = () => {
  const textX = 112
  const maxW = W - textX - 56
  let y = 150
  let body = `${roleImg('loup', 52, 36, 92)}${txt(165, 100, 42, '#f5a524', 'RÈGLES DU LOUP-GAROU', { bold: true, anchor: 'start' })}<line x1="48" y1="140" x2="${W - 48}" y2="140" stroke="#2b323d" stroke-width="3"/>`
  for (const sec of ruleSections()) {
    y += 22
    body += emojiImg(sec.icon, 52, y, 42) + txt(108, y + 33, 31, sec.color, sec.title, { bold: true, anchor: 'start' })
    y += 62
    for (const it of sec.items) {
      const lines = wrap(it.text, 25, maxW)
      body += emojiImg(it.icon, 62, y, 34) + lines.map((l, i) => txt(textX, y + 26 + i * 32, 25, BODY, l, { anchor: 'start' })).join('')
      y += Math.max(34, lines.length * 32) + 16
    }
  }
  y += 16
  body += `<line x1="48" y1="${y}" x2="${W - 48}" y2="${y}" stroke="#2b323d" stroke-width="3"/>`
  body += txt(W / 2, y + 42, 23, MUTED, `${MIN_PLAYERS} à ${MAX_PLAYERS} joueurs • ${P}loup roles : rôles et composition`)
  return toJpeg(svgPage(y + 80, '#f5a524', body))
}

// ───────── Rôles ─────────
export const rolesCard = () => {
  const rowH = 158
  const top = 150
  let body = `${roleImg('loup', 52, 36, 92)}${txt(165, 100, 42, '#f5a524', 'LES RÔLES', { bold: true, anchor: 'start' })}<line x1="48" y1="140" x2="${W - 48}" y2="140" stroke="#2b323d" stroke-width="3"/>`
  ROLE_ORDER.forEach((r, i) => {
    const R = ROLES[r]
    const y = top + i * rowH
    const lines = wrap(cap(R.short), 24, W - 190 - 90)
    body += roleImg(r, 56, y + 16, 100)
    body += txt(190, y + 44, 32, R.color, R.label, { bold: true, anchor: 'start' })
    body += txt(190, y + 74, 20, MUTED, R.camp.replace('Camp : ', 'Camp • '), { anchor: 'start' })
    body += lines.map((l, k) => txt(190, y + 106 + k * 28, 24, BODY, l, { anchor: 'start' })).join('')
    if (i < ROLE_ORDER.length - 1) body += `<line x1="70" y1="${y + rowH - 4}" x2="${W - 70}" y2="${y + rowH - 4}" stroke="#222a35" stroke-width="2"/>`
  })
  const H = top + ROLE_ORDER.length * rowH + 40
  body += txt(W / 2, H - 22, 22, MUTED, `${MIN_PLAYERS} à ${MAX_PLAYERS} joueurs • ${P}loup regles : les règles`)
  return toJpeg(svgPage(H + 20, '#f5a524', body))
}

// ───────── Composition ─────────
// highlight = nombre de joueurs de la partie en cours (ligne mise en valeur)
export const compositionCard = ({ highlight = null } = {}) => {
  const rowH = 50
  const colX = (i) => 300 + i * 94
  const headY = highlight ? 190 : 160
  const rowsTop = headY + 90
  let body = `${roleImg('loup', 52, 36, 92)}${txt(165, 90, 40, '#f5a524', 'COMPOSITION', { bold: true, anchor: 'start' })}`
  body += txt(165, 126, 23, highlight ? '#ffd27a' : MUTED, highlight ? `Cette partie : ${highlight} joueurs` : 'Les rôles selon le nombre de joueurs', { anchor: 'start' })
  body += `<line x1="48" y1="${headY - 22}" x2="${W - 48}" y2="${headY - 22}" stroke="#2b323d" stroke-width="3"/>`
  body += txt(60, headY + 46, 22, MUTED, 'Joueurs', { anchor: 'start' })
  ROLE_ORDER.forEach((r, i) => {
    body += roleImg(r, colX(i) - 28, headY + 8, 56)
  })
  let y = rowsTop
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    const counts = countRoles(composition(n))
    if (n === highlight) body += `<rect x="40" y="${y - 6}" width="${W - 80}" height="${rowH - 4}" rx="14" fill="#262e3b" stroke="#f5a524" stroke-width="3"/>`
    body += txt(60, y + 30, 28, n === highlight ? '#ffd27a' : '#ffffff', `${n}`, { bold: true, anchor: 'start' })
    ROLE_ORDER.forEach((r, i) => {
      const k = counts[r] || 0
      body += txt(colX(i), y + 31, 28, k ? ROLES[r].color : '#4a5360', k ? `${k}` : '–', { bold: !!k })
    })
    y += rowH
  }
  body += txt(W / 2, y + 36, 22, MUTED, '4 rôles spéciaux + 1 loup tous les 3 joueurs, le reste en villageois')
  return toJpeg(svgPage(y + 70, '#f5a524', body))
}
