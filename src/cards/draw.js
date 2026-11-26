// ✏️ Dessin bas niveau : polices, texte, noms avec emojis, export JPEG (SVG → JPEG via sharp)
import './fonts.js' // doit rester le premier import : configure les polices avant sharp
import { esc } from '../utils.js'
import { NAME_EMOJI } from './assets.js'
import { textW, EMOJI_W } from './names.js'

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch (e) {
  console.warn('[loup-garou] sharp indisponible :', e.message)
}

export const FONT = 'DejaVu Sans, Arial, Helvetica, sans-serif'

export const txt = (x, y, size, fill, content, { bold = false, anchor = 'middle' } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}"${bold ? ' font-weight="bold"' : ''} fill="${fill}">${esc(content)}</text>`

export const toJpeg = (svg) => {
  if (!sharp) throw new Error('le module « sharp » n’est pas installé')
  return sharp(Buffer.from(svg)).jpeg({ quality: 93 }).toBuffer()
}

// Nom de joueur (segments texte + emojis) dessiné à partir de (x, y)
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
