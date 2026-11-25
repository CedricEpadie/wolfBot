// 📥 Réception des messages : aiguillage vers votes, commandes, privé, groupe des loups
import { normalizeMessageContent } from '@whiskeysockets/baileys'
import { P } from '../config.js'
import { escRe } from '../utils.js'
import { isOwnText } from '../whatsapp/messaging.js'
import { senderOf, hasId, findPlayer } from '../game/players.js'
import { games } from '../state.js'
import { wolfGroups, wolfGroupVote, WOLF_VOTE_RE } from '../game/wolfGroup.js'
import { silenceDead } from '../game/deaths.js'
import { registerVote } from '../game/day.js'
import { isVotePhase } from '../game/mayor.js'
import { handlePrivate } from './private.js'
import { handleCommand } from '../commands/index.js'

// ───────── Messages du groupe : votes par mention ou réponse ─────────
const handleGameText = async (chat, me, mentioned) => {
  const g = games.get(chat)
  if (!g || !isVotePhase(g)) return
  const voter = findPlayer(g, me.ids)
  if (!voter || !voter.alive) return
  // Seule une @mention vote, et un seul @ par message (répondre à un message ne vote pas : on discute !)
  if (mentioned.length !== 1) return
  return registerVote(g, voter, mentioned[0])
}

// ───────── Réception des messages ─────────
export const onMessage = async (m) => {
  if (!m.message || !m.key?.remoteJid) return
  const chat = m.key.remoteJid
  if (chat === 'status@broadcast' || chat.endsWith('@broadcast') || chat.endsWith('@newsletter')) return

  const c = normalizeMessageContent(m.message)
  const text = String(c?.conversation || c?.extendedTextMessage?.text || c?.imageMessage?.caption || c?.videoMessage?.caption || '').trim()
  if (m.key.fromMe && text && isOwnText(text)) return

  if (wolfGroups.has(chat)) {
    // Groupe secret des loups : seuls les votes (un numéro seul) comptent ; aucune commande ici
    const gw = [...games.values()].find((x) => x.wolfGroup?.jid === chat)
    const mm = gw?.wolfVote && text ? WOLF_VOTE_RE.exec(text) : null
    if (mm) {
      const who = senderOf(m)
      const wolf = who && gw.wolfVote.wolves.find((w) => hasId(w, who.ids))
      if (wolf) await wolfGroupVote(gw, wolf, Number(mm[1]))
    }
    return
  }
  const isGroup = chat.endsWith('@g.us')

  // Joueur éliminé qui écrit dans le groupe principal (texte, image, vocal, sticker…) : message supprimé
  if (isGroup && !m.key.fromMe) {
    const gm = games.get(chat)
    if (gm && gm.players.some((p) => p.role)) {
      const who = senderOf(m)
      const dead = who && gm.players.find((p) => !p.alive && hasId(p, who.ids))
      if (dead && (await silenceDead(gm, dead, m, text))) return
    }
  }

  if (!text) return
  const me = senderOf(m)
  if (!me) return
  // garde les noms à jour (pour les cartes)
  if (me.name) for (const g of games.values()) {
    const p = findPlayer(g, me.ids)
    if (p) p.name = me.name
  }
  const info = c?.extendedTextMessage?.contextInfo
  const mentioned = info?.mentionedJid || []

  if (!isGroup) {
    const isCmd = new RegExp(`^${escRe(P)}\\s*(loup|loups|lg)\\b`, 'i').test(text)
    if (!isCmd && (await handlePrivate(me, text))) return
  }
  if (text.startsWith(P)) return handleCommand(chat, isGroup, me, text, mentioned)
  if (isGroup) return handleGameText(chat, me, mentioned)
}
