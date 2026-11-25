// 🏁 Fin de partie : victoire, statistiques, annulation
import { P } from '../config.js'
import { sendInfoCard } from '../whatsapp/messaging.js'
import { lockGroup } from '../whatsapp/group.js'
import { tag } from '../utils.js'
import { alive, jidsOf, listOf, living } from './players.js'
import { stopTimers } from './timers.js'
import { games } from '../state.js'
import { ROLES, didWin } from './roles.js'
import { endWolfGroup } from './wolfGroup.js'
import { endDeadGroup } from './deadGroup.js'
import { recordGame, topOf } from '../persistence/stats.js'
import { recapCard, podiumCard } from '../cards/endCards.js'
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

  const winners = g.players.filter((p) => didWin(p.role, winner))
  const title = tell(winner === 'village' ? 'winVillage' : winner === 'loups' ? 'winWolves' : 'winDraw')
  const outro = `🏆 *${P}loup top* : classement • 📈 *${P}loup stats* : tes statistiques • Rejouer : *${P}loup*`

  // Texte de repli (INFO_DELIVERY=text ou image impossible) : le récap des rôles en liste
  const recap = g.players
    .map((p) => `${ROLES[p.role].emoji} ${tag(p.jid)} — ${ROLES[p.role].label}${p.alive ? '' : ' 💀'}${p.wasMayor ? ' 👑' : ''}`)
    .join('\n')
  const fallback = `🏁 *FIN DE PARTIE*\n\n${title}\n\n🎭 *Les rôles*\n${recap}\n\n${outro}`
  const caption = `🏁 *FIN DE PARTIE*\n\n${title}\n\n${winners.length ? `🏆 Vainqueur(s) : ${listOf(winners)}` : '💀 Aucun vainqueur'}\n\n${outro}`

  await sendInfoCard(g.key, () => recapCard(g, winner), fallback, { caption, mentions: jidsOf(g.players) })

  // Podium du groupe (classement à jour, « +1 » pour les gagnants de cette partie)
  const top = topOf(g.key, 10, { includeZero: true })
  if (top.length) {
    await sendInfoCard(g.key, () => podiumCard({ entries: top, gained: new Set(winners.map((p) => p.jid)) }), '', { caption: '🏆 *Classement du groupe*' })
  }
  await Promise.all([endWolfGroup(g), endDeadGroup(g)])
}

export const abort = async (g) => {
  g.aborted = true
  stopTimers(g)
  games.delete(g.key)
  clearSave(g.key)
  g.finishStep?.()
  if (g.locked) await lockGroup(g, false)
  await Promise.all([endWolfGroup(g, { quick: true }), endDeadGroup(g, { quick: true })])
}
