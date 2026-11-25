// ♻️ Reprise des parties après un redémarrage ou un plantage.
// La phase en cours (nuit ou jour) recommence depuis son début, avec les rôles, les morts, les potions,
// le maire et le groupe des loups tels qu’ils étaient lors de la dernière sauvegarde.
import { RESUME_GAMES, RESUME_MAX_MINUTES } from '../config.js'
import { sock } from '../whatsapp/socket.js'
import { say } from '../whatsapp/messaging.js'
import { games } from '../state.js'
import { clearSave, loadSaves } from '../persistence/saves.js'
import { jidsOf } from './players.js'
import { wolfGroups } from './wolfGroup.js'
import { resumeGame } from './flow.js'

// Reconstruit une partie (joueurs, maire, groupe des loups…) à partir d’une sauvegarde
const restore = (s) => {
  const players = s.players.map((d) => ({ ...d, ids: new Set(d.ids) }))
  const byNum = (n) => players.find((p) => p.num === n) || null
  return {
    key: s.key,
    phase: s.resumeAt === 'day' ? 'day' : 'night',
    starter: byNum(s.starter) || players[0],
    players,
    timer: null,
    ticks: [],
    deadline: 0,
    prompts: new Map(),
    nightNo: s.nightNo,
    witch: s.witch,
    lastProtected: byNum(s.lastProtected),
    mayor: byNum(s.mayor),
    deadNoticed: s.deadNoticed,
    deadGroup: s.deadGroup && { jid: s.deadGroup.jid, added: new Set(s.deadGroup.added.map(byNum).filter(Boolean)), necroIn: false },
    wolfGroup: s.wolfGroup && { jid: s.wolfGroup.jid, present: s.wolfGroup.present, removed: new Set(s.wolfGroup.removed.map(byNum).filter(Boolean)) },
  }
}

// À appeler une fois connecté. Ne bloque pas : chaque partie reprise tourne en arrière-plan.
export const resumeGames = async () => {
  if (!RESUME_GAMES) return
  for (const s of loadSaves()) {
    if (games.has(s.key)) continue // déjà en cours (simple reconnexion, pas un redémarrage)
    const ageMin = (Date.now() - s.savedAt) / 60000
    if (ageMin > RESUME_MAX_MINUTES) {
      console.log(`[loup-garou] sauvegarde trop ancienne (${Math.round(ageMin)} min), partie abandonnée : ${s.key}`)
      clearSave(s.key)
      try {
        await sock.groupSettingUpdate(s.key, 'not_announcement') // le groupe a pu rester fermé
      } catch {}
      await say(s.key, '🕯️ La partie précédente a été interrompue par un redémarrage et est trop ancienne pour reprendre. Relancez-en une avec */loup* !')
      continue
    }
    const g = restore(s)
    games.set(g.key, g)
    if (g.wolfGroup) wolfGroups.add(g.wolfGroup.jid) // ne pas traiter de commandes dans ce groupe
    if (g.deadGroup) wolfGroups.add(g.deadGroup.jid)
    console.log(`[loup-garou] reprise de la partie ${g.key} (${s.resumeAt}, nuit ${g.nightNo})`)
    await say(
      g.key,
      `♻️ *Le bot a redémarré.* La partie reprend ${s.resumeAt === 'day' ? `au début du jour ${g.nightNo}` : `à la nuit ${g.nightNo + 1}`}, tous les rôles et les morts sont conservés.`,
      jidsOf(g.players)
    )
    resumeGame(g, s.resumeAt).catch((e) => console.error('[loup-garou]', e))
  }
}
