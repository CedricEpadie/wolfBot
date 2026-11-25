// 📤 Envoi de messages WhatsApp : groupe, privé, cartes, effacement
import { sock } from './socket.js'
import { WIPE_DM_CHAT, SELF_DESTRUCT, ROLE_DELIVERY, INFO_DELIVERY } from '../config.js'

const sentTexts = [] // derniers textes envoyés par le bot (évite de les prendre pour des commandes)
export const isOwnText = (text) => sentTexts.includes(text)

export const say = async (chat, text, mentions = []) => {
  sentTexts.push(text)
  if (sentTexts.length > 60) sentTexts.shift()
  try {
    return await sock.sendMessage(chat, { text, mentions })
  } catch (e) {
    console.error('[loup-garou] envoi impossible :', e.message)
    return null
  }
}

export const editMsg = async (chat, sent, text, mentions = []) => {
  if (!sent?.key) return
  try {
    await sock.sendMessage(chat, { text, edit: sent.key, mentions })
  } catch {}
}

// Efface la conversation privée côté bot (le téléphone du bot n’en garde pas de trace)
export const wipeChat = async (jid, sent) => {
  if (!WIPE_DM_CHAT || !sent?.key) return
  try {
    await sock.chatModify(
      { delete: true, lastMessages: [{ key: sent.key, messageTimestamp: Number(sent.messageTimestamp) }] },
      jid
    )
  } catch (e) {
    console.warn('[loup-garou] effacement de la conversation impossible :', e.message)
  }
}

const afterSend = (jid, sent, destruct = SELF_DESTRUCT) => {
  setTimeout(() => wipeChat(jid, sent).catch(() => {}), 3000)
  if (destruct > 0 && sent?.key) {
    setTimeout(async () => {
      try {
        await sock.sendMessage(jid, { delete: sent.key })
      } catch {}
    }, destruct * 1000)
  }
}

// Message privé simple (confirmations, messages entre loups). Retourne true si envoyé.
export const sendText = async (jids, text, { destruct = 0 } = {}) => {
  for (const jid of [...new Set([].concat(jids).filter(Boolean))]) {
    try {
      const sent = await sock.sendMessage(jid, { text })
      afterSend(jid, sent, destruct)
      return true
    } catch (e) {
      console.error('[loup-garou] message privé impossible :', e.message)
    }
  }
  return false
}

// Envoie une carte privée à `p` (image, ou texte si ROLE_DELIVERY=text). Ne journalise jamais le contenu.
// Retourne { ok: true } ou { ok: false, error }.
export const sendCard = async (p, renderFn, fallbackText, caption) => {
  let content
  try {
    content = ROLE_DELIVERY === 'text' ? { text: fallbackText } : { image: await renderFn(), mimetype: 'image/jpeg', caption }
  } catch (e) {
    console.error('[loup-garou] génération de la carte impossible :', e.message)
    return { ok: false, error: `génération de la carte impossible (${e.message})` }
  }
  let lastError = 'erreur inconnue'
  for (const jid of [...new Set([p.dm, p.jid].filter(Boolean))]) {
    try {
      const sent = await sock.sendMessage(jid, content)
      console.log(`[loup-garou] envoi privé accepté par WhatsApp (destinataire : ${jid.endsWith('@lid') ? 'LID' : 'numéro'})`)
      afterSend(jid, sent)
      return { ok: true }
    } catch (e) {
      lastError = e?.message || String(e)
      console.error('[loup-garou] envoi privé impossible :', lastError)
    }
  }
  return { ok: false, error: lastError }
}

// Carte d’information PUBLIQUE (règles, rôles, composition…) envoyée dans un chat : image + légende, ou texte
// (INFO_DELIVERY=text, ou si l’image ne peut pas être générée). Retourne true si l’image a été envoyée.
export const sendInfoCard = async (chat, render, fallbackText, { caption = '', mentions = [] } = {}) => {
  if (INFO_DELIVERY === 'photo') {
    try {
      const image = await render()
      sentTexts.push(caption)
      await sock.sendMessage(chat, { image, mimetype: 'image/jpeg', caption, mentions })
      return true
    } catch (e) {
      console.warn('[loup-garou] carte d’information impossible, envoi en texte :', e.message)
    }
  }
  if (fallbackText) await say(chat, fallbackText, mentions)
  return false
}
