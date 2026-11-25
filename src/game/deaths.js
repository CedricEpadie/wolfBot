// 💀 Morts : annonce, tir du chasseur, silence des morts
import { P, COMMAND_WORDS, REVEAL_ROLES, DEAD_SILENCE, HUNTER_SECONDS } from '../config.js'
import { sock } from '../whatsapp/socket.js'
import { say, sendText } from '../whatsapp/messaging.js'
import { norm, sleep, tag } from '../utils.js'
import { alive, living } from './players.js'
import { ROLES } from './roles.js'
import { askPick } from './prompts.js'
import { finishStep, waitStep } from './timers.js'
import { syncWolfGroup } from './wolfGroup.js'
import { finish, winnerOf } from './lifecycle.js'
import { tell, epitaph } from './narrator.js'
import { succeedMayor } from './mayor.js'

// ───────── Morts ─────────
const roleTag = (p) => `${ROLES[p.role].emoji} *${ROLES[p.role].label}*`
export const deathLine = (p) => (REVEAL_ROLES ? `☠️ ${tag(p.jid)} — c’était ${roleTag(p)}` : `☠️ ${tag(p.jid)}`)

// Annonce complète d’une mort : phrase dramatique + rôle révélé + épitaphe.
// kind : 'night' (neutre : on ne dit pas qui a tué) | 'vote' | 'hunter'
export const deathReport = (p, kind, extra = {}) =>
  `${tell(`death.${kind}`, { player: tag(p.jid), ...extra })}\n${deathLine(p)}\n${epitaph(p)}`

const hunterShot = async (g, h) => {
  const targets = living(g)
  if (!targets.length || !alive(g)) return
  g.phase = 'hunter'
  await say(g.key, tell('hunterStart', { player: tag(h.jid), s: HUNTER_SECONDS }), [h.jid])
  let chosen = null
  await askPick(g, h, {
    role: 'chasseur',
    title: 'TIRE !',
    subtitle: `Dernière balle • ${HUNTER_SECONDS} s`,
    items: targets,
    notes: ['Réponds avec le numéro du joueur à abattre.'],
    onPick: (t) => {
      chosen = t
      finishStep(g)
    },
  })
  await waitStep(g, HUNTER_SECONDS, { marks: [10], tick: () => sendText([h.dm, h.jid], '⏳ Plus que 10 secondes pour tirer !') })
  g.prompts.clear()
  if (!alive(g)) return
  if (chosen) {
    chosen.alive = false
    chosen.death = { kind: 'hunter', no: g.nightNo }
    await say(g.key, deathReport(chosen, 'hunter', { hunter: tag(h.jid) }), [h.jid, chosen.jid])
  } else {
    await say(g.key, tell('hunterMiss', { player: tag(h.jid) }), [h.jid])
  }
  await sleep(1500)
  await syncWolfGroup(g)
}

// Les morts ne parlent plus : le bot supprime leurs messages dans le groupe principal (il doit être admin).
const DEAD_CMDS = new Set(['role', 'carte', 'roles', 'regles', 'regle', 'rules', 'etat', 'statut', 'vivants', 'liste', 'top', 'stats', 'stat', 'profil', 'aide', 'help'])
const deadNotice = async (g) => {
  if (g.deadNoticed || DEAD_SILENCE === 'off') return
  g.deadNoticed = true
  await say(g.key, '🤐 *Rappel :* les morts ne parlent plus. Leurs messages seront supprimés, mais ils peuvent continuer à regarder la partie 👀')
}
// Retourne true si le message a été supprimé (ou doit être ignoré)
export const silenceDead = async (g, p, m, text) => {
  if (DEAD_SILENCE === 'off') return false
  if (text.startsWith(P)) {
    const [cmdRaw, ...args] = text.slice(P.length).trim().split(/\s+/)
    if (COMMAND_WORDS.has((cmdRaw || '').toLowerCase()) && DEAD_CMDS.has(norm(args[0] || ''))) return false // commandes de consultation autorisées
  }
  try {
    await sock.sendMessage(g.key, { delete: m.key })
  } catch (e) {
    console.warn('[loup-garou] suppression du message d’un mort impossible :', e.message)
    if (!g.deleteWarned) {
      g.deleteWarned = true
      await say(g.key, '⚠️ Je ne peux pas supprimer les messages des morts : je ne suis sans doute pas *admin*. Faites-moi admin, sinon jouez le jeu : 🤫 *les morts ne parlent plus* !')
    }
    return true
  }
  if (!p.warnedDead) {
    p.warnedDead = true
    await say(g.key, `🤫 ${tag(p.jid)}, les morts ne parlent plus ! Ton message a été supprimé. Tu peux continuer à regarder la partie 👀`, [p.jid])
  }
  return true
}

// Après des morts : tir du chasseur s’il est parmi eux. Retourne true si la partie est terminée.
export const resolveDeaths = async (g, dead) => {
  if (dead.length) await deadNotice(g)
  await syncWolfGroup(g)
  for (const p of dead) {
    if (p.role === 'chasseur') {
      await hunterShot(g, p)
      if (!alive(g)) return true
    }
  }
  const w = winnerOf(g)
  if (w) {
    await finish(g, w)
    return true
  }
  await succeedMayor(g) // le maire est mort : il désigne son successeur
  return !alive(g)
}
