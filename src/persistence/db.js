// 🗄️ Base SQLite unique (DATA_DIR/wolfbot.db) : statistiques, historique, parties sauvegardées, groupes de loups.
// Utilise le module intégré `node:sqlite` (Node ≥ 22.13) : aucune dépendance native à compiler.
import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from '../config.js'

// Le module est encore marqué « expérimental » par Node : on masque ce seul avertissement au chargement.
const emitWarning = process.emitWarning
process.emitWarning = (w, ...rest) => (/sqlite/i.test(String(w?.message ?? w)) ? undefined : emitWarning.call(process, w, ...rest))
const { DatabaseSync } = await import('node:sqlite')
process.emitWarning = emitWarning

export const DB_FILE = path.join(DATA_DIR, 'wolfbot.db')

// Schéma : pour le faire évoluer, ajouter une étape dans MIGRATIONS (jamais modifier une étape déjà publiée).
const MIGRATIONS = [
  `CREATE TABLE players (
     chat TEXT NOT NULL, num TEXT NOT NULL, jid TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
     played INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
     wins_wolf INTEGER NOT NULL DEFAULT 0, wins_village INTEGER NOT NULL DEFAULT 0,
     survived INTEGER NOT NULL DEFAULT 0, mayor INTEGER NOT NULL DEFAULT 0,
     streak INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0,
     roles TEXT NOT NULL DEFAULT '{}',
     PRIMARY KEY (chat, num)
   );
   CREATE TABLE player_ids (chat TEXT NOT NULL, id TEXT NOT NULL, num TEXT NOT NULL, PRIMARY KEY (chat, id));
   CREATE TABLE game_history (
     id INTEGER PRIMARY KEY AUTOINCREMENT, chat TEXT NOT NULL, ended_at INTEGER NOT NULL,
     winner TEXT NOT NULL, players INTEGER NOT NULL, nights INTEGER NOT NULL
   );
   CREATE INDEX idx_history_chat ON game_history (chat, ended_at);
   CREATE TABLE saved_games (key TEXT PRIMARY KEY, resume_at TEXT NOT NULL, saved_at INTEGER NOT NULL, data TEXT NOT NULL);
   CREATE TABLE wolf_groups (jid TEXT PRIMARY KEY);`,
]

let db = null

export const getDb = () => {
  if (db) return db
  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new DatabaseSync(DB_FILE)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
  const version = db.prepare('PRAGMA user_version').get().user_version
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN')
    try {
      db.exec(MIGRATIONS[v])
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }
  if (version === 0) importLegacyJson(db)
  return db
}

// Exécute `fn` dans une transaction (tout ou rien)
export const transaction = (fn) => {
  const d = getDb()
  d.exec('BEGIN')
  try {
    const r = fn(d)
    d.exec('COMMIT')
    return r
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }
}

// ───────── Import unique des anciens fichiers JSON (v2) ─────────
const readLegacy = (name) => {
  const file = path.join(DATA_DIR, name)
  if (!fs.existsSync(file)) return null
  try {
    return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) }
  } catch {
    return null
  }
}
const markImported = (file) => {
  try {
    fs.renameSync(file, `${file}.imported`)
  } catch {}
}

const importLegacyJson = (d) => {
  const stats = readLegacy('stats.json')
  const games = readLegacy('games.json')
  const wolves = readLegacy('wolf-groups.json')
  if (!stats && !games && !wolves) return
  d.exec('BEGIN')
  try {
    const putPlayer = d.prepare(
      `INSERT OR REPLACE INTO players (chat, num, jid, name, played, wins, wins_wolf, wins_village, survived, mayor, streak, best_streak, roles)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const putId = d.prepare('INSERT OR IGNORE INTO player_ids (chat, id, num) VALUES (?, ?, ?)')
    for (const [chat, board] of Object.entries(stats?.data || {})) {
      for (const [num, e] of Object.entries(board)) {
        putPlayer.run(chat, num, e.jid, e.name || '', e.played || 0, e.wins || 0, e.winsWolf || 0, e.winsVillage || 0, e.survived || 0, e.mayor || 0, e.streak || 0, e.bestStreak || 0, JSON.stringify(e.roles || {}))
        for (const id of new Set([num, ...(e.ids || [])])) putId.run(chat, id, num)
      }
    }
    const putGame = d.prepare('INSERT OR REPLACE INTO saved_games (key, resume_at, saved_at, data) VALUES (?, ?, ?, ?)')
    for (const s of Object.values(games?.data || {})) putGame.run(s.key, s.resumeAt, s.savedAt, JSON.stringify(s))
    const putWolf = d.prepare('INSERT OR IGNORE INTO wolf_groups (jid) VALUES (?)')
    for (const jid of Array.isArray(wolves?.data) ? wolves.data : []) putWolf.run(jid)
    d.exec('COMMIT')
  } catch (e) {
    d.exec('ROLLBACK')
    console.warn('[loup-garou] import des anciens fichiers JSON impossible :', e.message)
    return
  }
  for (const l of [stats, games, wolves]) if (l) markImported(l.file)
  console.log('[loup-garou] anciennes données JSON importées dans la base SQLite.')
}
