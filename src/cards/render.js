// 🎴 Cartes PRIVÉES en image : carte de rôle et carte de choix numérotés (actions de nuit, tir du chasseur…)
import { SELF_DESTRUCT } from '../config.js'
import { ROLES } from '../game/roles.js'
import { nameSegments, displaySegments, fitSegments } from './names.js'
import { txt, toJpeg, nameSvg } from './draw.js'
import { BODY, MUTED, svgPage, roleImg, wrap, fitSize, badge, panel, divider, pill } from './kit.js'

// Carte « grande » : illustration du rôle, titre, camp, 3 lignes d’explication
export const bigCard = ({ role, title, subtitle, lines = [], footer }) => {
  const R = ROLES[role]
  const H = 736
  const titleSize = fitSize(title, 68, 780, { bold: true, min: 38 })
  const body =
    `<defs><radialGradient id="aura" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${R.color}" stop-opacity="0.4"/><stop offset="1" stop-color="${R.color}" stop-opacity="0"/></radialGradient></defs>` +
    `<circle cx="450" cy="160" r="200" fill="url(#aura)"/>` +
    roleImg(role, 330, 38, 240) +
    txt(450, 356, titleSize, R.color, title, { bold: true }) +
    pill(450, 408, subtitle, R.color, { size: 26 }).svg +
    divider(468, { x1: 300, x2: 600 }) +
    lines.map((l, i) => txt(450, 520 + i * 46, fitSize(l, 31, 780), BODY, l)).join('') +
    divider(662) +
    txt(450, 706, 24, MUTED, footer || (SELF_DESTRUCT ? 'Carte secrète • elle s’efface toute seule' : 'Carte secrète • ne la montre à personne'))
  return toJpeg(svgPage(H, R.color, body))
}

// Carte « liste » : choix numérotés + encadré de consignes
export const listCard = ({ role, title, subtitle, items, notes = [] }) => {
  const R = ROLES[role]
  const cols = items.length > 7 ? 2 : 1
  const rows = Math.ceil(items.length / cols)
  const rowH = 64
  const colW = cols === 2 ? 394 : 804
  const subLines = wrap(subtitle || '', 26, 640).slice(0, 2)
  const headerBottom = 178 + (subLines.length > 1 ? 32 : 0)
  const top = headerBottom + 26

  // Les noms identiques sont distingués par les 4 derniers chiffres du numéro
  const key = (p) => nameSegments(p.name).map((x) => x.value).join('|').toLowerCase()
  const counts = new Map()
  for (const p of items) counts.set(key(p), (counts.get(key(p)) || 0) + 1)

  const cells = items
    .map((p, i) => {
      const col = Math.floor(i / rows)
      const row = i % rows
      const x = 48 + col * (colW + 16)
      const y = top + row * rowH
      const segs = fitSegments(displaySegments(p, counts.get(key(p)) > 1), 32, colW - 100)
      return panel(x, y, colW, rowH - 8, { opacity: row % 2 ? 0.03 : 0.07, rx: 14 }) + badge(x + 8, y + (rowH - 8) / 2, `${i + 1}`, R.color) + nameSvg(segs, x + 90, y + (rowH - 8) / 2 + 11, 32, '#ffffff')
    })
    .join('')

  const noteLines = notes.flatMap((n) => wrap(n, 26, 740))
  const listBottom = top + rows * rowH
  const noteH = noteLines.length ? noteLines.length * 38 + 30 : 0
  const H = listBottom + (noteH ? 14 + noteH : 0) + 56
  const noteSvg = noteLines.length
    ? panel(48, listBottom + 14, 804, noteH, { fill: R.color, opacity: 0.1, stroke: R.color, rx: 18 }) +
      noteLines.map((l, i) => txt(450, listBottom + 14 + 36 + i * 38, 26, '#d6dde8', l)).join('')
    : ''

  const body =
    roleImg(role, 48, 38, 112) +
    txt(186, 96, fitSize(title, 48, 640, { bold: true, min: 32 }), R.color, title, { bold: true, anchor: 'start' }) +
    subLines.map((l, i) => txt(186, 140 + i * 32, 26, MUTED, l, { anchor: 'start' })).join('') +
    divider(headerBottom) +
    cells +
    noteSvg
  return toJpeg(svgPage(H, R.color, body, { glow: 0.18 }))
}
