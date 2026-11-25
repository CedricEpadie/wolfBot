// 👑 Le Maire : élu au jour 1, voix double, tranche les égalités, désigne son successeur s’il meurt.
import { MAYOR, MAYOR_ELECTION_SECONDS, MAYOR_TIE_SECONDS, MAYOR_SUCCESSION_SECONDS } from '../config.js'
import { say, sendText } from '../whatsapp/messaging.js'
import { pick, sleep, tag } from '../utils.js'
import { alive, jidsOf, listOf, living } from './players.js'
import { askPick } from './prompts.js'
import { finishStep, waitStep } from './timers.js'
import { tell } from './narrator.js'

// Phases pendant lesquelles on vote en mentionnant (@) un joueur : élection du maire et vote du village
export const isVotePhase = (g) => g.phase === 'vote' || g.phase === 'mayor'

// Poids d’une voix : le maire compte double
export const voteWeight = (g, voter) => (g.mayor && g.mayor === voter ? 2 : 1)

// Décompte pondéré : Map(suspect → nombre de voix)
export const tally = (g) => {
  const counts = new Map()
  for (const [voter, target] of g.votes) counts.set(target, (counts.get(target) || 0) + voteWeight(g, voter))
  return counts
}

const leaders = (counts) => {
  const max = Math.max(...counts.values())
  return [...counts.entries()].filter(([, c]) => c === max).map(([p]) => p)
}

const crown = (g, p) => {
  g.mayor = p
  p.wasMayor = true
}

// Élection du maire (jour 1) : on vote en mentionnant le candidat, on peut voter pour soi
export const electMayor = async (g) => {
  if (!MAYOR || g.mayor || !alive(g)) return
  g.phase = 'mayor'
  g.votes = new Map()
  const voters = living(g)
  await say(
    g.key,
    `👑 *ÉLECTION DU MAIRE*\n${tell('mayorElection')}\n\n👥 *Joueurs en vie*\n${voters.map((p, i) => `${i + 1}. ${tag(p.jid)}`).join('\n')}\n\n` +
      `👉 Pour voter, *mentionne (@)* ton candidat : un seul @ par message (tu peux voter pour toi).\n` +
      `👑 Le maire a *2 voix*, *tranche les égalités* et choisit son successeur s’il meurt.\n⏱️ *${MAYOR_ELECTION_SECONDS} s*`,
    jidsOf(voters)
  )
  await waitStep(g, MAYOR_ELECTION_SECONDS, {
    marks: [30, 10],
    tick: (m) => {
      const pending = living(g).filter((p) => !g.votes.has(p))
      return say(g.key, `⏳ Élection : *${m} s* — ${g.votes.size}/${voters.length} vote(s).\n🕐 Reste à voter : ${listOf(pending)}`, jidsOf(pending))
    },
  })
  if (!alive(g)) return

  const counts = tally(g)
  let winner
  let phrase = 'mayorElected'
  if (!counts.size) {
    winner = pick(voters)
    phrase = 'mayorRandom'
  } else {
    const top = leaders(counts)
    winner = pick(top)
    if (top.length > 1) phrase = 'mayorTieElect'
  }
  crown(g, winner)
  g.votes = new Map()
  await say(g.key, `👑 *NOUVEAU MAIRE*\n${tell(phrase, { player: tag(winner.jid) })}\n\n✨ Sa voix compte *double* et il *tranche les égalités*.`, [winner.jid])
  await sleep(2000)
}

// Égalité au vote du village : le maire tranche (en privé). Sans réponse, le sort décide.
// Retourne le joueur à éliminer, ou null s’il n’y a pas de maire en vie (personne n’est alors éliminé).
export const mayorBreaksTie = async (g, tied) => {
  const mayor = g.mayor
  if (!MAYOR || !mayor?.alive) return null
  g.phase = 'tie'
  await say(
    g.key,
    `⚖️ *ÉGALITÉ !*\n${tell('tieAnnounce')}\n👑 Le maire ${tag(mayor.jid)} doit trancher entre : ${listOf(tied)}\n⏱️ *${MAYOR_TIE_SECONDS} s*`,
    [mayor.jid, ...jidsOf(tied)]
  )
  let chosen = null
  await askPick(g, mayor, {
    role: mayor.role,
    title: 'TRANCHE !',
    subtitle: `Égalité • ${MAYOR_TIE_SECONDS} s`,
    items: tied,
    notes: ['Tu es le maire : réponds avec le numéro', 'du joueur à éliminer.'],
    onPick: (t) => {
      chosen = t
      finishStep(g)
    },
  })
  await waitStep(g, MAYOR_TIE_SECONDS, { marks: [10], tick: () => sendText([mayor.dm, mayor.jid], '⏳ Plus que 10 secondes pour trancher !') })
  g.prompts.clear()
  if (!alive(g)) return null
  const victim = chosen || pick(tied)
  await say(g.key, tell(chosen ? 'tieMayorChose' : 'tieRandom', { mayor: tag(mayor.jid), player: tag(victim.jid) }), [mayor.jid, victim.jid])
  await sleep(1500)
  return victim
}

// Le maire est mort : il désigne son successeur (en privé). Sans réponse, le sort décide.
export const succeedMayor = async (g) => {
  const old = g.mayor
  if (!MAYOR || !old || old.alive) return
  const heirs = living(g)
  if (!heirs.length) return
  g.phase = 'succession'
  g.mayor = null
  await say(g.key, `${tell('mayorDies', { player: tag(old.jid) })}\n⏱️ *${MAYOR_SUCCESSION_SECONDS} s* pour désigner son successeur.`, [old.jid])
  let chosen = null
  await askPick(g, old, {
    role: old.role,
    title: 'TON SUCCESSEUR',
    subtitle: `Le maire est mort • ${MAYOR_SUCCESSION_SECONDS} s`,
    items: heirs,
    notes: ['Réponds avec le numéro du joueur', 'qui portera l’écharpe de maire.'],
    onPick: (t) => {
      chosen = t
      finishStep(g)
    },
  })
  await waitStep(g, MAYOR_SUCCESSION_SECONDS, { marks: [10], tick: () => sendText([old.dm, old.jid], '⏳ Plus que 10 secondes pour choisir ton successeur !') })
  g.prompts.clear()
  if (!alive(g)) return
  const heir = chosen || pick(heirs)
  crown(g, heir)
  await say(g.key, tell(chosen ? 'mayorSuccessor' : 'mayorSuccessorRandom', { from: tag(old.jid), player: tag(heir.jid) }), [old.jid, heir.jid])
  await sleep(1500)
}
