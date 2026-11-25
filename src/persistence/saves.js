// 💾 Sauvegarde des parties en cours (table saved_games) pour les reprendre après un redémarrage.
// On sauvegarde à des points sûrs (début de nuit, début de jour) : la reprise recommence la phase depuis son début.
import { RESUME_GAMES } from '../config.js'
import { getDb } from './db.js'

// Convertit une partie en données JSON (les Map/Set/objets joueurs deviennent des numéros)
const serialize = (g, resumeAt) => ({
  v: 1,
  key: g.key,
  resumeAt, // 'night' (rejouer la prochaine nuit) ou 'day' (rejouer le jour en cours)
  savedAt: Date.now(),
  starter: g.starter?.num ?? null,
  nightNo: g.nightNo || 0,
  witch: g.witch,
  lastProtected: g.lastProtected?.num ?? null,
  mayor: g.mayor?.num ?? null,
  deadNoticed: !!g.deadNoticed,
  players: g.players.map((p) => ({
    num: p.num,
    jid: p.jid,
    dm: p.dm,
    ids: [...p.ids],
    name: p.name,
    role: p.role,
    alive: p.alive,
    warnedDead: !!p.warnedDead,
    wasMayor: !!p.wasMayor,
    death: p.death || null,
  })),
  wolfGroup: g.wolfGroup ? { jid: g.wolfGroup.jid, present: g.wolfGroup.present, removed: [...g.wolfGroup.removed].map((p) => p.num) } : null,
})

export const saveGame = (g, resumeAt) => {
  if (!RESUME_GAMES) return
  const s = serialize(g, resumeAt)
  getDb().prepare('INSERT OR REPLACE INTO saved_games (key, resume_at, saved_at, data) VALUES (?, ?, ?, ?)').run(s.key, s.resumeAt, s.savedAt, JSON.stringify(s))
}

export const clearSave = (key) => {
  getDb().prepare('DELETE FROM saved_games WHERE key = ?').run(key)
}

export const loadSaves = () =>
  getDb()
    .prepare('SELECT data FROM saved_games')
    .all()
    .map((r) => JSON.parse(r.data))
