// 📈 Statistiques par joueur et par groupe, conservées dans SQLite (tables players, player_ids, game_history)
import { getDb, transaction } from './db.js'

const toEntry = (r) => ({
  jid: r.jid,
  name: r.name,
  played: r.played,
  wins: r.wins,
  winsWolf: r.wins_wolf,
  winsVillage: r.wins_village,
  survived: r.survived,
  mayor: r.mayor,
  streak: r.streak,
  bestStreak: r.best_streak,
  roles: JSON.parse(r.roles),
})

// Un même joueur peut apparaître sous un numéro ou sous un LID : on retrouve sa ligne par l’un de ses identifiants
const findNum = (d, chat, ids) => {
  const list = [...ids]
  if (!list.length) return null
  const marks = list.map(() => '?').join(',')
  return d.prepare(`SELECT num FROM player_ids WHERE chat = ? AND id IN (${marks}) LIMIT 1`).get(chat, ...list)?.num ?? null
}

// Enregistre une partie terminée (winner : 'village' | 'loups' | 'egalite') — tout ou rien
export const recordGame = (g, winner) => {
  transaction((d) => {
    const getRow = d.prepare('SELECT * FROM players WHERE chat = ? AND num = ?')
    const upsert = d.prepare(
      `INSERT INTO players (chat, num, jid, name, played, wins, wins_wolf, wins_village, survived, mayor, streak, best_streak, roles)
       VALUES (@chat, @num, @jid, @name, @played, @wins, @wins_wolf, @wins_village, @survived, @mayor, @streak, @best_streak, @roles)
       ON CONFLICT (chat, num) DO UPDATE SET jid = @jid, name = @name, played = @played, wins = @wins, wins_wolf = @wins_wolf,
         wins_village = @wins_village, survived = @survived, mayor = @mayor, streak = @streak, best_streak = @best_streak, roles = @roles`
    )
    const putId = d.prepare('INSERT OR IGNORE INTO player_ids (chat, id, num) VALUES (?, ?, ?)')
    for (const p of g.players) {
      const num = findNum(d, g.key, p.ids) ?? p.num
      const old = getRow.get(g.key, num)
      const roles = old ? JSON.parse(old.roles) : {}
      roles[p.role] = (roles[p.role] || 0) + 1
      const won = winner === 'village' ? p.role !== 'loup' : winner === 'loups' ? p.role === 'loup' : false
      const streak = won ? (old?.streak || 0) + 1 : 0
      upsert.run({
        chat: g.key,
        num,
        jid: p.jid,
        name: p.name || old?.name || '',
        played: (old?.played || 0) + 1,
        wins: (old?.wins || 0) + (won ? 1 : 0),
        wins_wolf: (old?.wins_wolf || 0) + (won && p.role === 'loup' ? 1 : 0),
        wins_village: (old?.wins_village || 0) + (won && p.role !== 'loup' ? 1 : 0),
        survived: (old?.survived || 0) + (p.alive ? 1 : 0),
        mayor: (old?.mayor || 0) + (p.wasMayor ? 1 : 0),
        streak,
        best_streak: Math.max(old?.best_streak || 0, streak),
        roles: JSON.stringify(roles),
      })
      for (const id of new Set([num, ...p.ids])) putId.run(g.key, id, num)
    }
    d.prepare('INSERT INTO game_history (chat, ended_at, winner, players, nights) VALUES (?, ?, ?, ?, ?)').run(g.key, Date.now(), winner, g.players.length, g.nightNo || 0)
  })
}

// Classement d’un groupe (les joueurs sans victoire n’y figurent pas)
export const topOf = (chat, n = 10) =>
  getDb()
    .prepare('SELECT * FROM players WHERE chat = ? AND wins > 0 ORDER BY wins DESC, played ASC LIMIT ?')
    .all(chat, n)
    .map(toEntry)

// Statistiques d’un joueur (ids = ensemble de ses identifiants) ou null
export const statsOf = (chat, ids) => {
  const d = getDb()
  const num = findNum(d, chat, ids)
  const row = num && d.prepare('SELECT * FROM players WHERE chat = ? AND num = ?').get(chat, num)
  return row ? toEntry(row) : null
}
