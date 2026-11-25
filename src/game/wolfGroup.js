// 🐺 Groupe secret des loups : création, vote, retrait des morts, dissolution
import path from 'node:path'
import { DATA_DIR, WOLF_GROUP, ROLE_DELIVERY, NIGHT_WOLF_SECONDS, SELF_DESTRUCT } from '../config.js'
import { sock } from '../whatsapp/socket.js'
import { say, sendText, wipeChat } from '../whatsapp/messaging.js'
import { dissolveGroup } from '../whatsapp/group.js'
import { num, sleep, shuffle, tag } from '../utils.js'
import { listOf, jidsOf } from './players.js'
import { textName } from '../cards/names.js'
import { listCard } from '../cards/render.js'
import { games } from '../state.js'
import { finishStep } from './timers.js'
import { readJson, writeJson } from '../persistence/jsonStore.js'

// ───────── Groupe secret des loups ─────────
const WOLF_FILE = path.join(DATA_DIR, 'wolf-groups.json')
const readWolfFile = () => readJson(WOLF_FILE, [])
const writeWolfFile = (list) => writeJson(WOLF_FILE, list)
export const wolfGroups = new Set(readWolfFile()) // jids des groupes de loups connus (pour ne pas y traiter de commandes)
const trackWolfGroup = (jid) => {
  wolfGroups.add(jid)
  writeWolfFile([...new Set([...readWolfFile(), jid])])
}
const untrackWolfGroup = (jid) => {
  wolfGroups.delete(jid)
  writeWolfFile(readWolfFile().filter((x) => x !== jid))
}


export const createWolfGroup = async (g) => {
  const wolves = g.players.filter((p) => p.role === 'loup')
  if (WOLF_GROUP === 'off' || wolves.length < 2) return
  try {
    const meta = await sock.groupCreate('🐺 Meute — Loup-Garou', wolves.map((w) => w.dm))
    const jid = meta.id
    g.wolfGroup = { jid, present: true, removed: new Set() }
    if (WOLF_GROUP === 'keep') trackWolfGroup(jid)
    else wolfGroups.add(jid)

    // Qui a pu être ajouté ? Les autres reçoivent un lien d’invitation en privé.
    const inGroup = new Set()
    try {
      const m = await sock.groupMetadata(jid)
      for (const x of m.participants || []) for (const v of [x.id, x.lid, x.jid, x.phoneNumber]) if (v) inGroup.add(num(v))
    } catch {}
    const missing = wolves.filter((w) => ![...w.ids].some((i) => inGroup.has(i)))
    if (missing.length) {
      let link = null
      try {
        link = 'https://chat.whatsapp.com/' + (await sock.groupInviteCode(jid))
      } catch (e) {
        console.warn('[loup-garou] lien d’invitation impossible :', e.message)
      }
      if (link) {
        for (const w of missing) {
          await sendText([w.dm, w.jid], `🐺 Je n’ai pas pu t’ajouter au groupe secret de la meute (réglage de confidentialité ?). Rejoins-le avec ce lien, sans le partager :\n${link}`)
        }
      }
    }

    const welcome = await say(
      jid,
      `🐺 *LA MEUTE*\n\nBienvenue, loups-garous : ${listOf(wolves)}\n\n` +
        (WOLF_GROUP === 'keep'
          ? `🔒 Ce groupe est fermé, sauf pendant votre étape de nuit : la carte « Qui dévorer ? » arrivera *ici*, vous vous concerterez, puis vous voterez en envoyant *seulement un numéro*. ` +
            `Les loups éliminés sont retirés du groupe, et il sera dissous à la fin de la partie. 🌕`
          : `Ici, discutez librement et mettez-vous d’accord. Chaque nuit, la victime se choisit en répondant par un *numéro* à la carte que je vous envoie *en privé*.\n` +
            `Je quitte ce groupe pour que personne d’autre que vous n’ait accès à vos messages. À la fin de la partie, quittez-le. 🌕`),
      jidsOf(wolves)
    )
    await say(g.key, '🐺 La meute a son propre groupe secret… 🤫')
    if (WOLF_GROUP === 'keep') await setWolfGroupLocked(g, true)
    if (WOLF_GROUP === 'leave') {
      g.wolfGroup.present = false
      try {
        await sock.groupLeave(jid)
      } catch (e) {
        console.warn('[loup-garou] sortie du groupe impossible :', e.message)
      }
      setTimeout(() => wipeChat(jid, welcome).catch(() => {}), 2000)
    }
  } catch (e) {
    console.warn('[loup-garou] création du groupe des loups impossible (relais en privé à la place) :', e.message)
    g.wolfGroup = null
  }
}

// Retire du groupe les loups morts
export const syncWolfGroup = async (g) => {
  const wg = g.wolfGroup
  if (!wg?.present) return
  const dead = g.players.filter((p) => p.role === 'loup' && !p.alive && !wg.removed.has(p))
  if (!dead.length) return
  for (const p of dead) wg.removed.add(p)
  await say(wg.jid, `💀 ${listOf(dead)} a été éliminé : il quitte la meute…`, jidsOf(dead))
  for (const p of dead) {
    try {
      await sock.groupParticipantsUpdate(wg.jid, [p.jid], 'remove')
    } catch {
      try {
        await sock.groupParticipantsUpdate(wg.jid, [p.dm], 'remove')
      } catch (e) {
        console.warn('[loup-garou] retrait du loup impossible :', e.message)
      }
    }
  }
}

// Fin de partie : dissout le groupe (mode keep) ou prévient les loups de le quitter (mode leave)
export const endWolfGroup = async (g, { quick = false } = {}) => {
  const wg = g.wolfGroup
  if (!wg) return
  g.wolfGroup = null
  if (!wg.present) {
    for (const w of g.players.filter((p) => p.role === 'loup')) {
      await sendText([w.dm, w.jid], '🌕 La partie est terminée : tu peux quitter le groupe de la meute.')
    }
    return
  }
  const sent = await say(wg.jid, '🌕 *La partie est terminée.* Ce groupe se dissout dans quelques secondes…')
  if (!quick) await sleep(6000)
  await dissolveGroup(wg.jid)
  setTimeout(() => wipeChat(wg.jid, sent).catch(() => {}), 2000)
  untrackWolfGroup(wg.jid)
}

// Au démarrage : dissout les groupes de loups restés ouverts après un plantage
export const cleanupOrphans = async () => {
  for (const jid of readWolfFile()) {
    if ([...games.values()].some((g) => g.wolfGroup?.jid === jid)) continue
    await dissolveGroup(jid)
    untrackWolfGroup(jid)
  }
}

export const notifyWolfVote = (g, wolves, w, t) =>
  g.wolfGroup?.present
    ? say(g.wolfGroup.jid, `🗳️ ${tag(w.jid)} vote contre *${textName(t)}*`, [w.jid])
    : Promise.all(wolves.filter((o) => o !== w).map((o) => sendText([o.dm, o.jid], `🐺 ${textName(w)} vote contre *${textName(t)}*.`, { destruct: SELF_DESTRUCT })))

// Le groupe des loups (mode keep) n’est ouvert que pendant leur étape de nuit : le bot le ferme et le rouvre.
export const setWolfGroupLocked = async (g, locked) => {
  const wg = g.wolfGroup
  if (!wg?.present || WOLF_GROUP !== 'keep') return
  try {
    await sock.groupSettingUpdate(wg.jid, locked ? 'announcement' : 'not_announcement')
    wg.locked = locked
  } catch (e) {
    console.warn('[loup-garou] verrouillage du groupe des loups impossible :', e.message)
  }
}

// Vote de la meute DANS le groupe des loups : une carte commune, on vote en envoyant seulement un numéro.
// Retourne true si le vote est ouvert dans le groupe (sinon : repli sur les cartes privées).
export const startWolfGroupVote = async (g, wolves, targets) => {
  const wg = g.wolfGroup
  if (!wg?.present) return false
  const list = shuffle(targets)
  await setWolfGroupLocked(g, false)
  const fallback =
    `🐺 *QUI DÉVORER ?* — Nuit ${g.nightNo}\n\n` + list.map((p, i) => `${i + 1}. ${textName(p)}`).join('\n')
  try {
    await say(
      wg.jid,
      `🌙 *Nuit ${g.nightNo}* — à vous de jouer, la meute ! 🐺\n` +
        `Concertez-vous ici, puis votez en envoyant *seulement un numéro* (ex. : 3) d’après la carte ci-dessous.\n` +
        `Le dernier vote de chacun compte • ⏱️ ${NIGHT_WOLF_SECONDS} s • le groupe se referme ensuite.`,
      jidsOf(wolves)
    )
    if (ROLE_DELIVERY === 'text') await sock.sendMessage(wg.jid, { text: fallback })
    else {
      const image = await listCard({
        role: 'loup',
        title: 'QUI DÉVORER ?',
        subtitle: `Nuit ${g.nightNo} • ${NIGHT_WOLF_SECONDS} s`,
        items: list,
        notes: ['Écrivez seulement un numéro dans le groupe pour voter.', 'Le dernier vote de chacun compte.'],
      })
      await sock.sendMessage(wg.jid, { image, mimetype: 'image/jpeg', caption: `🐺 *QUI DÉVORER ?* — Nuit ${g.nightNo}` })
    }
  } catch (e) {
    console.warn('[loup-garou] carte de vote dans le groupe des loups impossible (repli en privé) :', e.message)
    await setWolfGroupLocked(g, true)
    return false
  }
  g.wolfVote = { list, wolves }
  return true
}

export const WOLF_VOTE_RE = /^\s*(?:vote\s+)?(\d{1,2})\s*$/i
export const wolfGroupVote = async (g, wolf, n) => {
  const wv = g.wolfVote
  if (!wv || g.phase !== 'night' || !wolf.alive) return
  if (n < 1 || n > wv.list.length) {
    await say(g.wolfGroup.jid, `⛔ ${tag(wolf.jid)} : numéro invalide (1 à ${wv.list.length}).`, [wolf.jid])
    return
  }
  const target = wv.list[n - 1]
  g.night.wolfVotes.set(wolf, target)
  await notifyWolfVote(g, wv.wolves, wolf, target)
  if (wv.wolves.every((w) => g.night.wolfVotes.has(w))) finishStep(g)
}
