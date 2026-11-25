// 💬 Messages privés : réponses aux cartes de nuit (numéro, potions de la sorcière, relais des loups)
import { SELF_DESTRUCT } from '../config.js'
import { sendText } from '../whatsapp/messaging.js'
import { norm } from '../utils.js'
import { findPlayer } from '../game/players.js'
import { finishStep } from '../game/timers.js'
import { plainName } from '../cards/names.js'
import { games } from '../state.js'

// ───────── Messages privés : choix de nuit ─────────
export const handlePrivate = async (me, text) => {
  for (const g of games.values()) {
    const p = findPlayer(g, me.ids)
    const pr = p && g.prompts?.get(p)
    if (!pr) continue

    const reply = (t) => sendText([p.dm, p.jid], t)

    if (pr.kind === 'witch') {
      const t = norm(text)
      if (t === 'rien' || t === 'non' || t === 'passer' || t === 'fin') {
        g.prompts.delete(p)
        await reply('✅ Compris : tu ne fais rien cette nuit.')
        finishStep(g)
      } else if (t === 'vie' || t === 'sauver') {
        if (!g.witch.life) {
          await reply('⛔ Ta potion de vie est déjà utilisée.')
          return true
        }
        if (!pr.victim) {
          await reply('⛔ Il n’y a personne à sauver cette nuit.')
          return true
        }
        g.witch.life = false
        g.night.saved = true
        g.prompts.delete(p)
        await reply('✅ Potion de vie utilisée.')
        finishStep(g)
      } else if (/^(mort|poison|tuer)\s+\d{1,2}$/.test(t)) {
        const n = Number(t.split(' ')[1])
        if (!g.witch.death) {
          await reply('⛔ Ta potion de mort est déjà utilisée.')
          return true
        }
        if (n < 1 || n > pr.list.length) {
          await reply(`⛔ Numéro invalide (1 à ${pr.list.length}).`)
          return true
        }
        g.witch.death = false
        g.night.poisoned = pr.list[n - 1]
        g.prompts.delete(p)
        await reply('✅ Potion de mort utilisée.')
        finishStep(g)
      } else {
        await reply('⛔ Réponds « vie », « mort N » (N = numéro du joueur) ou « rien ».')
      }
      return true
    }

    const m = /^\/?\s*(\d{1,2})\s*$/.exec(text)
    if (!m) {
      if (pr.kind === 'wolf' && g.wolfGroup) {
        await reply('🐺 Discute avec ta meute dans le groupe secret. Ici, réponds seulement avec un numéro.')
        return true
      }
      if (pr.kind === 'wolf' && pr.wolves && pr.wolves.length > 1) {
        const msg = `🐺 ${plainName(p)} : ${text.slice(0, 200)}`
        for (const o of pr.wolves) if (o !== p) await sendText([o.dm, o.jid], msg, { destruct: SELF_DESTRUCT })
        return true
      }
      await reply(`⛔ Réponds avec un numéro entre 1 et ${pr.list.length}.`)
      return true
    }
    const n = Number(m[1])
    if (n < 1 || n > pr.list.length) {
      await reply(`⛔ Numéro invalide (1 à ${pr.list.length}).`)
      return true
    }
    if (!pr.keep) g.prompts.delete(p)
    await reply('✅ Choix enregistré.')
    await pr.onPick(pr.list[n - 1])
    return true
  }
  return false
}
