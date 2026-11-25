// 🎴 Génération des cartes en image (SVG → JPEG via sharp)
import './fonts.js' // doit rester le premier import : configure les polices avant sharp
import { esc } from '../utils.js'
import { ROLES } from '../game/roles.js'
import { EMOJI, NAME_EMOJI } from './assets.js'
import { nameSegments, displaySegments, fitSegments, textW, EMOJI_W } from './names.js'

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch (e) {
  console.warn('[loup-garou] sharp indisponible :', e.message)
}

const FONT = 'DejaVu Sans, Arial, Helvetica, sans-serif'
export const txt = (x, y, size, fill, content, { bold = false, anchor = 'middle' } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}"${bold ? ' font-weight="bold"' : ''} fill="${fill}">${esc(content)}</text>`
export const toJpeg = (svg) => {
  if (!sharp) throw new Error('le module « sharp » n’est pas installé')
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer()
}

// Carte « grande » : emoji du rôle, titre, sous-titre, lignes de texte
export const bigCard = ({ role, title, subtitle, lines = [], footer }) => {
  const R = ROLES[role]
  const body = lines.map((l, i) => txt(450, 400 + i * 40, 27, '#d7dce3', l)).join('')
  const titleSize = Math.max(34, Math.min(58, Math.floor(800 / (title.length * 0.68))))
  return toJpeg(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <rect width="900" height="620" rx="36" fill="#14181f"/>
  <rect x="22" y="22" width="856" height="576" rx="28" fill="none" stroke="${R.color}" stroke-width="5"/>
  <image href="${EMOJI[role]}" x="340" y="44" width="220" height="207"/>
  ${txt(450, 305, titleSize, R.color, title, { bold: true })}
  ${txt(450, 352, 27, '#9aa4b2', subtitle)}
  ${body}
  ${txt(450, 575, 22, '#7d8794', footer || 'Ne montre cette carte à personne • elle s’efface toute seule')}
</svg>`)
}

// Carte « liste » : choix numérotés (action de nuit, tir du chasseur…)
export const listCard = ({ role, title, subtitle, items, notes = [] }) => {
  const R = ROLES[role]
  const cols = items.length > 8 ? 2 : 1
  const rows = Math.ceil(items.length / cols)
  const rowH = 52
  const top = 215
  const maxW = cols === 2 ? 326 : 740
  const counts = new Map()
  for (const p of items) {
    const k = nameSegments(p.name).map((x) => x.value).join('|').toLowerCase()
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const noteY = top + rows * rowH + 20
  const H = noteY + notes.length * 36 + 50
  const cells = items
    .map((p, i) => {
      const col = Math.floor(i / rows)
      const row = i % rows
      const x = 50 + col * 420
      const y = top + row * rowH + 34
      const dup = counts.get(nameSegments(p.name).map((z) => z.value).join('|').toLowerCase()) > 1
      const segs = fitSegments(displaySegments(p, dup), 32, maxW)
      return txt(x, y, 32, R.color, `${i + 1}.`, { bold: true, anchor: 'start' }) + nameSvg(segs, x + 62, y, 32, '#ffffff')
    })
    .join('')
  const noteSvg = notes.map((n, i) => txt(450, noteY + 26 + i * 36, 23, '#aeb6c2', n)).join('')
  return toJpeg(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${H}" viewBox="0 0 900 ${H}">
  <rect width="900" height="${H}" rx="36" fill="#14181f"/>
  <rect x="22" y="22" width="856" height="${H - 44}" rx="28" fill="none" stroke="${R.color}" stroke-width="5"/>
  <image href="${EMOJI[role]}" x="48" y="40" width="124" height="116"/>
  ${txt(195, 92, 44, R.color, title, { bold: true, anchor: 'start' })}
  ${txt(195, 138, 25, '#9aa4b2', subtitle, { anchor: 'start' })}
  <line x1="48" y1="176" x2="852" y2="176" stroke="#2b323d" stroke-width="3"/>
  ${cells}
  ${noteSvg}
</svg>`)
}

export const nameSvg = (segs, x, y, size, fill) => {
  let cx = x
  let out = ''
  for (const s of segs) {
    if (s.type === 'emoji') {
      out += `<image href="data:image/png;base64,${NAME_EMOJI[s.value]}" x="${cx.toFixed(1)}" y="${(y - size * 0.85).toFixed(1)}" width="${(size * 1.06).toFixed(1)}" height="${size.toFixed(1)}"/>`
      cx += size * EMOJI_W
    } else {
      out += `<text x="${cx.toFixed(1)}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}" xml:space="preserve">${esc(s.value)}</text>`
      cx += textW(s.value, size)
    }
  }
  return out
}
