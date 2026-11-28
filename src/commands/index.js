// 🕹️ Aiguillage des commandes « /loup … » via un registre.
//
// Pour AJOUTER une commande : l’écrire dans info.js / lobby.js / play.js / admin.js (ou un nouveau fichier)
// sous la forme { names: ['mot', 'alias'], groupOnly: true|false, run: async (ctx) => … }
// puis l’ajouter à la liste COMMANDS ci-dessous.
//
// ctx = { chat, isGroup, me, mentioned, g (partie du groupe ou undefined), args (mots après la commande), isStarter }
import { COMMAND_WORDS, P } from '../config.js'
import { say } from '../whatsapp/messaging.js'
import { norm } from '../utils.js'
import { games } from '../state.js'
import { hasId } from '../game/players.js'
import { infoCommands } from './info.js'
import { lobbyCommands, openGame } from './lobby.js'
import { playCommands } from './play.js'
import { adminCommands } from './admin.js'

const COMMANDS = [...infoCommands, ...lobbyCommands, ...playCommands, ...adminCommands]

const BY_NAME = new Map()
for (const cmd of COMMANDS) for (const name of cmd.names) BY_NAME.set(name, cmd)

export const handleCommand = async (chat, isGroup, me, text, mentioned) => {
  const [cmdRaw, ...args] = text.slice(P.length).trim().split(/\s+/)
  if (!COMMAND_WORDS.has((cmdRaw || '').toLowerCase())) return
  const word = norm(args[0] || '')

  const cmd = word ? BY_NAME.get(word) : openGame // « /loup » seul = ouvrir une partie
  const g = games.get(chat)
  const ctx = { chat, isGroup, me, mentioned, g, args: args.slice(1), isStarter: !!g && hasId(g.starter, me.ids) }

  if (cmd && !cmd.groupOnly) return cmd.run(ctx) // utilisable aussi en privé
  if (!isGroup) return say(chat, `🐺 Ce jeu se joue dans un groupe. Ici, tape *${P}loup role* pour retrouver ta carte, ou *${P}loup aide*.`)
  if (!cmd) return say(chat, `Commande inconnue. Tape *${P}loup aide* pour la liste des commandes.`)
  return cmd.run(ctx)
}
