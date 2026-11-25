// 🚪 Salle d’attente : ouvrir une partie, rejoindre, lancer, annuler
import { P, MIN_PLAYERS, MAX_PLAYERS, LOBBY_SECONDS } from '../config.js'
import { say } from '../whatsapp/messaging.js'
import { isBotAdmin } from '../whatsapp/group.js'
import { tag } from '../utils.js'
import { tell } from '../game/narrator.js'
import { games } from '../state.js'
import { findPlayer, jidsOf, listOf, toPlayer } from '../game/players.js'
import { ROLES, ROLE_ORDER } from '../game/roles.js'
import { waitStep } from '../game/timers.js'
import { beginGame } from '../game/flow.js'
import { abort } from '../game/lifecycle.js'

const logError = (e) => console.error('[loup-garou]', e)

// « /loup » seul : ouvre une partie dans le groupe
export const openGame = {
  names: [],
  groupOnly: true,
  run: async ({ chat: key, me, g }) => {
    if (g) {
      return say(
        key,
        g.phase === 'lobby'
          ? `⏳ Une partie attend des joueurs (${g.players.length}/${MAX_PLAYERS}). Rejoins-la avec *${P}loup join* !`
          : '⚠️ Une partie est déjà en cours dans ce groupe.'
      )
    }
    const starter = toPlayer(me)
    const created = { key, phase: 'lobby', starter, players: [starter], timer: null, ticks: [], deadline: 0, prompts: new Map() }
    games.set(key, created)
    const admin = await isBotAdmin(key)
    const warn = admin === false ? `\n⚠️ Je ne suis pas *admin* : je ne pourrai pas fermer le groupe la nuit. Faites-moi admin !` : ''
    waitStep(created, LOBBY_SECONDS, {
      marks: [90, 60, 30, 10],
      tick: (m) =>
        say(key, `⏳ Départ dans *${m} s* — ${created.players.length}/${MAX_PLAYERS} joueurs (minimum ${MIN_PLAYERS}).\n👥 ${listOf(created.players)}\n➡️ Rejoindre : *${P}loup join*`, jidsOf(created.players)),
    })
      .then(() => {
        if (games.get(key) === created && created.phase === 'lobby') return beginGame(key)
      })
      .catch(logError)
    return say(
      key,
      `${tell('lobbyIntro')}\n\n` +
        `🎭 Rôles : ${ROLE_ORDER.map((r) => ROLES[r].emoji).join(' ')} (*${P}loup roles*)\n` +
        `👥 Joueurs (1/${MAX_PLAYERS}, minimum ${MIN_PLAYERS}) : ${tag(me.jid)}\n` +
        `➡️ Rejoindre : *${P}loup join*\n▶️ Lancer : *${P}loup go* (lanceur), sinon départ automatique dans *${LOBBY_SECONDS} s*\n` +
        `📖 Règles : *${P}loup regles*${warn}`,
      [me.jid]
    )
  },
}

const join = async ({ chat, g, me }) => {
  if (!g) return say(chat, `Aucune partie ouverte. Lance-en une avec *${P}loup*.`)
  if (g.phase !== 'lobby') return say(chat, 'La partie a déjà commencé, rendez-vous à la prochaine ! 😉')
  if (findPlayer(g, me.ids)) return say(chat, 'Tu es déjà dans la partie 😉')
  if (g.players.length >= MAX_PLAYERS) return say(chat, `La partie est complète (${MAX_PLAYERS} joueurs max).`)
  g.players.push(toPlayer(me))
  const missing = MIN_PLAYERS - g.players.length
  await say(
    chat,
    `✅ ${tag(me.jid)} rejoint la partie ! (${g.players.length}/${MAX_PLAYERS})\n👥 ${listOf(g.players)}\n` +
      (missing > 0 ? `⏳ Il manque encore *${missing}* joueur(s) pour démarrer.` : `✅ Assez de joueurs ! Le lanceur peut taper *${P}loup go*.`),
    jidsOf(g.players)
  )
  if (g.players.length >= MAX_PLAYERS) {
    await say(chat, '🚪 Salle complète : on démarre tout de suite !')
    beginGame(chat).catch(logError)
  }
}

const go = async ({ chat, g, isStarter }) => {
  if (!g || g.phase !== 'lobby') return say(chat, 'Aucune partie en attente de lancement.')
  if (!isStarter) return say(chat, 'Seul le lanceur peut démarrer la partie 😉')
  beginGame(chat, true).catch(logError)
}

const stop = async ({ chat, g, isStarter }) => {
  if (!g) return say(chat, 'Aucune partie en cours.')
  if (!isStarter) return say(chat, 'Seul le lanceur peut annuler la partie 😉')
  await abort(g)
  return say(chat, '🛑 Partie annulée par le lanceur.' + (g.phase !== 'lobby' ? ' Le groupe est rouvert.' : ''))
}

export const lobbyCommands = [
  { names: ['join', 'rejoindre'], groupOnly: true, run: join },
  { names: ['go', 'start', 'lancer'], groupOnly: true, run: go },
  { names: ['stop', 'fin'], groupOnly: true, run: stop },
]
