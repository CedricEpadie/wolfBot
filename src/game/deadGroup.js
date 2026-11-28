// 👻 Le groupe des morts : créé dès le PREMIER mort, chaque nouveau mort y est ajouté, toujours ouvert aux morts.
// Le Nécromancien (vivant) n’y est ajouté que pendant la nuit, puis retiré à l’aube.
import { DEAD_GROUP } from '../config.js'
import { sock } from '../whatsapp/socket.js'
import { say, sendText, wipeChat } from '../whatsapp/messaging.js'
import { dissolveGroup } from '../whatsapp/group.js'
import { num, sleep } from '../utils.js'
import { alive, jidsOf, listOf } from './players.js'
import { tell } from './narrator.js'
import { trackWolfGroup, untrackWolfGroup } from './wolfGroup.js'

// État : g.deadGroup = { jid, added: Set(joueurs morts déjà ajoutés), necroIn: le Nécromancien est dans le groupe }

const NAME = '👻 Les Morts — Loup-Garou'
const INVITE_DEAD = '👻 Je n’ai pas pu t’ajouter au groupe des morts (réglage de confidentialité ?). Rejoins-le avec ce lien, sans le partager :'

const memberIds = async (jid) => {
  const ids = new Set()
  try {
    const m = await sock.groupMetadata(jid)
    for (const x of m.participants || []) for (const v of [x.id, x.lid, x.jid, x.phoneNumber]) if (v) ids.add(num(v))
  } catch (e) {
    console.warn('[loup-garou] liste des membres du groupe des morts illisible :', e.message)
  }
  return ids
}
const isIn = (ids, p) => [...p.ids].some((i) => ids.has(i))

// Les joueurs qu’on n’a pas pu ajouter (réglage de confidentialité) reçoivent un lien d’invitation en privé
const inviteMissing = async (jid, players, message) => {
  const inGroup = await memberIds(jid)
  const missing = players.filter((p) => !isIn(inGroup, p))
  if (!missing.length) return
  let link = null
  try {
    link = 'https://chat.whatsapp.com/' + (await sock.groupInviteCode(jid))
  } catch (e) {
    console.warn('[loup-garou] lien d’invitation du groupe des morts impossible :', e.message)
  }
  if (link) for (const p of missing) await sendText([p.dm, p.jid], `${message}\n${link}`)
}

const addPlayers = async (jid, players, message) => {
  if (!players.length) return
  try {
    const res = await sock.groupParticipantsUpdate(jid, players.map((p) => p.dm || p.jid), 'add')
    const refused = (res || []).filter((r) => r?.status && !['200', '201'].includes(String(r.status)))
    if (refused.length) console.warn('[loup-garou] ajout au groupe des morts refusé pour', refused.length, 'joueur(s), codes :', refused.map((r) => r.status).join(','))
  } catch (e) {
    console.warn('[loup-garou] ajout au groupe des morts impossible :', e.message)
  }
  await inviteMissing(jid, players, message) // ceux qui n’ont pas pu être ajoutés reçoivent un lien
}

const removePlayer = async (jid, p) => {
  try {
    await sock.groupParticipantsUpdate(jid, [p.jid], 'remove')
  } catch {
    try {
      await sock.groupParticipantsUpdate(jid, [p.dm], 'remove')
    } catch (e) {
      console.warn('[loup-garou] retrait du groupe des morts impossible :', e.message)
    }
  }
}

const necroOf = (g) => g.players.find((p) => p.role === 'necromancien' && p.alive)

// Création : on essaie plusieurs formes de participants (numéro, identifiant, puis groupe vide complété ensuite)
const createGroup = async (souls) => {
  const forms = [souls.map((p) => p.dm), souls.map((p) => p.jid), []].filter((l, i, a) => a.findIndex((x) => x.join() === l.join()) === i)
  let lastErr = null
  for (const participants of forms) {
    try {
      const meta = await sock.groupCreate(NAME, participants)
      if (meta?.id) return { meta, lastErr: null }
      lastErr = new Error('réponse sans identifiant de groupe')
    } catch (e) {
      lastErr = e
      console.warn(`[loup-garou] création du groupe des morts refusée (${participants.length} participant(s)) :`, e.message)
      await sleep(1200)
    }
  }
  return { meta: null, lastErr }
}

const createDeadGroup = async (g, souls) => {
  const { meta, lastErr } = await createGroup(souls)
  if (!meta) {
    // L’échec doit être VISIBLE (une seule fois par partie) ; on réessaie à la prochaine mort
    if (!g.deadGroupWarned) {
      g.deadGroupWarned = true
      await say(g.key, `⚠️ Je n’ai pas pu créer le groupe des morts (${String(lastErr?.message || 'erreur inconnue').slice(0, 120)}). Je réessaierai à la prochaine mort.`)
    }
    return
  }
  // Le groupe existe : on le mémorise AVANT toute autre opération, pour ne jamais le perdre ni le recréer en double
  g.deadGroup = { jid: meta.id, added: new Set(souls), necroIn: false }
  trackWolfGroup(meta.id) // suivi en base : dissous au redémarrage si la partie est perdue ; commandes ignorées ici
  const necroInGame = g.players.some((p) => p.role === 'necromancien')
  try {
    const inGroup = await memberIds(meta.id)
    await addPlayers(meta.id, souls.filter((p) => !isIn(inGroup, p)), INVITE_DEAD) // ceux qui n’ont pas pu être ajoutés à la création
    await say(
      meta.id,
      `👻 *LES MORTS*\n\nBienvenue chez les défunts : ${listOf(souls)}\n\n` +
        `🗣️ Ici, parlez librement : les vivants ne vous lisent pas.\n` +
        (necroInGame ? `🕯️ Chaque nuit, un visiteur — *le Nécromancien* — peut descendre vous poser des questions jusqu’à l’aube. Répondez… ou trompez-le !\n` : '') +
        `🤫 Ne dévoilez rien aux vivants : c’est une règle d’honneur.`,
      jidsOf(souls)
    )
    await say(g.key, '👻 Un groupe des morts vient d’être créé : les éliminés y sont ajoutés (ou reçoivent un lien d’invitation en privé).')
  } catch (e) {
    console.warn('[loup-garou] finalisation du groupe des morts incomplète :', e.message)
  }
}

// Ajoute au groupe les joueurs morts (le crée au premier mort). À appeler après chaque résolution de morts.
export const syncDeadGroup = async (g) => {
  if (!DEAD_GROUP) return
  const souls = g.players.filter((p) => !p.alive)
  if (!souls.length) return
  const dg = g.deadGroup
  if (!dg) return createDeadGroup(g, souls)
  const fresh = souls.filter((p) => !dg.added.has(p))
  if (!fresh.length) return
  for (const p of fresh) dg.added.add(p)
  await addPlayers(dg.jid, fresh, INVITE_DEAD)
  await say(dg.jid, `💀 ${listOf(fresh)} rejoint les morts…`, jidsOf(fresh))
}

// Attend `ms` ms par pas d’une seconde, et s’arrête dès que la partie est terminée ou annulée
const sleepWhile = async (g, ms) => {
  for (let left = ms; left > 0 && alive(g); left -= 1000) await sleep(Math.min(1000, left))
}

// Retire le Nécromancien du groupe des morts (à l’aube)
export const dismissNecro = async (g) => {
  const dg = g.deadGroup
  const necro = necroOf(g)
  if (!dg?.necroIn || !necro) return
  dg.necroIn = false
  await say(dg.jid, tell('necro.leave'))
  await removePlayer(dg.jid, necro)
  await sendText([necro.dm, necro.jid], '🌅 Le jour se lève : tu quittes le groupe des morts. En as-tu appris assez ?')
}

// Visite nocturne : le Nécromancien rejoint les morts pendant `seconds` s, puis est retiré
export const necroVisit = async (g, seconds) => {
  const necro = necroOf(g)
  if (!necro) return
  await syncDeadGroup(g) // crée le groupe s’il y a des morts et qu’il n’existe pas encore (nouvelle tentative)
  const dg = g.deadGroup
  if (!dg) {
    const anyDead = g.players.some((p) => !p.alive)
    await sendText(
      [necro.dm, necro.jid],
      anyDead
        ? '👻 *NÉCROMANCIEN* — Le groupe des morts n’a pas pu être créé cette nuit (WhatsApp l’a refusé). Je réessaie à la prochaine mort.'
        : '👻 *NÉCROMANCIEN* — Personne n’est encore mort : aucune âme à interroger cette nuit. Reviens quand le village aura perdu quelqu’un…'
    )
    return
  }
  await addPlayers(dg.jid, [necro], INVITE_DEAD)
  dg.necroIn = true
  await sendText(
    [necro.dm, necro.jid],
    `👻 *NÉCROMANCIEN* — Tu es dans le groupe des morts jusqu’à l’aube (au moins ${seconds} s). Pose-leur tes questions : ils peuvent répondre… ou mentir ! Ne révèle pas ton rôle au village.`
  )
  await say(dg.jid, tell('necro.visit'))
  await sleepWhile(g, seconds * 1000)
  if (alive(g)) await dismissNecro(g)
}

// Fin de partie : dissout le groupe des morts
export const endDeadGroup = async (g, { quick = false } = {}) => {
  const dg = g.deadGroup
  if (!dg) return
  g.deadGroup = null
  const sent = await say(dg.jid, '🌕 *La partie est terminée.* Ce groupe se dissout dans quelques secondes…')
  if (!quick) await sleep(6000)
  await dissolveGroup(dg.jid)
  setTimeout(() => wipeChat(dg.jid, sent).catch(() => {}), 2000)
  untrackWolfGroup(dg.jid)
}
