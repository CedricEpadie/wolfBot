// 🃏 Attribution des rôles : tirage au sort pondéré par la mémoire des dernières parties.
//
// Un tirage 100 % indépendant produit beaucoup de répétitions (à 20 joueurs, ~27 % retombent sur le rôle de la
// partie précédente). Pour que les mêmes cartes n’aillent pas toujours aux mêmes joueurs, la probabilité de recevoir
// un rôle est réduite selon les parties récentes où le joueur l’a déjà eu (voir ROLE_ROTATION dans config.js) :
// jamais impossible, simplement moins probable. Les joueurs sans historique sont tirés à égalité.
import { ROLE_ROTATION } from '../config.js'
import { shuffle, weightedIndex } from '../random.js'

// Poids du souvenir : dernière partie, avant-dernière, etc.
const MEMORY = [0.75, 0.5, 0.3, 0.15]

// Poids d’un joueur pour un rôle : chaque partie récente où il l’avait déjà reçu le divise
export const roleWeight = (history, role, rotation = ROLE_ROTATION) =>
  history.reduce((w, r, i) => (r === role ? w * (1 - rotation * (MEMORY[i] ?? 0)) : w), 1)

// roles : liste des cartes • history : Map(joueur → rôles récents). Retourne Map(joueur → rôle).
export const assignRoles = (players, roles, history = new Map(), rotation = ROLE_ROTATION) => {
  const left = [...players]
  const out = new Map()
  // Les cartes sont traitées dans un ordre aléatoire pour qu’aucun rôle ne soit favorisé par sa position
  for (const role of shuffle(roles)) {
    const i = weightedIndex(left.map((p) => roleWeight(history.get(p) || [], role, rotation)))
    out.set(left[i], role)
    left.splice(i, 1)
  }
  return out
}
