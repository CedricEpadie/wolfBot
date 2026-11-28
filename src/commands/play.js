// 🗳️ Commandes en cours de partie : vote, passer le débat
import { P } from '../config.js'
import { norm } from '../utils.js'
import { say } from '../whatsapp/messaging.js'
import { findPlayer } from '../game/players.js'
import { registerVote } from '../game/day.js'
import { isVotePhase } from '../game/mayor.js'
import { finishStep } from '../game/timers.js'

// Façons de voter : « /loup vote @x » (mention), « /loup vote 3 » (numéro de la liste affichée), « /loup vote moi » (soi-même,
// possible à l’élection du maire seulement — se mentionner soi-même n’est pas toujours possible sur WhatsApp).
const SELF_WORDS = new Set(['moi', 'me', 'soi', 'moimeme', 'moi-meme'])
const resolveTarget = (g, voter, args, mentioned) => {
  if (mentioned.length === 1) return { target: mentioned[0] }
  const word = norm(args[0] || '')
  if (SELF_WORDS.has(word)) return { target: voter }
  if (/^\d{1,2}$/.test(word)) {
    const p = g.voteList?.[Number(word) - 1]
    return p ? { target: p } : { error: `Numéro invalide : choisis entre 1 et ${g.voteList?.length || '?'} (voir la liste ci-dessus).` }
  }
  return null
}

const vote = async ({ chat, g, me, mentioned, args = [] }) => {
  if (!g || !isVotePhase(g)) return say(chat, 'Le vote n’est possible que pendant la phase de vote.')
  const voter = findPlayer(g, me.ids)
  if (!voter || !voter.alive) return say(chat, 'Seuls les joueurs en vie peuvent voter.')
  const t = resolveTarget(g, voter, args, mentioned)
  if (!t) {
    return say(chat, `Pour voter : *${P}loup vote @joueur*, *${P}loup vote 3* (numéro de la liste)${g.phase === 'mayor' ? ` ou *${P}loup vote moi* (pour toi-même)` : ''}.`)
  }
  if (t.error) return say(chat, t.error)
  return registerVote(g, voter, t.target, true)
}

const skipDebate = async ({ chat, g, isStarter }) => {
  if (!g || g.phase !== 'day') return say(chat, 'Il n’y a pas de débat à passer pour le moment.')
  if (!isStarter) return say(chat, 'Seul le lanceur peut passer le débat 😉')
  finishStep(g)
}

export const playCommands = [
  { names: ['vote'], groupOnly: true, run: vote },
  { names: ['moi'], groupOnly: true, run: (ctx) => vote({ ...ctx, args: ['moi'], mentioned: [] }) }, // raccourci : « /loup moi »
  { names: ['passer', 'skip'], groupOnly: true, run: skipDebate },
]
