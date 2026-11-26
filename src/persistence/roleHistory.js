// 🧠 Mémoire des rôles reçus par chaque joueur (table role_history) : sert à la rotation des rôles.
import { getDb, transaction } from './db.js'
import { resolveNum } from './stats.js'

export const HISTORY_DEPTH = 4 // nombre de parties passées prises en compte
const KEEP = 20 // lignes conservées par joueur

// Map(joueur → rôles reçus lors de ses dernières parties du groupe, le plus récent en premier)
export const recentRoles = (chat, players, depth = HISTORY_DEPTH) => {
  const q = getDb().prepare('SELECT role FROM role_history WHERE chat = ? AND num = ? ORDER BY id DESC LIMIT ?')
  return new Map(players.map((p) => [p, q.all(chat, resolveNum(chat, p.ids) ?? p.num, depth).map((r) => r.role)]))
}

// Enregistre les rôles qui viennent d’être distribués (même si la partie est ensuite interrompue : la carte a été vue)
export const recordRoles = (g) => {
  transaction((d) => {
    const put = d.prepare('INSERT INTO role_history (chat, num, role, given_at) VALUES (?, ?, ?, ?)')
    const putId = d.prepare('INSERT OR IGNORE INTO player_ids (chat, id, num) VALUES (?, ?, ?)')
    const prune = d.prepare('DELETE FROM role_history WHERE chat = ? AND num = ? AND id NOT IN (SELECT id FROM role_history WHERE chat = ? AND num = ? ORDER BY id DESC LIMIT ?)')
    for (const p of g.players) {
      const num = resolveNum(g.key, p.ids) ?? p.num
      put.run(g.key, num, p.role, Date.now())
      for (const id of new Set([num, ...p.ids])) putId.run(g.key, id, num)
      prune.run(g.key, num, g.key, num, KEEP)
    }
  })
}
