// 🏁 Fin de partie : victoire, statistiques, annulation
import { P } from '../config.js'
import { say } from '../whatsapp/messaging.js'
import { lockGroup } from '../whatsapp/group.js'
import { tag } from '../utils.js'
import { alive, jidsOf, living } from './players.js'
import { stopTimers } from './timers.js'
import { games } from '../state.js'
import { ROLES } from './roles.js'
import { endWolfGroup } from './wolfGroup.js'
import { recordGame } from '../persistence/stats.js'
import { clearSave } from '../persistence/saves.js'
import { tell } from './narrator.js'

// ───────── Fin de partie ─────────
export const winnerOf = (g) => {
  const alivePl = living(g)
  if (!alivePl.length) return 'egalite'
  const wolves = alivePl.filter((p) => p.role === 'loup').length
  if (wolves === 0) return 'village'
  if (wolves >= alivePl.length - wolves) return 'loups'
  return null
}

export const finish = async (g, winner) => {
  if (!alive(g)) return
  g.over = true
  stopTimers(g)
  games.delete(g.key)
  clearSave(g.key)
  if (g.locked) await lockGroup(g, false)

  recordGame(g, winner) // statistiques persistantes (base SQLite)

  const recap = g.players
    .map((p) => `${ROLES[p.role].emoji} ${tag(p.jid)} — ${ROLES[p.role].label}${p.alive ? '' : ' 💀'}${p.wasMayor ? ' 👑' : ''}`)
    .join('\n')
  const title = tell(winner === 'village' ? 'winVillage' : winner === 'loups' ? 'winWolves' : 'winDraw')
  await say(
    g.key,
    `🏁 *FIN DE PARTIE*\n\n${title}\n\n🎭 *Les rôles*\n${recap}\n\n🏆 *${P}loup top* : classement • 📈 *${P}loup stats* : tes statistiques • Rejouer : *${P}loup*`,
    jidsOf(g.players)
  )
  await endWolfGroup(g)
}

export const abort = async (g) => {
  g.aborted = true
  stopTimers(g)
  games.delete(g.key)
  clearSave(g.key)
  g.finishStep?.()
  if (g.locked) await lockGroup(g, false)
  await endWolfGroup(g, { quick: true })
}
