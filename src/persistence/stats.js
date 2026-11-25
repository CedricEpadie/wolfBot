// 📈 Statistiques par joueur et par groupe, conservées entre les redémarrages (data/stats.json)
import path from 'node:path'
import { DATA_DIR } from '../config.js'
import { readJson, writeJson } from './jsonStore.js'

const FILE = path.join(DATA_DIR, 'stats.json')
let db = null // { [jid du groupe]: { [numéro]: entrée } }
const load = () => (db ??= readJson(FILE, {}))

const blank = (p) => ({
  jid: p.jid,
  ids: [],
  name: p.name || '',
  played: 0,
  wins: 0,
  winsWolf: 0,
  winsVillage: 0,
  survived: 0,
  mayor: 0,
  streak: 0,
  bestStreak: 0,
  roles: {},
})

// Un même joueur peut apparaître sous un numéro ou sous un LID : on retrouve l’entrée par l’un de ses identifiants
const findEntry = (board, ids) => Object.values(board).find((e) => e.ids.some((i) => ids.has(i)))

// Enregistre une partie terminée (winner : 'village' | 'loups' | 'egalite')
export const recordGame = (g, winner) => {
  const data = load()
  const board = (data[g.key] ??= {})
  for (const p of g.players) {
    const e = findEntry(board, p.ids) || (board[p.num] = blank(p))
    e.jid = p.jid
    if (p.name) e.name = p.name
    e.ids = [...new Set([...e.ids, ...p.ids])]
    e.played++
    e.roles[p.role] = (e.roles[p.role] || 0) + 1
    if (p.alive) e.survived++
    if (p.wasMayor) e.mayor++
    const won = winner === 'village' ? p.role !== 'loup' : winner === 'loups' ? p.role === 'loup' : false
    if (won) {
      e.wins++
      if (p.role === 'loup') e.winsWolf++
      else e.winsVillage++
      e.streak++
      e.bestStreak = Math.max(e.bestStreak, e.streak)
    } else {
      e.streak = 0
    }
  }
  writeJson(FILE, data)
}

// Classement d’un groupe (les joueurs sans victoire n’y figurent pas)
export const topOf = (chat, n = 10) =>
  Object.values(load()[chat] || {})
    .filter((e) => e.wins > 0)
    .sort((a, b) => b.wins - a.wins || a.played - b.played)
    .slice(0, n)

// Statistiques d’un joueur (ids = ensemble de ses identifiants) ou null
export const statsOf = (chat, ids) => findEntry(load()[chat] || {}, ids) || null
