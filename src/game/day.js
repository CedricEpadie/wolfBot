// ☀️ Jour : élection du maire (jour 1), débat, vote public pondéré, dépouillement
import { P, DAY_SECONDS, VOTE_SECONDS } from '../config.js'
import { say } from '../whatsapp/messaging.js'
import { num, sleep, tag } from '../utils.js'
import { alive, jidsOf, listOf, living } from './players.js'
import { finishStep, waitStep } from './timers.js'
import { deathReport, resolveDeaths } from './deaths.js'
import { electMayor, isVotePhase, mayorBreaksTie, tally, voteWeight } from './mayor.js'
import { tell } from './narrator.js'

// `explicit` = vote fait avec la commande « /loup vote @x » (réponse d’erreur utile). Un simple @ dans la discussion
// qui ne désigne pas un joueur vivant (ou soi-même) est ignoré en silence : ce n’est pas un vote.
// Fonctionne pour l’élection du maire (phase « mayor », on peut voter pour soi) et pour le vote du village (phase « vote »).
export const registerVote = async (g, voter, targetJid, explicit = false) => {
  if (!isVotePhase(g) || !voter?.alive) return
  const election = g.phase === 'mayor'
  const suspect = g.players.find((p) => p.alive && p.ids.has(num(targetJid)))
  if (!suspect) return explicit ? say(g.key, `⛔ ${tag(voter.jid)} : ce joueur n’est pas en vie ou ne participe pas.`, [voter.jid]) : undefined
  if (suspect === voter && !election) return explicit ? say(g.key, `⛔ ${tag(voter.jid)} : tu ne peux pas voter contre toi-même !`, [voter.jid]) : undefined
  const changed = g.votes.has(voter)
  g.votes.set(voter, suspect)
  const against = tally(g).get(suspect)
  const pending = living(g).filter((p) => !g.votes.has(p))
  const double = voteWeight(g, voter) === 2 ? ' 👑 (voix double)' : ''
  const head = election
    ? changed
      ? `🔄 ${tag(voter.jid)} change son vote et soutient maintenant ${tag(suspect.jid)} (${against} voix pour lui)`
      : `🗳️ ${tag(voter.jid)} vote pour ${tag(suspect.jid)} (${against} voix pour lui)`
    : changed
      ? `🔄 ${tag(voter.jid)}${double} change son vote et vote maintenant contre ${tag(suspect.jid)} (${against} voix contre lui)`
      : `🗳️ ${tag(voter.jid)}${double} vote contre ${tag(suspect.jid)} (${against} voix contre lui)`
  await say(
    g.key,
    `${head}\n` + (pending.length ? `🕐 Reste à voter : ${listOf(pending)}` : '✅ Tout le monde a voté !'),
    [voter.jid, suspect.jid, ...jidsOf(pending)]
  )
  if (!pending.length) finishStep(g)
}

export const day = async (g) => {
  g.phase = 'day'
  if (g.nightNo === 1) {
    await electMayor(g)
    if (!alive(g)) return
    g.phase = 'day'
  }
  const alivePl = living(g)
  await say(
    g.key,
    `🗣️ *DÉBAT* — ${alivePl.length} joueur(s) en vie\n${listOf(alivePl)}\n\n${tell('debate')}\n` +
      (g.mayor?.alive ? `👑 Maire : ${tag(g.mayor.jid)} (voix double)\n` : '') +
      `⏱️ *${DAY_SECONDS} s* — le lanceur peut taper *${P}loup passer* pour voter tout de suite.`,
    jidsOf(alivePl)
  )
  await waitStep(g, DAY_SECONDS, {
    marks: [60, 30, 10],
    tick: (m) => say(g.key, m > 10 ? `⏳ Il reste *${m} s* de débat…` : `🚨 Le vote commence dans *${m} s* !`),
  })
  if (!alive(g)) return

  g.phase = 'vote'
  g.votes = new Map()
  const voters = living(g)
  await say(
    g.key,
    `🗳️ *VOTE DU VILLAGE*\n${tell('voteStart')}\n\n👥 *Joueurs en vie*\n${voters.map((p, i) => `${i + 1}. ${tag(p.jid)}${p === g.mayor ? ' 👑' : ''}`).join('\n')}\n\n` +
      `👉 Pour voter, *mentionne (@)* le suspect : un seul @ par message.\n` +
      `Répondre à un message ne compte pas • votes publics • le dernier vote compte • pas de vote pour soi-même.\n` +
      (g.mayor?.alive ? `👑 La voix du maire compte *double* et il tranche les égalités.\n` : '') +
      `⏱️ *${VOTE_SECONDS} s*`,
    jidsOf(voters)
  )
  await waitStep(g, VOTE_SECONDS, {
    marks: [30, 15, 5],
    tick: (m) => {
      const pending = living(g).filter((p) => !g.votes.has(p))
      return say(g.key, `⏳ *${m} s* — ${g.votes.size}/${voters.length} vote(s).\n🕐 Reste à voter : ${listOf(pending)}`, jidsOf(pending))
    },
  })
  if (!alive(g)) return

  await say(g.key, tell('voteClosed'))
  await sleep(2500)
  if (!alive(g)) return

  const counts = tally(g)
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (!ranking.length) {
    await say(g.key, tell('noVotes'))
    return
  }
  const lines = ranking.map(([p, c]) => `${'🟥'.repeat(c)} ${tag(p.jid)} — ${c} voix`).join('\n')
  const mayorVoted = g.mayor?.alive && g.votes.has(g.mayor)
  await say(g.key, `📊 *Résultat du vote*\n\n${lines}${mayorVoted ? '\n\n👑 La voix du maire compte double.' : ''}`, ranking.map(([p]) => p.jid))
  await sleep(2000)
  if (!alive(g)) return

  const tied = ranking.filter(([, c]) => c === ranking[0][1]).map(([p]) => p)
  let victim = tied[0]
  if (tied.length > 1) {
    victim = await mayorBreaksTie(g, tied) // le maire tranche ; sans maire en vie : personne n’est éliminé
    if (!alive(g)) return
    if (!victim) {
      await say(g.key, `⚖️ *Égalité !* ${tell('tieAnnounce')} Personne n’est éliminé.`)
      return
    }
  }
  victim.alive = false
  await say(g.key, `⚖️ *Le village a tranché !*\n${deathReport(victim, 'vote')}`, [victim.jid])
  await sleep(2000)
  if (!alive(g)) return
  await resolveDeaths(g, [victim])
}
