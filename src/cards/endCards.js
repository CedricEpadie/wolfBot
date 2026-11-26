// 🏁 Cartes de FIN DE PARTIE en image : récap des rôles et podium du groupe.
import { P } from '../config.js'
import { ROLES, ROLE_ORDER, didWin } from '../game/roles.js'
import { displaySegments, fitSegments, nameSegments, textW } from './names.js'
import { txt, toJpeg, nameSvg } from './draw.js'
import { W, MUTED, GOLD, HEADER_BOTTOM, svgPage, emojiImg, roleImg, fitSize, panel, divider, header } from './kit.js'

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
// short = version compacte pour les colonnes étroites
const deathText = (p, short = false) => {
  if (p.alive) return 'Survivant'
  const d = p.death
  if (!d) return 'Mort'
  const full = {
    wolves: `Nuit ${d.no} · dévoré par les loups`,
    poison: `Nuit ${d.no} · empoisonné`,
    vote: `Jour ${d.no} · éliminé par le vote`,
    hunter: `Jour ${d.no} · abattu par le chasseur`,
  }
  const compact = { wolves: `Nuit ${d.no} · dévoré`, poison: `Nuit ${d.no} · poison`, vote: `Jour ${d.no} · vote`, hunter: `Jour ${d.no} · abattu` }
  return (short ? compact : full)[d.kind] || 'Mort'
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
  const survivors = g.players.filter((p) => p.alive).length
  // Jusqu’à 10 joueurs : une colonne. Au-delà : deux colonnes, pour garder une image de taille raisonnable.
  const two = rows.length > 10
  const perCol = two ? Math.ceil(rows.length / 2) : rows.length
  const colW = two ? 394 : W - 96
  const nameSize = two ? 29 : 33
  const lblSize = two ? 22 : 25
  const iconSize = two ? 34 : 44
  const imgW = two ? 58 : 70
  const textOff = two ? 82 : 102

  // Une colonne : rôle et statut sur la même ligne s’ils tiennent, sinon sur deux lignes
  const sameLine = (p, iconsW) => {
    const room = colW - textOff - iconsW * (iconSize + 8) - 20
    return textW(ROLES[p.role].label, lblSize) * 1.12 + 16 + textW(`• ${deathText(p)}`, lblSize) <= room
  }
  const iconsOf = (p) => (didWin(p.role, winner) ? 1 : 0) + (p.wasMayor ? 1 : 0)
  const lines3 = two || rows.some((p) => !sameLine(p, iconsOf(p)))
  const rowH = two ? 112 : lines3 ? 120 : 96

  const title = WIN_TITLE[winner] || WIN_TITLE.egalite
  const icon = winner === 'village' ? roleImg('villageois', 48, 36, 108) : winner === 'loups' ? roleImg('loup', 48, 36, 108) : emojiImg('💀', 52, 40, 100)
  let body = header({ icon, title, subtitle: `${g.players.length} joueurs • ${g.nightNo || 0} nuit(s) • ${survivors} survivant(s)`, color })
  const top = HEADER_BOTTOM + 30

  rows.forEach((p, i) => {
    const col = two ? Math.floor(i / perCol) : 0
    const x0 = 48 + col * (colW + 16)
    const y = top + (i % perCol) * rowH
    const R = ROLES[p.role]
    const won = didWin(p.role, winner)
    if (won) body += panel(x0, y - 6, colW, rowH - 8, { fill: color, opacity: 0.14, rx: 18 })
    // Icônes à droite : 👑 maire, 🏆 vainqueur
    let rx = x0 + colW - iconSize - 14
    if (won) {
      body += emojiImg('🏆', rx, y + 2, iconSize)
      rx -= iconSize + 8
    }
    if (p.wasMayor) body += emojiImg('👑', rx, y + 2, iconSize)
    const iconsW = iconsOf(p)
    const textX = x0 + textOff
    body += roleImg(p.role, x0 + 14, y + 2, imgW)
    const nameMax = colW - textOff - iconsW * (iconSize + 8) - 16
    body += nameSvg(fitSegments(displaySegments(p, dup(p)), nameSize, nameMax), textX, y + nameSize + 2, nameSize, p.alive ? '#ffffff' : '#c3cad6')
    const l1 = y + nameSize + 2 + lblSize + 10
    body += txt(textX, l1, lblSize, R.color, R.label, { bold: true, anchor: 'start' })
    if (!two && sameLine(p, iconsW)) {
      body += txt(textX + textW(R.label, lblSize) * 1.12 + 16, l1, lblSize, MUTED, `• ${deathText(p)}`, { anchor: 'start' })
    } else {
      body += txt(textX, l1 + lblSize + 8, lblSize, MUTED, deathText(p, two), { anchor: 'start' })
    }
  })

  const H = top + perCol * rowH + 92
  body += divider(H - 80)
  body += txt(W / 2, H - 36, fitSize(`${P}loup top : classement • ${P}loup stats : tes statistiques`, 25, 800), MUTED, `${P}loup top : classement • ${P}loup stats : tes statistiques`)
  return toJpeg(svgPage(H, color, body))
}

// ───────── Podium du groupe ─────────
const MEDAL = ['🥇', '🥈', '🥉']
const BLOCK = [
  { color: GOLD, h: 250, x: 450 },
  { color: '#b4bcc8', h: 192, x: 176 },
  { color: '#cd8a52', h: 150, x: 724 },
]

// entries : résultat de topOf() (déjà triés) • gained : Set des jids ayant gagné la partie qui vient de se terminer
export const podiumCard = ({ entries, gained = new Set() }) => {
  const dup = dupCounter(entries)
  const asPlayer = (e) => ({ name: e.name, num: e.jid.split('@')[0].split(':')[0] })
  const top3 = entries.filter((e) => e.wins > 0).slice(0, 3) // le podium est réservé à ceux qui ont gagné…
  const rest = entries.filter((e) => !top3.includes(e)).slice(0, 20 - top3.length) // …les autres figurent dans la liste
  const base = top3.length ? 660 : HEADER_BOTTOM + 10
  const listTop = base + (top3.length ? 62 : 44)
  const rowH = 58
  const H = listTop + rest.length * rowH + 98

  let body = header({ icon: emojiImg('🏆', 50, 40, 100), title: 'CLASSEMENT', subtitle: 'Les meilleurs chasseurs de loups', color: GOLD })

  top3.forEach((e, i) => {
    const b = BLOCK[i]
    const topY = base - b.h
    const segs = fitSegments(displaySegments(asPlayer(e), dup(e)), 31, 240)
    const nameW = segs.reduce((w, s) => w + (s.type === 'emoji' ? 31 * 1.06 : textW(s.value, 31)), 0)
    body += emojiImg(MEDAL[i], b.x - 42, topY - 156, 84)
    body += nameSvg(segs, b.x - nameW / 2, topY - 20, 31, '#ffffff')
    body += panel(b.x - 120, topY, 240, b.h, { fill: b.color, opacity: 1, rx: 20 })
    body += txt(b.x, topY + 84, 74, '#14181f', `${e.wins}`, { bold: true })
    body += txt(b.x, topY + 120, 26, '#14181f', e.wins > 1 ? 'victoires' : 'victoire', { bold: true })
    if (b.h >= 190) body += txt(b.x, topY + 156, 24, '#2a2f3a', `${e.played} parties`)
    if (gained.has(e.jid)) body += txt(b.x + 108, topY + 38, 30, '#0b6b34', '+1', { bold: true, anchor: 'end' })
  })
  if (top3.length) body += divider(base + 18)

  rest.forEach((e, i) => {
    const y = listTop + i * rowH
    const segs = fitSegments(displaySegments(asPlayer(e), dup(e)), 30, 400)
    if (i % 2 === 0) body += panel(40, y - 38, W - 80, rowH - 4, { opacity: 0.045, rx: 14 })
    body += txt(66, y, 30, GOLD, `${i + top3.length + 1}.`, { bold: true, anchor: 'start' })
    body += nameSvg(segs, 140, y, 30, '#ffffff')
    body += txt(W - 66, y, 26, MUTED, `${e.wins} victoire${e.wins > 1 ? 's' : ''} / ${e.played}`, { anchor: 'end' })
    if (gained.has(e.jid)) body += txt(W - 360, y, 28, '#3ddc84', '+1', { bold: true, anchor: 'end' })
  })
  body += txt(W / 2, H - 42, 25, MUTED, `${P}loup stats : tes statistiques • ${P}loup : rejouer`)
  return toJpeg(svgPage(H, GOLD, body))
}
