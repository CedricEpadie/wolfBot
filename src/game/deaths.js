// 💀 Morts : annonce, tir du chasseur, silence des morts
import { P, COMMAND_WORDS, REVEAL_ROLES, DEAD_SILENCE, HUNTER_SECONDS } from '../config.js'
import { sock } from '../whatsapp/socket.js'
import { say, sendInfoCard } from '../whatsapp/messaging.js'
import { escRe, norm, num, onCooldown, sleep, tag } from '../utils.js'
import { alive, jidsOf, living } from './players.js'
import { ROLES } from './roles.js'
import { listCard } from '../cards/render.js'
import { finishStep, waitStep } from './timers.js'
import { syncWolfGroup } from './wolfGroup.js'
import { syncDeadGroup } from './deadGroup.js'
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

// Le chasseur tire sa dernière balle EN PUBLIC : la carte de choix est postée dans le groupe principal, il répond dans le
// groupe (numéro ou @mention) et tout le monde voit qui il emporte avec lui. Sans réponse à temps, il ne tire pas.
const HUNTER_REPLY = new RegExp(`^(?:${escRe(P)}\\s*(?:loup|loups|lg)\\s+)?(?:tir(?:e|er)?\\s+)?(\\d{1,2})$`, 'i')

// Appelé pour chaque message du chasseur pendant son tir ; retourne true si le message a été pris en compte
export const handleHunterReply = async (g, text, mentioned = []) => {
  const hp = g.hunterPick
  if (!hp || g.phase !== 'hunter') return false
  let target = null
  if (mentioned.length === 1) {
    target = hp.targets.find((t) => t.ids.has(num(mentioned[0]))) || null
  } else {
    const m = HUNTER_REPLY.exec(text.trim())
    if (!m) return false // simple bavardage : traité comme un message de mort (supprimé)
    target = hp.targets[Number(m[1]) - 1] || null
  }
  if (!target) {
    if (!onCooldown(`hunter-hint:${g.key}`, 4)) await say(g.key, `⛔ ${tag(hp.hunter.jid)} : cible invalide. Réponds avec un numéro entre *1* et *${hp.targets.length}* (voir la carte).`, [hp.hunter.jid])
    return true
  }
  hp.chosen = target
  finishStep(g)
  return true
}

const hunterShot = async (g, h) => {
  const targets = living(g)
  if (!targets.length || !alive(g)) return
  g.phase = 'hunter'
  g.hunterPick = { hunter: h, targets, chosen: null }
  const caption =
    `${tell('hunterStart', { player: tag(h.jid), s: HUNTER_SECONDS })}\n\n` +
    `🎯 ${tag(h.jid)}, désigne ta cible *ici, dans le groupe* : réponds par son *numéro* (ou mentionne-la avec @). Tout le monde verra ton choix.`
  const fallback = `${caption}\n\n${targets.map((p, i) => `${i + 1}. ${tag(p.jid)}`).join('\n')}`
  await sendInfoCard(
    g.key,
    () =>
      listCard({
        role: 'chasseur',
        title: 'TIRE !',
        subtitle: `Dernière balle • ${HUNTER_SECONDS} s`,
        items: targets,
        notes: ['Réponds dans le groupe avec le numéro de ta cible.', 'Tout le monde verra ton choix.'],
      }),
    fallback,
    { caption, mentions: [h.jid], fallbackMentions: [h.jid, ...jidsOf(targets)] }
  )
  await waitStep(g, HUNTER_SECONDS, { marks: [10], tick: () => say(g.key, `⏳ ${tag(h.jid)} : plus que 10 secondes pour tirer !`, [h.jid]) })
  const chosen = g.hunterPick?.chosen || null
  g.hunterPick = null
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
  await syncDeadGroup(g) // les nouveaux morts rejoignent le groupe des morts
  await succeedMayor(g) // le maire est mort : il désigne son successeur
  return !alive(g)
}
