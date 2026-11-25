// 🗳️ Commandes en cours de partie : vote, passer le débat
import { P } from '../config.js'
import { say } from '../whatsapp/messaging.js'
import { findPlayer } from '../game/players.js'
import { registerVote } from '../game/day.js'
import { isVotePhase } from '../game/mayor.js'
import { finishStep } from '../game/timers.js'

const vote = async ({ chat, g, me, mentioned }) => {
  if (!g || !isVotePhase(g)) return say(chat, 'Le vote n’est possible que pendant la phase de vote.')
  const voter = findPlayer(g, me.ids)
  if (!voter || !voter.alive) return say(chat, 'Seuls les joueurs en vie peuvent voter.')
  if (mentioned.length !== 1) return say(chat, `Mentionne un seul suspect : *${P}loup vote @joueur*`)
  return registerVote(g, voter, mentioned[0], true)
}

const skipDebate = async ({ chat, g, isStarter }) => {
  if (!g || g.phase !== 'day') return say(chat, 'Il n’y a pas de débat à passer pour le moment.')
  if (!isStarter) return say(chat, 'Seul le lanceur peut passer le débat 😉')
  finishStep(g)
}

export const playCommands = [
  { names: ['vote'], groupOnly: true, run: vote },
  { names: ['passer', 'skip'], groupOnly: true, run: skipDebate },
]
