// 🔤 Noms des joueurs : nettoyage, emojis, mesure de largeur pour les cartes
import { NAME_EMOJI, METRICS } from './assets.js'

// Les noms WhatsApp contiennent souvent des emojis, des lettres « fantaisie » (𝓤𝓻𝓼𝓾𝓵𝓮, ＵＲＳＵＬＥ…) ou des symboles.
// NFKC remet les lettres fantaisie en lettres normales ; les emojis sont dessinés avec des images ;
// les caractères que la police ne sait pas afficher sont supprimés (pas de carrés vides).
const SEGMENTER = typeof Intl?.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u
const isSkin = (cp) => cp >= 0x1f3fb && cp <= 0x1f3ff

export const emojiKey = (g) => {
  const cps = [...g].map((c) => c.codePointAt(0)).filter((c) => c !== 0xfe0f)
  const tries = [cps, cps.filter((c) => !isSkin(c))]
  const zwj = cps.indexOf(0x200d)
  if (zwj > 0) tries.push(cps.slice(0, zwj).filter((c) => !isSkin(c)))
  tries.push(cps.slice(0, 1))
  for (const t of tries) {
    const k = t.map((c) => c.toString(16)).join('-')
    if (NAME_EMOJI[k]) return k
  }
  return null
}

// Découpe un nom en morceaux { type: 'text' | 'emoji', value }
export const nameSegments = (raw) => {
  const str = String(raw || '').normalize('NFKC')
  const out = []
  const push = (type, value) => {
    const last = out[out.length - 1]
    if (type === 'text' && last && last.type === 'text') last.value += value
    else out.push({ type, value })
  }
  const parts = SEGMENTER ? [...SEGMENTER.segment(str)].map((x) => x.segment) : [...str]
  for (const part of parts) {
    if (EMOJI_RE.test(part)) {
      const k = emojiKey(part)
      if (k) push('emoji', k)
      continue
    }
    let t = ''
    for (const ch of part) {
      const cp = ch.codePointAt(0)
      if (cp < 32 || cp === 0xfe0f || cp === 0x200d || cp === 0x200b) continue
      if (METRICS.adv[cp] !== undefined) t += ch
    }
    if (t) push('text', t)
  }
  for (const seg of out) if (seg.type === 'text') seg.value = seg.value.replace(/\s+/g, ' ')
  while (out.length && out[0].type === 'text') {
    out[0].value = out[0].value.replace(/^\s+/, '')
    if (out[0].value) break
    out.shift()
  }
  while (out.length && out[out.length - 1].type === 'text') {
    const last = out[out.length - 1]
    last.value = last.value.replace(/\s+$/, '')
    if (last.value) break
    out.pop()
  }
  return out
}

export const EMOJI_W = 1.12 // largeur d’un emoji, en multiples de la taille de police
const advOf = (ch) => (METRICS.adv[ch.codePointAt(0)] ?? 1200) / METRICS.upm
export const textW = (t, size) => [...t].reduce((a, ch) => a + advOf(ch), 0) * size
const segsW = (segs, size) => segs.reduce((a, s) => a + (s.type === 'emoji' ? size * EMOJI_W : textW(s.value, size)), 0)
const last4 = (p) => String(p.num).slice(-4)

// Raccourcit avec « … » pour tenir dans maxW
export const fitSegments = (segs, size, maxW) => {
  if (segsW(segs, size) <= maxW) return segs
  const res = segs.map((s) => ({ ...s }))
  const ell = { type: 'text', value: '…' }
  while (res.length && segsW([...res, ell], size) > maxW) {
    const last = res[res.length - 1]
    const chars = last.type === 'text' ? [...last.value] : []
    if (chars.length > 1) last.value = chars.slice(0, -1).join('')
    else res.pop()
  }
  res.push(ell)
  return res
}

// Segments à afficher pour un joueur (suffixe « ·1234 » si le nom est vide, très court ou en double)
export const displaySegments = (p, duplicate) => {
  const segs = nameSegments(p.name)
  const hasText = segs.some((s) => s.type === 'text' && /[\p{L}\p{N}]/u.test(s.value))
  const hasEmoji = segs.some((s) => s.type === 'emoji')
  if (!segs.length) return [{ type: 'text', value: `Joueur ${last4(p)}` }]
  if (!hasText && !hasEmoji) return [...segs, { type: 'text', value: ` ·${last4(p)}` }]
  if (duplicate) return [...segs, { type: 'text', value: ` ·${last4(p)}` }]
  return segs
}

// Nom en texte simple (sans emoji) pour les lignes de texte des cartes ; jamais vide
export const plainName = (p) => {
  const t = nameSegments(p.name)
    .filter((s) => s.type === 'text')
    .map((s) => s.value)
    .join('')
    .trim()
  return /[\p{L}\p{N}]/u.test(t) ? t.slice(0, 22) : `Joueur ${last4(p)}`
}
// Nom pour les messages texte (WhatsApp sait afficher les emojis et tous les alphabets)
export const textName = (p) => String(p.name || '').normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 30) || `Joueur ${last4(p)}`
