import { float } from './random.js'

// 🧰 Petits utilitaires génériques (aucune dépendance au jeu)

const cooldowns = new Map()

export const num = (jid) => String(jid || '').split('@')[0].split(':')[0]
export const clean = (jid) => {
  const [user, server] = String(jid || '').split('@')
  return `${user.split(':')[0]}@${server}`
}
export const tag = (jid) => '@' + num(jid)
// Aléa : voir random.js (générateur cryptographique, tirages sans biais)
export { pick, shuffle } from './random.js'
export const rand = (a, b) => a + float() * (b - a)
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const progressBar = (done, total) => '▰'.repeat(done) + '▱'.repeat(total - done)
export const onCooldown = (id, seconds) => {
  const now = Date.now()
  if ((cooldowns.get(id) || 0) > now) return true
  cooldowns.set(id, now + seconds * 1000)
  return false
}
