// ℹ️ Commandes d’information : role, roles, regles, aide, etat, vivants, top
import { P, INFO_DELIVERY } from '../config.js'
import { say, sendCard, sendInfoCard } from '../whatsapp/messaging.js'
import { num, onCooldown, tag } from '../utils.js'
import { games } from '../state.js'
import { rankOf, statsOf, topOf } from '../persistence/stats.js'
import { recentRoles } from '../persistence/roleHistory.js'
import { rulesCard, rolesCard, compositionCard } from '../cards/infoCards.js'
import { podiumCard } from '../cards/endCards.js'
import { statsCard } from '../cards/statsCard.js'
import { ROLES } from '../game/roles.js'
import { findPlayer, jidsOf, listOf, living } from '../game/players.js'
import { roleCardFor } from '../cards/roleCard.js'
import { RULES, ROLES_TEXT, HELP } from './texts.js'

const resendRole = async ({ chat, isGroup, me }) => {
  let game = null
  for (const g of games.values()) if (g.players.some((p) => p.role) && findPlayer(g, me.ids)) game = g
  if (!game) return say(chat, 'Je ne te trouve dans aucune partie en cours (ou les cartes ne sont pas encore distribuées).')
  if (onCooldown(`role:${num(me.jid)}`, 10)) return say(chat, '⏳ Patiente quelques secondes avant de redemander ta carte.')
  const p = findPlayer(game, me.ids)
  const c = roleCardFor(game, p)
  const r = await sendCard(p, c.render, c.text, c.caption)
  if (!isGroup) return r.ok ? undefined : say(chat, `Impossible de t’envoyer ta carte pour le moment.\n🔧 ${r.error}`)
  return say(
    chat,
    r.ok ? `📩 ${tag(me.jid)} : carte renvoyée en privé.` : `Impossible de t’écrire en privé : envoie-moi d’abord un message en privé, puis *${P}loup role*.\n🔧 ${r.error}`,
    [me.jid]
  )
}

// Rôles : une carte pour les pouvoirs, une pour la composition (ou un seul texte si les images sont désactivées)
const sendRoles = async ({ chat }) => {
  if (INFO_DELIVERY === 'text') return say(chat, ROLES_TEXT())
  const ok = await sendInfoCard(chat, rolesCard, ROLES_TEXT(), { caption: '🎭 *Les rôles du Loup-Garou*' })
  if (ok) await sendInfoCard(chat, () => compositionCard(), '', { caption: '📊 *Composition selon le nombre de joueurs*' })
}

const showTop = async ({ chat }) => {
  const sorted = topOf(chat, 10, { includeZero: true })
  if (!sorted.length) return say(chat, 'Aucune partie jouée pour l’instant. Lancez-en une ! 🐺')
  const medals = ['🥇', '🥈', '🥉']
  const text = `🏆 *Classement du Loup-Garou*\n\n${sorted.map((e, i) => `${medals[i] || '▫️'} ${tag(e.jid)} — ${e.wins} victoire(s) / ${e.played} partie(s)`).join('\n')}\n\n📈 *${P}loup stats* : tes statistiques`
  await sendInfoCard(chat, () => podiumCard({ entries: sorted }), text, { caption: '🏆 *Classement du groupe*', mentions: sorted.map((e) => e.jid) })
}

// Statistiques d’un joueur : le sien, ou celui qu’on mentionne (« /loup stats @x »), en carte image
const showStats = async ({ chat, me, mentioned }) => {
  const target = mentioned[0]
  const ids = target ? new Set([num(target)]) : me.ids
  const e = statsOf(chat, ids)
  const who = target || me.jid
  if (!e) return say(chat, `📈 ${tag(who)} n’a pas encore terminé de partie ici. Lancez-en une avec *${P}loup* !`, [who])
  const rate = Math.round((e.wins / e.played) * 100)
  const roles = Object.entries(e.roles)
    .sort((a, b) => b[1] - a[1])
    .map(([r, k]) => `${ROLES[r]?.emoji || '❔'} ×${k}`)
    .join('  ')
  const text =
    `📈 *Statistiques de ${tag(who)}*\n\n` +
    `🎮 Parties : *${e.played}* • 🏆 Victoires : *${e.wins}* (${rate} %)\n` +
    `🐺 Victoires en loup : ${e.winsWolf} • 🏡 en village : ${e.winsVillage}\n` +
    `🔥 Série en cours : ${e.streak} (record : ${e.bestStreak})\n` +
    `🫀 Survivant : ${e.survived} fois • 👑 Maire : ${e.mayor} fois\n` +
    `🎭 Rôles joués : ${roles}`
  const probe = { ids, num: [...ids][0] }
  const recent = recentRoles(chat, [probe], 6).get(probe) || []
  return sendInfoCard(chat, () => statsCard({ entry: e, rank: rankOf(chat, ids), recent }), text, { caption: `📈 *Statistiques de ${tag(who)}*`, mentions: [who] })
}

const showState = ({ chat, g }) => {
  if (!g) return say(chat, `Aucune partie en cours. Lance-en une avec *${P}loup*.`)
  const phaseLabel = { lobby: '🚪 Salle d’attente', roles: '🎴 Distribution des cartes', night: `🌙 Nuit ${g.nightNo}`, day: `☀️ Jour ${g.nightNo} — débat`, vote: `🗳️ Jour ${g.nightNo} — vote`, hunter: '🏹 Tir du chasseur', mayor: '👑 Élection du maire', tie: '⚖️ Égalité : le maire tranche', succession: '👑 Succession du maire' }[g.phase] || g.phase
  const left = g.deadline ? Math.max(0, Math.ceil((g.deadline - Date.now()) / 1000)) : null
  const dead = g.players.filter((p) => !p.alive)
  return say(
    chat,
    `📊 *État de la partie*\n\n🧭 ${phaseLabel}\n👥 En vie (${living(g).length}/${g.players.length}) : ${listOf(living(g))}\n` +
      (g.mayor ? `👑 Maire : ${tag(g.mayor.jid)}\n` : '') +
      (dead.length ? `💀 Morts : ${listOf(dead)}\n` : '') +
      (left !== null && g.phase !== 'night' ? `⏱️ Temps restant : *${left} s*\n` : ''),
    jidsOf(g.players)
  )
}

const showAlive = ({ chat, g }) => {
  if (!g) return say(chat, 'Aucune partie en cours.')
  const list = g.phase === 'lobby' ? g.players : living(g)
  return say(chat, `👥 *${g.phase === 'lobby' ? 'Inscrits' : 'Joueurs en vie'}* (${list.length})\n${list.map((p, i) => `${i + 1}. ${tag(p.jid)}${p === g.mayor ? ' 👑' : ''}`).join('\n')}`, jidsOf(list))
}

export const infoCommands = [
  { names: ['role', 'carte'], run: resendRole },
  { names: ['roles'], run: sendRoles },
  { names: ['regles', 'regle', 'rules'], run: ({ chat }) => sendInfoCard(chat, rulesCard, RULES(), { caption: '📖 *Règles du Loup-Garou*' }) },
  { names: ['aide', 'help'], run: ({ chat }) => say(chat, HELP()) },
  { names: ['top'], groupOnly: true, run: showTop },
  { names: ['stats', 'stat', 'profil'], groupOnly: true, run: showStats },
  { names: ['etat', 'statut'], groupOnly: true, run: showState },
  { names: ['vivants', 'liste'], groupOnly: true, run: showAlive },
]
