// 🏁 Cartes de FIN DE PARTIE en image : récap des rôles et podium du groupe.
import { P } from '../config.js'
import { ROLES, ROLE_ORDER, didWin } from '../game/roles.js'
import { displaySegments, fitSegments, nameSegments, textW } from './names.js'
import { nameSvg, txt, toJpeg } from './render.js'
import { W, MUTED, svgPage, emojiImg, roleImg } from './kit.js'

const GOLD = '#f5a524'
const WIN_COLOR = { village: '#3ddc84', loups: ROLES.loup.color, egalite: '#9aa4b2' }
const WIN_TITLE = { village: 'LE VILLAGE GAGNE !', loups: 'LES LOUPS-GAROUS GAGNENT !', egalite: 'ÉGALITÉ !' }

// Les noms identiques sont distingués par les 4 derniers chiffres du numéro (comme sur les cartes de nuit)
const dupCounter = (players) => {
  const key = (p) => nameSegments(p.name).map((x) => x.value).join('|').toLowerCase()
  const counts = new Map()
  for (const p of players) counts.set(key(p), (counts.get(key(p)) || 0) + 1)
  return (p) => counts.get(key(p)) > 1
}

// ───────── Récap des rôles ─────────
const deathText = (p) => {
  if (p.alive) return 'Survivant'
  const d = p.death
  if (!d) return 'Mort'
  return {
    wolves: `Nuit ${d.no} · dévoré par les loups`,
    poison: `Nuit ${d.no} · empoisonné`,
    vote: `Jour ${d.no} · éliminé par le vote`,
    hunter: `Jour ${d.no} · abattu par le chasseur`,
  }[d.kind] || 'Mort'
}

// Vainqueurs d’abord, puis les survivants, puis par ordre de mort
const recapOrder = (g, winner) => {
  const rank = (p) => [didWin(p.role, winner) ? 0 : 1, p.alive ? 0 : 1, p.death?.no ?? 99, ROLE_ORDER.indexOf(p.role)]
  return [...g.players].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
    return 0
  })
}

export const recapCard = (g, winner) => {
  const color = WIN_COLOR[winner] || WIN_COLOR.egalite
  const rows = recapOrder(g, winner)
  const dup = dupCounter(g.players)
  const rowH = 78
  const top = 196
  const survivors = g.players.filter((p) => p.alive).length

  let body = winner === 'village' ? roleImg('villageois', 52, 34, 120) : winner === 'loups' ? roleImg('loup', 52, 34, 120) : emojiImg('💀', 62, 40, 100)
  body += txt(196, 92, 40, color, WIN_TITLE[winner] || WIN_TITLE.egalite, { bold: true, anchor: 'start' })
  body += txt(196, 134, 24, MUTED, `${g.players.length} joueurs • ${g.nightNo || 0} nuit(s) • ${survivors} survivant(s)`, { anchor: 'start' })
  body += `<line x1="48" y1="${top - 22}" x2="${W - 48}" y2="${top - 22}" stroke="#2b323d" stroke-width="3"/>`

  rows.forEach((p, i) => {
    const y = top + i * rowH
    const R = ROLES[p.role]
    const won = didWin(p.role, winner)
    if (won) body += `<rect x="40" y="${y - 6}" width="${W - 80}" height="${rowH - 6}" rx="16" fill="${color}" fill-opacity="0.13"/>`
    body += roleImg(p.role, 56, y + 2, 64)
    const segs = fitSegments(displaySegments(p, dup(p)), 30, 470)
    body += nameSvg(segs, 142, y + 32, 30, p.alive ? '#ffffff' : '#b6bdc9')
    const label = R.label
    body += txt(142, y + 60, 20, R.color, label, { bold: true, anchor: 'start' })
    body += txt(142 + textW(label, 20) * 1.12 + 14, y + 60, 20, MUTED, `• ${deathText(p)}`, { anchor: 'start' })
    let rx = W - 100
    if (won) {
      body += emojiImg('🏆', rx, y + 8, 44)
      rx -= 56
    }
    if (p.wasMayor) body += emojiImg('👑', rx, y + 8, 44)
  })

  const H = top + rows.length * rowH + 84
  body += txt(W / 2, H - 44, 22, MUTED, `${P}loup top : classement • ${P}loup stats : tes statistiques`)
  return toJpeg(svgPage(H, color, body))
}

// ───────── Podium du groupe ─────────
const MEDAL = ['🥇', '🥈', '🥉']
const BLOCK = [
  { color: GOLD, h: 232, x: 450 },
  { color: '#aeb6c2', h: 172, x: 178 },
  { color: '#c8814a', h: 132, x: 722 },
]

// entries : résultat de topOf() (déjà triés) • gained : Set des jids ayant gagné la partie qui vient de se terminer
export const podiumCard = ({ entries, gained = new Set() }) => {
  const dup = dupCounter(entries)
  const asPlayer = (e) => ({ name: e.name, num: e.jid.split('@')[0].split(':')[0] })
  const base = 640
  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3, 10)
  const H = base + 50 + rest.length * 50 + 92

  let body = emojiImg('🏆', 52, 44, 92) + txt(166, 98, 42, GOLD, 'CLASSEMENT', { bold: true, anchor: 'start' })
  body += txt(166, 136, 24, MUTED, 'Les plus grands chasseurs de loups du groupe', { anchor: 'start' })
  body += `<line x1="48" y1="170" x2="${W - 48}" y2="170" stroke="#2b323d" stroke-width="3"/>`

  top3.forEach((e, i) => {
    const b = BLOCK[i]
    const topY = base - b.h
    const segs = fitSegments(displaySegments(asPlayer(e), dup(e)), 28, 236)
    const nameW = segs.reduce((w, s) => w + (s.type === 'emoji' ? 28 * 1.06 : textW(s.value, 28)), 0)
    body += emojiImg(MEDAL[i], b.x - 40, topY - 150, 80)
    body += nameSvg(segs, b.x - nameW / 2, topY - 18, 28, '#ffffff')
    body += `<rect x="${b.x - 118}" y="${topY}" width="236" height="${b.h}" rx="18" fill="${b.color}"/>`
    body += txt(b.x, topY + 76, 68, '#14181f', `${e.wins}`, { bold: true })
    body += txt(b.x, topY + 108, 22, '#14181f', e.wins > 1 ? 'victoires' : 'victoire', { bold: true })
    if (b.h >= 170) body += txt(b.x, topY + 140, 20, '#14181f', `${e.played} parties`)
    if (gained.has(e.jid)) body += txt(b.x + 104, topY + 32, 24, '#0e6b38', '+1', { bold: true, anchor: 'end' })
  })
  body += `<line x1="48" y1="${base}" x2="${W - 48}" y2="${base}" stroke="#2b323d" stroke-width="3"/>`

  rest.forEach((e, i) => {
    const y = base + 54 + i * 50
    const segs = fitSegments(displaySegments(asPlayer(e), dup(e)), 28, 460)
    body += txt(60, y, 28, GOLD, `${i + 4}.`, { bold: true, anchor: 'start' })
    body += nameSvg(segs, 122, y, 28, '#ffffff')
    body += txt(W - 60, y, 24, MUTED, `${e.wins} victoire${e.wins > 1 ? 's' : ''} / ${e.played}`, { anchor: 'end' })
    if (gained.has(e.jid)) body += txt(W - 290, y, 24, '#3ddc84', '+1', { bold: true, anchor: 'end' })
  })
  body += txt(W / 2, H - 46, 22, MUTED, `${P}loup stats : tes statistiques • ${P}loup : rejouer`)
  return toJpeg(svgPage(H, GOLD, body))
}
