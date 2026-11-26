// 🌙 Nuit : étapes Garde → Voyante → Loups → Sorcière, puis aube
import {
  NIGHT_STEP_SECONDS, NIGHT_WOLF_SECONDS, NIGHT_MIN_STEP, NIGHT_NECRO_SECONDS, DM_DELAY_SECONDS,
  REVEAL_ROLES, VOYANTE_REVEAL_NAME, WOLF_GROUP,
} from '../config.js'
import { say, sendCard } from '../whatsapp/messaging.js'
import { lockGroup } from '../whatsapp/group.js'
import { pick, rand, shuffle, sleep, tag } from '../utils.js'
import { alive, jidsOf, listOf, living } from './players.js'
import { ROLES } from './roles.js'
import { plainName, textName } from '../cards/names.js'
import { bigCard, listCard } from '../cards/render.js'
import { askPick } from './prompts.js'
import { finishStep, waitStep } from './timers.js'
import { notifyWolfVote, setWolfGroupLocked, startWolfGroupVote } from './wolfGroup.js'
import { deathReport, resolveDeaths } from './deaths.js'
import { tell } from './narrator.js'
import { dismissNecro, necroVisit } from './deadGroup.js'

// ───────── Nuit ─────────
const runStep = async (g, { role, start, end, seconds = NIGHT_STEP_SECONDS, canAct, setup, after, marks, tick }) => {
  // Rôle absent, ou dont tous les joueurs sont éliminés : plus d’annonce de réveil dans le groupe.
  // (Avec REVEAL_ROLES=false, on garde une étape « factice » : se taire révélerait le rôle du mort.)
  const holders = g.players.filter((p) => p.role === role)
  if (!holders.length || (REVEAL_ROLES && !holders.some((p) => p.alive))) return
  const actors = holders.filter((p) => p.alive && (!canAct || canAct(p)))
  await say(g.key, start)
  if (!alive(g)) return
  if (actors.length) {
    await setup(actors)
    await waitStep(g, seconds, { min: NIGHT_MIN_STEP, marks, tick })
  } else {
    // Joueur sans pouvoir utilisable (ex. sorcière sans potion) ou mort en mode rôles cachés : attente aléatoire
    await waitStep(g, rand(NIGHT_MIN_STEP, seconds))
  }
  g.prompts.clear()
  if (!alive(g)) return
  if (after) await after()
  await say(g.key, end)
  await sleep(1500)
}

const stepGarde = (g) =>
  runStep(g, {
    role: 'garde',
    start: tell('garde.start'),
    end: tell('garde.end'),
    setup: async ([guard]) => {
      const prev = g.lastProtected
      g.lastProtected = null
      const items = living(g).filter((p) => p !== prev)
      await askPick(g, guard, {
        role: 'garde',
        title: 'QUI PROTÉGER ?',
        subtitle: `Nuit ${g.nightNo} • ${NIGHT_STEP_SECONDS} s`,
        items,
        notes: [prev ? `Interdit cette nuit : ${plainName(prev)}` : 'Tu peux te protéger toi-même.', 'Réponds avec le numéro.'],
        onPick: (t) => {
          g.night.protected = t
          g.lastProtected = t
          finishStep(g)
        },
      })
    },
  })

const stepVoyante = (g) =>
  runStep(g, {
    role: 'voyante',
    start: tell('voyante.start'),
    end: tell('voyante.end'),
    setup: async ([seer]) => {
      await askPick(g, seer, {
        role: 'voyante',
        title: 'QUI SONDER ?',
        subtitle: `Nuit ${g.nightNo} • ${NIGHT_STEP_SECONDS} s`,
        items: living(g).filter((p) => p !== seer),
        notes: ['Le rôle que tu découvres sera annoncé au village.', 'Réponds avec le numéro.'],
        onPick: async (t) => {
          g.night.seen = t
          const R = ROLES[t.role]
          await sendCard(
            seer,
            () => bigCard({ role: t.role, title: R.label, subtitle: `Vision : ${plainName(t)} est…`, lines: ['Le village connaîtra ce rôle', 'mais pas ton nom ni ta cible.'], footer: 'Elle s’efface toute seule' }),
            `🔮 *Vision* : ${textName(t)} est ${R.emoji} *${R.label}*`,
            `🔮 ${R.emoji} *${R.label}*`
          )
          finishStep(g)
        },
      })
    },
  })

const stepLoups = (g) =>
  runStep(g, {
    role: 'loup',
    seconds: NIGHT_WOLF_SECONDS,
    start: tell('loups.start'),
    end: tell('loups.end'),
    setup: async (wolves) => {
      g.night.wolfVotes = new Map()
      const targets = living(g).filter((p) => p.role !== 'loup')
      // Groupe des loups ouvert : la carte de vote est envoyée DANS le groupe (pas en privé)
      if (await startWolfGroupVote(g, wolves, targets)) return
      if (g.wolfGroup?.present) {
        await say(g.wolfGroup.jid, `🌙 *Nuit ${g.nightNo}* — à vous de jouer, la meute ! Concertez-vous ici, puis votez en répondant par un numéro à ma carte privée (⏱️ ${NIGHT_WOLF_SECONDS} s).`, jidsOf(wolves))
      }
      for (const w of wolves) {
        const mates = wolves.filter((x) => x !== w).map(plainName)
        await askPick(g, w, {
          role: 'loup',
          kind: 'wolf',
          keep: true, // un loup peut changer d’avis jusqu’à la fin de l’étape
          extra: { wolves },
          title: 'QUI DÉVORER ?',
          subtitle: `Nuit ${g.nightNo} • ${NIGHT_WOLF_SECONDS} s`,
          items: targets,
          notes: [
            mates.length ? `Complices vivants : ${mates.join(', ')}` : 'Tu es le seul loup en vie.',
            mates.length ? (g.wolfGroup ? 'Discutez dans le groupe secret de la meute.' : 'Écris un message : il sera transmis à tes complices.') : 'Réponds avec le numéro.',
          ],
          onPick: (t) => {
            g.night.wolfVotes.set(w, t)
            notifyWolfVote(g, wolves, w, t).catch(() => {})
            if (wolves.every((x) => g.night.wolfVotes.has(x))) finishStep(g)
          },
        })
        await sleep(DM_DELAY_SECONDS * 250)
      }
    },
    marks: [30, 10],
    tick: (m) => {
      const wv = g.wolfVote
      if (!wv) return undefined
      const pending = wv.wolves.filter((w) => !g.night.wolfVotes.has(w))
      return say(g.wolfGroup.jid, `⏳ Plus que *${m} s* — ${g.night.wolfVotes.size}/${wv.wolves.length} vote(s).\n🕐 En attente : ${listOf(pending)}`, jidsOf(pending))
    },
    after: async () => {
      const counts = new Map()
      for (const t of g.night.wolfVotes.values()) counts.set(t, (counts.get(t) || 0) + 1)
      if (counts.size) {
        const max = Math.max(...counts.values())
        g.night.wolfTarget = pick([...counts.entries()].filter(([, c]) => c === max).map(([t]) => t))
        if (g.wolfGroup?.present) await say(g.wolfGroup.jid, `🎯 La meute a choisi sa victime : *${textName(g.night.wolfTarget)}*.`)
      } else if (g.wolfGroup?.present) {
        await say(g.wolfGroup.jid, '😴 Aucun vote : la meute reste affamée cette nuit.')
      }
      g.wolfVote = null
      if (g.wolfGroup?.present && WOLF_GROUP === 'keep') {
        await say(g.wolfGroup.jid, '🔒 Le groupe se referme jusqu’à la prochaine nuit.')
        await setWolfGroupLocked(g, true)
      }
    },
  })

const stepSorciere = (g) =>
  runStep(g, {
    role: 'sorciere',
    start: tell('sorciere.start'),
    end: tell('sorciere.end'),
    canAct: () => g.witch.life || g.witch.death,
    setup: async ([witch]) => {
      const victim = g.night.wolfTarget
      const items = shuffle(living(g).filter((p) => p !== witch))
      g.prompts.set(witch, { kind: 'witch', list: items, victim })
      const notes = [
        `Potion de vie : ${g.witch.life ? 'disponible' : 'utilisée'} • Potion de mort : ${g.witch.death ? 'disponible' : 'utilisée'}`,
        '« vie » : sauver la victime',
        '« mort N » : empoisonner le joueur N',
        '« rien » : ne rien faire (une seule potion par nuit)',
      ]
      const subtitle = victim ? `Les loups ont attaqué : ${plainName(victim)}` : 'Les loups n’ont attaqué personne cette nuit'
      const r = await sendCard(
        witch,
        () => listCard({ role: 'sorciere', title: 'TES POTIONS', subtitle, items, notes }),
        `🧙‍♀️ *TES POTIONS*\n${subtitle}\n\nJoueurs pour la potion de mort :\n${items.map((p, i) => `${i + 1}. ${textName(p)}`).join('\n')}\n\n${notes.join('\n')}`,
        '🧙‍♀️ *TES POTIONS*'
      )
      if (!r.ok) console.error('[loup-garou] carte de la sorcière non envoyée :', r.error)
    },
  })

// Nécromancien : il se réveille en premier, rejoint le groupe des morts PENDANT que les autres rôles jouent,
// et se rendort à la fin de la nuit. Retourne la visite en cours (ou null si le rôle est absent / éliminé et connu).
const stepNecro = async (g) => {
  const holders = g.players.filter((p) => p.role === 'necromancien')
  if (!holders.length || (REVEAL_ROLES && !holders.some((p) => p.alive))) return null
  await say(g.key, tell('necro.start'))
  return necroVisit(g, NIGHT_NECRO_SECONDS).catch((e) => console.error('[loup-garou] visite du nécromancien :', e))
}

export const night = async (g) => {
  g.nightNo = (g.nightNo || 0) + 1
  g.phase = 'night'
  g.night = { protected: null, wolfTarget: null, saved: false, poisoned: null, seen: null, wolfVotes: new Map() }
  g.prompts.clear()
  await lockGroup(g, true)
  await say(
    g.key,
    `🌙 *NUIT ${g.nightNo}*\n\n${tell('nightFalls')}\n${g.locked ? '🔒 Le groupe est fermé jusqu’à l’aube.\n' : ''}📩 Ceux qui ont un pouvoir recevront une carte en privé.`
  )
  await sleep(2500)
  if (!alive(g)) return
  const necro = await stepNecro(g)
  if (!alive(g)) return
  // Le Garde et la Voyante n’ont aucun lien entre eux : leur ordre de réveil change chaque nuit.
  // (Les Loups passent toujours après le Garde, et la Sorcière après les Loups.)
  for (const step of shuffle([stepGarde, stepVoyante])) {
    await step(g)
    if (!alive(g)) return
  }
  await stepLoups(g)
  if (!alive(g)) return
  await stepSorciere(g)
  if (!alive(g)) return
  if (necro) {
    await necro // la visite dure au moins NIGHT_NECRO_SECONDS : l’aube ne se lève pas avant
    if (!alive(g)) return
    await say(g.key, tell('necro.end'))
    await sleep(1500)
  }
  await dawn(g)
}

const dawn = async (g) => {
  g.phase = 'day'
  await dismissNecro(g) // sécurité : le Nécromancien ne reste jamais dans le groupe des morts de jour
  await lockGroup(g, false)
  const n = g.night
  const dead = []
  if (n.wolfTarget && !n.saved && n.protected !== n.wolfTarget) {
    dead.push(n.wolfTarget)
    n.wolfTarget.death = { kind: 'wolves', no: g.nightNo } // mémorisé pour le récap de fin de partie
  }
  if (n.poisoned && !dead.includes(n.poisoned)) {
    dead.push(n.poisoned)
    n.poisoned.death = { kind: 'poison', no: g.nightNo }
  }
  // L’ordre d’annonce est tiré au sort : il ne doit pas révéler qui est la victime des loups et qui est celle du poison
  dead.splice(0, dead.length, ...shuffle(dead))

  await say(g.key, `☀️ *JOUR ${g.nightNo}*\n\n${tell('dawn')}\n${g.locked === false ? '🔓 Le groupe est rouvert.' : ''}`)
  await sleep(2500)
  if (!alive(g)) return

  if (dead.length) {
    for (const p of dead) p.alive = false
    await say(g.key, `💀 *${dead.length > 1 ? 'Victimes' : 'Victime'} de la nuit*\n${tell('nightVictimsIntro')}`, jidsOf(dead))
    for (const p of dead) {
      await sleep(2000)
      if (!alive(g)) return
      await say(g.key, deathReport(p, 'night'), [p.jid])
    }
  } else {
    await say(g.key, tell('miracle'))
  }
  await sleep(2000)
  if (!alive(g)) return

  if (n.seen) {
    const R = ROLES[n.seen.role]
    await say(
      g.key,
      `🔮 *La Voyante bavarde* a parlé !\n${tell('voyante.talk', { what: `${VOYANTE_REVEAL_NAME ? `${tag(n.seen.jid)} : ` : 'un joueur : '}${R.emoji} *${R.label}*` })}`,
      VOYANTE_REVEAL_NAME ? [n.seen.jid] : []
    )
    await sleep(2000)
    if (!alive(g)) return
  }
  await resolveDeaths(g, dead)
}
