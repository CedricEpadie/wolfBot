// 🧠 État global en mémoire des parties en cours.
// (Les statistiques et les sauvegardes sont persistantes : voir src/persistence/.)
export const games = new Map() // une partie par groupe (clé = jid du groupe)
