// 🔧 Commandes d’administration : ouvrir (rouvrir le groupe resté fermé)
import { sock } from '../whatsapp/socket.js'
import { say } from '../whatsapp/messaging.js'

const reopenGroup = async ({ chat, g }) => {
  if (g) return say(chat, 'Une partie est en cours : le bot gère lui-même la fermeture du groupe.')
  try {
    await sock.groupSettingUpdate(chat, 'not_announcement')
    return say(chat, '🔓 Groupe rouvert.')
  } catch (e) {
    return say(chat, `❌ Impossible de rouvrir le groupe (suis-je admin ?).\n🔧 ${e.message}`)
  }
}

export const adminCommands = [{ names: ['ouvrir'], groupOnly: true, run: reopenGroup }]
