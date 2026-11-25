// 👥 Joueurs : identification de l’expéditeur, recherche, listes
import { sock } from '../whatsapp/socket.js'
import { clean, num, tag } from '../utils.js'
import { games } from '../state.js'

export const senderOf = (m) => {
  const k = m.key
  const group = k.remoteJid.endsWith('@g.us')
  let jid
  let alt
  if (k.fromMe) {
    jid = sock?.user?.id
    alt = sock?.user?.lid
  } else if (group) {
    jid = k.participant
    alt = k.participantAlt || k.participantPn || k.senderPn
  } else {
    jid = k.remoteJid
    alt = k.remoteJidAlt || k.senderPn
  }
  if (!jid) return null
  jid = clean(jid)
  if (alt) alt = clean(alt)
  const ids = new Set([num(jid)])
  if (alt) ids.add(num(alt))
  const dm = [jid, alt].find((j) => j && j.endsWith('@s.whatsapp.net')) || jid
  return { jid, dm, ids, name: m.pushName || '' }
}

export const toPlayer = (s) => ({ num: num(s.jid), jid: s.jid, dm: s.dm, ids: s.ids, name: s.name, role: null, alive: true })
export const hasId = (p, ids) => !!p && [...ids].some((i) => p.ids.has(i))
export const findPlayer = (g, ids) => g.players.find((p) => hasId(p, ids))
export const jidsOf = (list) => list.map((p) => p.jid)
export const listOf = (list) => list.map((p) => tag(p.jid)).join(', ')
export const living = (g) => g.players.filter((p) => p.alive)
export const alive = (g) => games.get(g.key) === g && !g.aborted
