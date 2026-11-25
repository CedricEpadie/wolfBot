// 🐺 LOUP-GAROU — point d’entrée : vérifie les ressources puis lance la connexion WhatsApp
import { ROLE_DELIVERY, INFO_DELIVERY } from './config.js'
import { ROLES, ROLE_ORDER } from './game/roles.js'
import { loadNameAssets, loadEmoji } from './cards/assets.js'
import { bigCard, listCard } from './cards/render.js'
import { rulesCard, rolesCard, compositionCard } from './cards/infoCards.js'
import { start } from './whatsapp/connection.js'

process.on('unhandledRejection', (e) => console.error('unhandledRejection :', e))
process.on('uncaughtException', (e) => console.error('uncaughtException :', e))

loadNameAssets()
try {
  loadEmoji() // aussi nécessaire aux cartes d’information (règles, rôles, composition)
} catch (e) {
  console.warn('[loup-garou] emojis des rôles indisponibles :', e.message)
}

// Vérifie au démarrage que les cartes peuvent être générées (emojis, polices, sharp)
if (ROLE_DELIVERY === 'photo') {
  try {
    for (const r of ROLE_ORDER) {
      await bigCard({ role: r, title: ROLES[r].label, subtitle: ROLES[r].camp, lines: ROLES[r].lines })
    }
    await listCard({ role: 'garde', title: 'TEST', subtitle: 'test', items: [{ name: 'Test', num: '0000' }], notes: ['ok'] })
  } catch (e) {
    console.error(
      `❌ Impossible de générer les cartes (${e.message}).\n` +
        `   Vérifie que « yarn install » a bien installé sharp et que les dossiers assets/ et fonts/ sont présents,\n` +
        `   ou mets ROLE_DELIVERY=text dans .env (cartes en texte, sans image).`
    )
    process.exit(1)
  }
}

// Les cartes d’information publiques ne bloquent pas le démarrage : en cas de problème, le bot enverra du texte
if (INFO_DELIVERY === 'photo') {
  try {
    await Promise.all([rulesCard(), rolesCard(), compositionCard({ highlight: 6 })])
  } catch (e) {
    console.warn(`[loup-garou] cartes d’information impossibles (${e.message}) : les règles et rôles seront envoyés en texte.`)
  }
}

start().catch((e) => {
  console.error('Démarrage impossible :', e)
  process.exit(1)
})
