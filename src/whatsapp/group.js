// 🏘️ Opérations sur les groupes WhatsApp : admin, fermeture/ouverture, dissolution, numéros privés
import { sock } from './socket.js'
import { say } from './messaging.js'
import { clean, num } from '../utils.js'

// ───────── Résolution des numéros privés (LID → numéro) ─────────
export const resolveDms = async (g) => {
  const lids = g.players.filter((p) => p.dm.endsWith('@lid'))
  if (!lids.length) return
  try {
    const meta = await sock.groupMetadata(g.key)
    for (const p of lids) {
      const m = (meta.participants || []).find((x) => [x.id, x.lid, x.jid, x.phoneNumber].some((v) => v && num(v) === num(p.dm)))
      const pn = m && [m.phoneNumber, m.jid, m.id].find((v) => v && String(v).endsWith('@s.whatsapp.net'))
      if (pn) {
        p.dm = clean(pn)
        p.ids.add(num(pn))
      }
    }
  } catch (e) {
    console.warn('[loup-garou] résolution des numéros impossible :', e.message)
  }
}

// ───────── Groupe : fermeture la nuit, ouverture le jour ─────────
export const isBotAdmin = async (chat) => {
  try {
    const meta = await sock.groupMetadata(chat)
    const mine = new Set([num(sock.user?.id), num(sock.user?.lid)].filter(Boolean))
    const me = (meta.participants || []).find((x) => [x.id, x.lid, x.jid, x.phoneNumber].some((v) => v && mine.has(num(v))))
    return !!me && !!me.admin
  } catch {
    return null // inconnu
  }
}

export const lockGroup = async (g, lock) => {
  try {
    await sock.groupSettingUpdate(g.key, lock ? 'announcement' : 'not_announcement')
    g.locked = lock
    return true
  } catch (e) {
    console.warn('[loup-garou] verrouillage du groupe impossible :', e.message)
    if (!g.lockWarned) {
      g.lockWarned = true
      await say(
        g.key,
        `⚠️ Je ne peux pas ${lock ? 'fermer' : 'rouvrir'} le groupe : je ne suis sans doute pas *admin*. Faites-moi admin pour une vraie nuit silencieuse ; sinon, jouez le jeu : 🤫 *silence la nuit* !`
      )
    }
    return false
  }
}

// Retire tous les membres puis quitte le groupe : WhatsApp supprime alors le groupe vide.
export const dissolveGroup = async (jid) => {
  try {
    const meta = await sock.groupMetadata(jid)
    const mine = new Set([num(sock.user?.id), num(sock.user?.lid)].filter(Boolean))
    const others = (meta.participants || []).filter((x) => ![x.id, x.lid, x.jid, x.phoneNumber].some((v) => v && mine.has(num(v)))).map((x) => x.id)
    if (others.length) await sock.groupParticipantsUpdate(jid, others, 'remove')
  } catch (e) {
    console.warn('[loup-garou] retrait des membres impossible :', e.message)
  }
  try {
    await sock.groupLeave(jid)
  } catch (e) {
    console.warn('[loup-garou] sortie du groupe impossible :', e.message)
  }
}
