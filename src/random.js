// 🎲 Source d’aléa UNIQUE du bot : générateur cryptographique (node:crypto) et tirages sans biais.
// Tout ce qui est « au hasard » dans le jeu (rôles, composition, égalités, phrases du narrateur, ordre des listes…)
// passe par ce module — jamais par Math.random.
import { randomBytes, randomInt } from 'node:crypto'

export const int = (n) => randomInt(n) // entier uniforme dans [0, n)
export const between = (a, b) => a + randomInt(b - a + 1) // entier uniforme dans [a, b]
export const float = () => Number(randomBytes(8).readBigUInt64BE() >> 11n) / 2 ** 53 // réel uniforme dans [0, 1) sur 53 bits
export const chance = (p) => float() < p // vrai avec la probabilité p
export const pick = (list) => (list.length ? list[randomInt(list.length)] : undefined)

// Mélange de Fisher-Yates (uniforme : chaque permutation a exactement la même probabilité)
export const shuffle = (list) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
export const sample = (list, k) => shuffle(list).slice(0, k)

// Indice tiré avec une probabilité proportionnelle au poids (poids ≥ 0, au moins un > 0)
export const weightedIndex = (weights) => {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = float() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return i
  }
  return weights.findLastIndex((w) => w > 0)
}
export const weightedPick = (items, weights) => items[weightedIndex(weights)]

// « Sac » : pioche SANS remise dans une liste, puis re-mélange quand il est vide. Garantit qu’une phrase ne revient
// qu’après avoir vu toutes les autres (bien plus varié qu’un simple « pas deux fois de suite »).
const bags = new Map()
export const bagDraw = (key, list) => {
  if (list.length === 1) return list[0]
  let bag = bags.get(key)
  if (!bag || !bag.queue.length || bag.size !== list.length) {
    const queue = shuffle(list)
    if (bag && bag.last !== undefined && queue[queue.length - 1] === bag.last) {
      // la prochaine carte tirée (fin de file) ne doit pas être celle qui vient de sortir
      const j = int(queue.length - 1)
      ;[queue[queue.length - 1], queue[j]] = [queue[j], queue[queue.length - 1]]
    }
    bag = { size: list.length, queue, last: bag?.last }
    bags.set(key, bag)
  }
  bag.last = bag.queue.pop()
  return bag.last
}
