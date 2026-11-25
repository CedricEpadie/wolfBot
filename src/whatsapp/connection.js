// 🔌 Connexion WhatsApp (Baileys) : QR / code de jumelage, reconnexion, réception des messages
import fs from 'node:fs'
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { AUTH_DIR, PAIRING_NUMBER, P, ROLE_DELIVERY, WOLF_GROUP } from '../config.js'
import { num } from '../utils.js'
import { setSock } from './socket.js'
import { cleanupOrphans } from '../game/wolfGroup.js'
import { resumeGames } from '../game/resume.js'
import { onMessage } from '../handlers/messages.js'

// ───────── Connexion WhatsApp ─────────
let pairingRequested = false

export const start = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  let version
  try {
    ;({ version } = await fetchLatestBaileysVersion())
  } catch (e) {
    console.warn('Version WhatsApp Web introuvable, version par défaut utilisée :', e.message)
  }

  const current = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })
  setSock(current)

  current.ev.on('creds.update', saveCreds)

  current.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      if (PAIRING_NUMBER && !state.creds.registered) {
        if (!pairingRequested) {
          pairingRequested = true
          try {
            const code = await current.requestPairingCode(PAIRING_NUMBER)
            console.log(`\n🔗 Code de jumelage : ${code}\nWhatsApp → Appareils connectés → Connecter un appareil → Lier avec le numéro de téléphone.\n`)
          } catch (e) {
            pairingRequested = false
            console.error('Impossible d’obtenir le code de jumelage :', e.message)
          }
        }
      } else {
        console.log('\n📱 Scanne ce QR code avec WhatsApp → Appareils connectés :\n')
        qrcode.generate(qr, { small: true })
      }
    }

    if (connection === 'open') {
      pairingRequested = false
      console.log(`✅ Bot connecté (${num(current.user?.id)}). Préfixe : ${P} • Cartes : ${ROLE_DELIVERY} • Groupe des loups : ${WOLF_GROUP}`)
      // D’abord reprendre les parties sauvegardées, puis dissoudre les groupes de loups orphelins (ceux des parties reprises sont conservés)
      resumeGames()
        .catch((e) => console.warn('[loup-garou] reprise des parties :', e.message))
        .then(() => cleanupOrphans())
        .catch((e) => console.warn('[loup-garou] nettoyage des groupes :', e.message))
    }

    if (connection === 'close') {
      pairingRequested = false
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        console.error('🔒 Session déconnectée par WhatsApp (401). Session supprimée : une nouvelle liaison est nécessaire.')
        fs.rmSync(AUTH_DIR, { recursive: true, force: true })
        setTimeout(() => start().catch(console.error), 2000)
      } else {
        console.warn(`⚠️ Connexion fermée (code ${code ?? '?'}), reconnexion…`)
        setTimeout(() => start().catch(console.error), 3000)
      }
    }
  })

  current.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) {
      try {
        await onMessage(m)
      } catch (e) {
        console.error('[loup-garou] erreur :', e)
      }
    }
  })
}
