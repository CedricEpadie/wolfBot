// 🖼️ Chargement des ressources des cartes (emojis des rôles, emojis et métriques des noms)
import fs from 'node:fs'
import path from 'node:path'
import { ROOT } from '../paths.js'
import { ROLES, ROLE_ORDER } from '../game/roles.js'

export let NAME_EMOJI = {}
export let METRICS = { upm: 2048, adv: {} }
export const loadNameAssets = () => {
  try {
    NAME_EMOJI = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'emoji-names.json'), 'utf8'))
  } catch (e) {
    console.warn('[loup-garou] emojis des noms indisponibles :', e.message)
  }
  try {
    METRICS = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'dejavu-metrics.json'), 'utf8'))
  } catch (e) {
    console.warn('[loup-garou] métriques de la police indisponibles :', e.message)
  }
}

export const EMOJI = {}
export const loadEmoji = () => {
  for (const r of ROLE_ORDER) {
    EMOJI[r] = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'emoji', `${ROLES[r].img}.png`)).toString('base64')
  }
}
