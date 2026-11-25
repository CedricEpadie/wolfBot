// 📩 Choix en privé : carte numérotée + réponse attendue
import { shuffle } from '../utils.js'
import { ROLES } from './roles.js'
import { sendCard } from '../whatsapp/messaging.js'
import { textName } from '../cards/names.js'
import { listCard } from '../cards/render.js'

// ───────── Choix en privé ─────────
// Envoie une carte numérotée (ordre mélangé pour chaque joueur) et enregistre le choix attendu.
export const askPick = async (g, player, { role, title, subtitle, items, notes = [], kind = 'pick', onPick, keep = false, extra = {} }) => {
  const list = shuffle(items)
  g.prompts.set(player, { kind, list, onPick, keep, ...extra })
  const R = ROLES[role]
  const fallback =
    `${R.emoji} *${title}*\n${subtitle}\n\n` +
    list.map((p, i) => `${i + 1}. ${textName(p)}`).join('\n') +
    (notes.length ? `\n\n${notes.join('\n')}` : '') +
    `\n\nRéponds avec le *numéro*.`
  const r = await sendCard(player, () => listCard({ role, title, subtitle, items: list, notes }), fallback, `${R.emoji} *${title}*`)
  if (!r.ok) console.error('[loup-garou] carte de choix non envoyée :', r.error)
  return list
}
