// 💾 Sauvegarde des parties en cours (data/games.json) pour les reprendre après un redémarrage.
// On sauvegarde à des points sûrs (début de nuit, début de jour) : la reprise recommence la phase depuis son début.
import path from 'node:path'
import { DATA_DIR, RESUME_GAMES } from '../config.js'
import { readJson, writeJson } from './jsonStore.js'

const FILE = path.join(DATA_DIR, 'games.json')
const read = () => readJson(FILE, {})

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
  })),
  wolfGroup: g.wolfGroup ? { jid: g.wolfGroup.jid, present: g.wolfGroup.present, removed: [...g.wolfGroup.removed].map((p) => p.num) } : null,
})

export const saveGame = (g, resumeAt) => {
  if (!RESUME_GAMES) return
  const db = read()
  db[g.key] = serialize(g, resumeAt)
  writeJson(FILE, db)
}

export const clearSave = (key) => {
  const db = read()
  if (!(key in db)) return
  delete db[key]
  writeJson(FILE, db)
}

export const loadSaves = () => Object.values(read())
