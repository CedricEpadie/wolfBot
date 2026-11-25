// 🧩 Briques de dessin communes aux cartes publiques (info, fin de partie) : cadre, emojis, découpe de texte
import { EMOJI, NAME_EMOJI } from './assets.js'
import { emojiKey, textW } from './names.js'

export const W = 900
export const BODY = '#d7dce3'
export const MUTED = '#9aa4b2'

export const svgPage = (H, color, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" rx="36" fill="#14181f"/>
  <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="28" fill="none" stroke="${color}" stroke-width="5"/>
  ${body}
</svg>`

// Emoji dessiné avec les images embarquées (assets/emoji-names.json) ; rien si l’emoji est inconnu
export const emojiImg = (char, x, y, size) => {
  const k = emojiKey(char)
  return k && NAME_EMOJI[k] ? `<image href="data:image/png;base64,${NAME_EMOJI[k]}" x="${x}" y="${y}" width="${size}" height="${size}"/>` : ''
}
export const roleImg = (role, x, y, w) => `<image href="${EMOJI[role]}" x="${x}" y="${y}" width="${w}" height="${(w * 207) / 220}"/>`

// Découpe un texte en lignes qui tiennent dans maxW
export const wrap = (text, size, maxW) => {
  const lines = []
  let cur = ''
  for (const word of text.split(' ')) {
    const test = cur ? `${cur} ${word}` : word
    if (!cur || textW(test, size) <= maxW) cur = test
    else {
      lines.push(cur)
      cur = word
    }
  }
  if (cur) lines.push(cur)
  return lines
}
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
