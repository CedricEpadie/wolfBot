// ▶️ Déroulement d’une partie : lancement, distribution des cartes, boucle nuit/jour
import { MIN_PLAYERS, MAYOR, P, READ_SECONDS, DM_DELAY_SECONDS, SELF_DESTRUCT } from '../config.js'
import { say, editMsg, sendCard, sendInfoCard } from '../whatsapp/messaging.js'
import { lockGroup, resolveDms } from '../whatsapp/group.js'
import { shuffle, sleep, progressBar, tag } from '../utils.js'
import { alive, jidsOf, listOf } from './players.js'
import { composition, compoText } from './roles.js'
import { roleCardFor } from '../cards/roleCard.js'
import { stopTimers, waitStep } from './timers.js'
import { games } from '../state.js'
import { abort } from './lifecycle.js'
import { createWolfGroup, setWolfGroupLocked } from './wolfGroup.js'
import { compositionCard } from '../cards/infoCards.js'
import { saveGame } from '../persistence/saves.js'
import { night } from './night.js'
import { day } from './day.js'

// ───────── Déroulement ─────────
// Boucle de jeu. À chaque tour on sauvegarde la partie (reprise possible après un redémarrage) puis on joue
// la nuit et le jour. resumeAt = 'day' : on reprend directement au jour en cours.
const playLoop = async (g, resumeAt = 'night') => {
  let skipNight = resumeAt === 'day'
  while (alive(g) && !g.over) {
    if (!skipNight) {
      saveGame(g, 'night')
      await night(g)
      if (!alive(g) || g.over) return
    }
    skipNight = false
    saveGame(g, 'day')
    await day(g)
  }
}

// Exécute `play` en protégeant la partie : en cas d’erreur, elle est interrompue proprement.
const guarded = async (g, play) => {
  try {
    await play()
  } catch (e) {
    console.error('[loup-garou] erreur dans la partie :', e)
    if (alive(g)) {
      await say(g.key, '💥 Une erreur est survenue : la partie est interrompue.')
      await abort(g)
    }
  }
}

const runGame = (g) =>
  guarded(g, async () => {
    await distribute(g)
    await playLoop(g)
  })

// Reprise d’une partie sauvegardée (après un redémarrage) : la phase en cours recommence depuis son début.
export const resumeGame = (g, resumeAt) =>
  guarded(g, async () => {
    g.phase = resumeAt === 'day' ? 'day' : 'night'
    if (resumeAt === 'day') await lockGroup(g, false) // le groupe a pu rester fermé
    await setWolfGroupLocked(g, true)
    await playLoop(g, resumeAt)
  })

const distribute = async (g) => {
  g.phase = 'roles'
  const total = g.players.length
  const roles = shuffle(composition(total))
  g.players.forEach((p, i) => (p.role = roles[i]))
  g.prompts = new Map()
  g.witch = { life: true, death: true }
  g.lastProtected = null

  await resolveDms(g)
  const progress = (done, last) =>
    `🎴 *DISTRIBUTION DES CARTES*\n\n👥 ${total} joueurs : ${listOf(g.players)}\n\n📩 Envoi des cartes en privé…\n${progressBar(done, total)} ${done}/${total}` +
    (last ? `\n${last}` : '')
  const first = await say(g.key, progress(0), jidsOf(g.players))

  const failed = []
  let firstError = ''
  let done = 0
  for (const p of g.players) {
    if (!alive(g)) return
    const c = roleCardFor(g, p)
    const r = await sendCard(p, c.render, c.text, c.caption)
    done++
    if (!r.ok) {
      failed.push(p)
      if (!firstError) firstError = r.error
    }
    await editMsg(g.key, first, progress(done, r.ok ? `✅ ${tag(p.jid)} a reçu sa carte` : `⚠️ ${tag(p.jid)} : envoi impossible`), jidsOf(g.players))
    if (done < total) await sleep(DM_DELAY_SECONDS * 1000)
  }
  if (!alive(g)) return

  if (failed.length) {
    await say(
      g.key,
      `⚠️ Je n’ai pas pu écrire en privé à ${listOf(failed)}. Écrivez-moi d’abord en privé (un simple « salut »), puis tapez *${P}loup role*.\n🔧 Détail technique : ${firstError}`,
      jidsOf(failed)
    )
  }
  await createWolfGroup(g)
  if (!alive(g)) return
  const compoMsg =
    `🎭 *Composition de la partie*\n${compoText(total)}\n\n📖 Lis bien ta carte : elle s’efface après *${SELF_DESTRUCT || '∞'} s* (renvoi : *${P}loup role* en privé).\n` +
      (MAYOR ? '👑 Un maire sera élu au matin du jour 1.\n' : '') +
      `🌙 La première nuit tombe dans *${READ_SECONDS} s*…`
  await sendInfoCard(g.key, () => compositionCard({ highlight: total }), compoMsg, { caption: compoMsg })
  await waitStep(g, READ_SECONDS, { marks: [10, 5], tick: (m) => say(g.key, `⏳ La nuit tombe dans *${m} s*…`) })
}

export const beginGame = async (key, manual = false) => {
  const g = games.get(key)
  if (!g || g.phase !== 'lobby') return
  if (g.players.length < MIN_PLAYERS) {
    if (manual) return say(key, `⛔ Il manque encore *${MIN_PLAYERS - g.players.length}* joueur(s) (${g.players.length}/${MIN_PLAYERS} minimum).`)
    games.delete(key)
    stopTimers(g)
    return say(key, `😕 Pas assez de joueurs (${g.players.length}/${MIN_PLAYERS} minimum). Partie annulée.`)
  }
  stopTimers(g)
  g.phase = 'roles'
  return runGame(g)
}
