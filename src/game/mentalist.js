// 🎩 Le Mentaliste : pendant le vote du village, il reçoit en privé des prémonitions volontairement vagues
// (« ça se passe bien », « quelque chose cloche », « rien de net ») : jamais de nom, de chiffre ni de camp.
import { VOTE_SECONDS, MENTALIST_EXTRA_SECONDS } from '../config.js'
import { sendText } from '../whatsapp/messaging.js'
import { alive } from './players.js'
import { leaders, tally } from './mayor.js'
import { tell } from './narrator.js'

// Durée du vote. Un peu plus longue dès qu’un Mentaliste fait partie de la partie — même mort, car la
// composition est publique et un temps de vote variable trahirait s’il est encore en vie.
export const voteSeconds = (g) => VOTE_SECONDS + (g.players.some((p) => p.role === 'mentaliste') ? MENTALIST_EXTRA_SECONDS : 0)

// Instants (en secondes restantes) où le Mentaliste a une prémonition : à mi-vote, puis vers la fin
export const visionMarks = (total) => [Math.round(total * 0.5), Math.round(total * 0.2)]

// Tendance du vote, voix du maire comprise :
//  'good'    → le suspect actuellement en tête est un loup-garou
//  'bad'     → le suspect en tête est un innocent
//  'unclear' → pas assez de votes, ou égalité en tête
export const voteOutlook = (g) => {
  if (!g.votes || g.votes.size < 2) return 'unclear'
  const top = leaders(tally(g))
  if (top.length !== 1) return 'unclear'
  return top[0].role === 'loup' ? 'good' : 'bad'
}

export const mentalistVision = async (g) => {
  if (!alive(g)) return
  const m = g.players.find((p) => p.role === 'mentaliste' && p.alive)
  if (!m) return
  await sendText([m.dm, m.jid], tell(`vision.${voteOutlook(g)}`))
}
