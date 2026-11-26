// 🎨 Design system des cartes : palette, fond, cadre, en-tête, pastilles, badges, emojis, découpe de texte.
// Règle de lisibilité : sur un téléphone une image de 900 px s’affiche à ~40 % de sa taille →
// aucun texte sous 22 px, corps de texte à 26-30 px, titres à 40 px et plus.
import { EMOJI, NAME_EMOJI } from './assets.js'
import { emojiKey, textW } from './names.js'
import { txt } from './draw.js'

export const W = 900
export const BODY = '#e4e9f1' // texte courant
export const MUTED = '#aab4c3' // texte secondaire (contraste ≥ 7:1 sur le fond)
export const LINE = '#2a3342' // filets
export const GOLD = '#f5a524'
export const HEADER_BOTTOM = 178 // y du filet sous l’en-tête

// Fond dégradé + halo de la couleur d’accent + cadre lumineux à double filet
export const svgPage = (H, color, body, { glow = 0.22 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2334"/><stop offset="1" stop-color="#0c0f16"/></linearGradient>
    <radialGradient id="glow" cx="50%" cy="0%" r="85%"><stop offset="0" stop-color="${color}" stop-opacity="${glow}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>
    <filter id="blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect width="${W}" height="${H}" rx="36" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" rx="36" fill="url(#glow)"/>
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="28" fill="none" stroke="${color}" stroke-width="12" stroke-opacity="0.28" filter="url(#blur)"/>
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="28" fill="none" stroke="${color}" stroke-width="5"/>
  <rect x="36" y="36" width="${W - 72}" height="${H - 72}" rx="18" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.3"/>
  ${body}
</svg>`

// ───────── Images ─────────
// Emoji dessiné avec les images embarquées (assets/emoji-names.json) ; rien si l’emoji est inconnu
export const emojiImg = (char, x, y, size) => {
  const k = emojiKey(char)
  return k && NAME_EMOJI[k] ? `<image href="data:image/png;base64,${NAME_EMOJI[k]}" x="${x}" y="${y}" width="${size}" height="${size}"/>` : ''
}
export const roleImg = (role, x, y, w) => `<image href="${EMOJI[role]}" x="${x}" y="${y}" width="${w}" height="${(w * 207) / 220}"/>`

// ───────── Texte ─────────
// Découpe un texte en lignes qui tiennent dans maxW
export const wrap = (text, size, maxW, { bold = false } = {}) => {
  const k = bold ? 1.12 : 1
  const lines = []
  let cur = ''
  for (const word of text.split(' ')) {
    const test = cur ? `${cur} ${word}` : word
    if (!cur || textW(test, size) * k <= maxW) cur = test
    else {
      lines.push(cur)
      cur = word
    }
  }
  if (cur) lines.push(cur)
  return lines
}
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Plus grande taille ≤ size pour que `text` tienne dans maxW (jamais sous `min`)
export const fitSize = (text, size, maxW, { bold = false, min = 22 } = {}) =>
  Math.max(min, Math.min(size, Math.floor((size * maxW) / Math.max(1, textW(text, size) * (bold ? 1.12 : 1)))))

// ───────── Composants ─────────
// Pastille arrondie. anchor 'middle' : cx = centre ; 'start' : cx = bord gauche. cy = centre vertical.
export const pill = (cx, cy, text, color, { size = 24, anchor = 'middle' } = {}) => {
  const w = Math.round(textW(text, size) * 1.12 + 42)
  const h = size + 22
  const x = anchor === 'middle' ? cx - w / 2 : cx
  return {
    w,
    svg:
      `<rect x="${x.toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-opacity="0.75" stroke-width="2.5"/>` +
      txt((x + w / 2).toFixed(1), (cy + size * 0.35).toFixed(1), size, color, text, { bold: true }),
  }
}

// Badge numéroté (choix 1., 2., … 20.) de largeur fixe
export const badge = (x, cy, label, color, { w = 68, h = 46, size = 28 } = {}) =>
  `<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="13" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-opacity="0.65" stroke-width="2"/>` +
  txt(x + w / 2, cy + size * 0.36, size, color, label, { bold: true })

// Encadré arrondi teinté
export const panel = (x, y, w, h, { fill = '#ffffff', opacity = 0.05, stroke = null, rx = 16 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" fill-opacity="${opacity}"${stroke ? ` stroke="${stroke}" stroke-opacity="0.45" stroke-width="2"` : ''}/>`

export const divider = (y, { x1 = 56, x2 = W - 56 } = {}) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${LINE}" stroke-width="3"/>`

// En-tête commun : icône (svg déjà positionné ~ (50,34) 104 px), titre, sous-titre, filet
export const header = ({ icon, title, subtitle, color }) => {
  const tSize = fitSize(title, 46, W - 190 - 60, { bold: true, min: 30 })
  return (
    icon +
    txt(186, subtitle ? 92 : 108, tSize, color, title, { bold: true, anchor: 'start' }) +
    (subtitle ? txt(186, 140, 26, MUTED, subtitle, { anchor: 'start' }) : '') +
    divider(HEADER_BOTTOM)
  )
}
