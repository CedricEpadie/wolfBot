// 🗂️ Cartes d’information PUBLIQUES en image : règles, rôles, composition des parties.
// (Cartes privées : render.js • cartes de fin de partie : endCards.js • design system : kit.js)
import { MIN_PLAYERS, MAX_PLAYERS, VOYANTE_REVEAL_NAME, MAYOR, P, NECROMANCER, MENTALIST, NECRO_MIN_PLAYERS, MENTALIST_MIN_PLAYERS } from '../config.js'
import { ROLES, ROLE_ORDER, composition, countRoles } from '../game/roles.js'
import { txt, toJpeg } from './draw.js'
import { W, BODY, MUTED, GOLD, svgPage, emojiImg, roleImg, wrap, cap, fitSize, pill, panel, divider, header } from './kit.js'

const headerIcon = roleImg('loup', 48, 36, 108)

// ───────── Règles ─────────
const ruleSections = () => [
  {
    icon: '🎯',
    title: 'Objectif',
    color: GOLD,
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
      { icon: '⏰', text: `Les rôles se réveillent un à un${NECROMANCER ? ' (le Nécromancien en premier)' : ''}, puis le Garde, la Voyante, les Loups et la Sorcière.` },
      { icon: '📩', text: 'Chaque pouvoir s’utilise en privé : réponds par le numéro affiché sur ta carte.' },
      { icon: '🔮', text: `La Voyante est bavarde : le rôle qu’elle découvre est annoncé à tous${VOYANTE_REVEAL_NAME ? ', avec le nom du joueur' : ' (sans le nom)'}.` },
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
    icon: '👻',
    title: 'Les morts',
    color: '#9fb0cc',
    items: [
      { icon: '🤐', text: 'Les morts ne parlent plus dans le groupe principal : leurs messages sont supprimés.' },
      NECROMANCER && { icon: '👻', text: 'Ils se retrouvent dans un groupe des morts, où le Nécromancien vient les interroger la nuit. Ils peuvent mentir !' },
    ],
  },
]

export const rulesCard = () => {
  const textX = 122
  const maxW = W - textX - 60
  let y = 212
  let body = header({ icon: headerIcon, title: 'RÈGLES DU LOUP-GAROU', subtitle: `${MIN_PLAYERS} à ${MAX_PLAYERS} joueurs`, color: GOLD })
  for (const sec of ruleSections()) {
    body += panel(48, y, W - 96, 62, { fill: sec.color, opacity: 0.16, stroke: sec.color, rx: 16 })
    body += emojiImg(sec.icon, 66, y + 10, 42) + txt(124, y + 42, 31, sec.color, sec.title, { bold: true, anchor: 'start' })
    y += 62 + 22
    for (const it of sec.items.filter(Boolean)) {
      const lines = wrap(it.text, 27, maxW)
      body += emojiImg(it.icon, 68, y - 2, 38) + lines.map((l, i) => txt(textX, y + 28 + i * 36, 27, BODY, l, { anchor: 'start' })).join('')
      y += Math.max(40, lines.length * 36) + 18
    }
    y += 12
  }
  body += divider(y)
  body += txt(W / 2, y + 48, 25, MUTED, `${P}loup roles : les rôles et leurs pouvoirs`)
  return toJpeg(svgPage(y + 108, GOLD, body))
}

// ───────── Rôles ─────────
export const rolesCard = () => {
  const textX = 200
  const maxW = W - textX - 60
  let y = 212
  let body = header({ icon: headerIcon, title: 'LES RÔLES', subtitle: 'Pouvoirs et camps', color: GOLD })
  ROLE_ORDER.forEach((r, i) => {
    const R = ROLES[r]
    const lines = wrap(cap(R.short), 26, maxW)
    const rowH = 84 + lines.length * 34 + 22
    const labelSize = fitSize(R.label, 34, 400, { bold: true })
    const campText = R.camp.includes('Loups') ? 'Loups-Garous' : 'Village'
    const campColor = campText === 'Village' ? '#7fb2ff' : '#ff6b6b'
    const pillW = pill(0, 0, campText, campColor, { size: 22, anchor: 'start' }).w
    body += roleImg(r, 56, y + 6, 112)
    body += txt(textX, y + 40, labelSize, R.color, R.label, { bold: true, anchor: 'start' })
    body += pill(W - 60 - pillW, y + 30, campText, campColor, { size: 22, anchor: 'start' }).svg
    body += lines.map((l, k) => txt(textX, y + 84 + k * 34, 26, BODY, l, { anchor: 'start' })).join('')
    y += rowH
    if (i < ROLE_ORDER.length - 1) body += divider(y - 6, { x1: 70, x2: W - 70 })
  })
  body += txt(W / 2, y + 36, 25, MUTED, `${P}loup regles : les règles du jeu`)
  return toJpeg(svgPage(y + 96, GOLD, body))
}

// ───────── Composition ─────────
// highlight = nombre de joueurs de la partie en cours (ligne mise en valeur)
export const compositionCard = ({ highlight = null } = {}) => {
  const rowH = 54
  const colX = (i) => 270 + i * 80
  const headY = 206
  const rowsTop = headY + 102
  let body = header({
    icon: headerIcon,
    title: 'COMPOSITION',
    subtitle: highlight ? `Cette partie : ${highlight} joueurs` : 'Les rôles selon le nombre de joueurs',
    color: GOLD,
  })
  body += txt(64, headY + 52, 24, MUTED, 'Joueurs', { anchor: 'start' })
  ROLE_ORDER.forEach((r, i) => {
    body += roleImg(r, colX(i) - 27, headY + 10, 54)
  })
  body += divider(headY + 82)
  let y = rowsTop
  for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
    const counts = countRoles(composition(n))
    if (n === highlight) body += panel(40, y - 8, W - 80, rowH - 4, { fill: GOLD, opacity: 0.16, stroke: GOLD, rx: 14 })
    else if (n % 2) body += panel(40, y - 8, W - 80, rowH - 4, { opacity: 0.035, rx: 12 })
    body += txt(70, y + 30, 31, n === highlight ? '#ffd27a' : '#ffffff', `${n}`, { bold: true, anchor: 'start' })
    ROLE_ORDER.forEach((r, i) => {
      const k = counts[r] || 0
      body += txt(colX(i), y + 31, 31, k ? ROLES[r].color : '#4a5568', k ? `${k}` : '–', { bold: !!k })
    })
    y += rowH
  }
  const extra = [NECROMANCER && `Nécromancien dès ${NECRO_MIN_PLAYERS} joueurs`, MENTALIST && `Mentaliste dès ${MENTALIST_MIN_PLAYERS} joueurs`].filter(Boolean)
  body += divider(y + 6)
  body += txt(W / 2, y + 48, 25, MUTED, '1 loup tous les 3 joueurs • 4 rôles spéciaux de base')
  if (extra.length) body += txt(W / 2, y + 84, 25, MUTED, extra.join(' • '))
  return toJpeg(svgPage(y + (extra.length ? 144 : 108), GOLD, body))
}
