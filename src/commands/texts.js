// 📖 Textes d’aide : règles, rôles, liste des commandes
import { P, COMPOSITION_RANDOM, MIN_PLAYERS, MAX_PLAYERS, VOYANTE_REVEAL_NAME, MAYOR, NECROMANCER, MENTALIST, NECRO_MIN_PLAYERS, MENTALIST_MIN_PLAYERS } from '../config.js'
import { ROLES, ROLE_ORDER, compoText } from '../game/roles.js'

export const RULES = () =>
  `📖 *RÈGLES DU LOUP-GAROU*\n\n` +
  `🏡 *Village* : démasquer et éliminer tous les loups.\n🐺 *Loups-Garous* : devenir aussi nombreux que les autres joueurs.\n\n` +
  `🌙 *La nuit* (le groupe est fermé) : le Garde protège et la Voyante sonde (dans un ordre variable chaque nuit), puis les Loups choisissent une victime, puis la Sorcière agit. Tout se passe par cartes numérotées en privé.\n` +
  `☀️ *Le jour* (le groupe est rouvert) : le bot annonce les morts (et leur rôle), le village débat puis vote. Le joueur le plus voté est éliminé (${MAYOR ? 'égalité = le maire tranche' : 'égalité = personne'}).\n` +
  (MAYOR ? `👑 *Le maire* est élu au jour 1 : sa voix compte double, il tranche les égalités et désigne son successeur s’il meurt.\n` : '') +
  `\n` +
  `🛡️ Le Garde ne peut pas protéger deux nuits de suite la même personne. Un joueur protégé n’est pas dévoré.\n` +
  `🧙‍♀️ La Sorcière a 1 potion de vie et 1 potion de mort, une seule potion par nuit.\n` +
  `🏹 Le Chasseur emporte un joueur dans sa mort (nuit ou vote).\n` +
  `🔮 La Voyante est bavarde : le rôle qu’elle découvre est annoncé à tous${VOYANTE_REVEAL_NAME ? ' avec le nom du joueur' : ' (sans le nom du joueur)'}.\n` +
  (NECROMANCER ? `👻 Le Nécromancien (dès ${NECRO_MIN_PLAYERS} joueurs) rejoint chaque nuit le *groupe des morts*, créé au premier mort, pour les interroger : ils peuvent répondre… ou mentir. Il en est retiré à l’aube.\n` : '') +
  (MENTALIST ? `🎩 Le Mentaliste (dès ${MENTALIST_MIN_PLAYERS} joueurs) reçoit en privé, pendant le vote, des prémonitions vagues sur la tournure du vote. Le vote dure alors un peu plus longtemps.\n` : '') +
  `💀 Les morts ne parlent plus dans le groupe principal : silence jusqu’à la fin ! 🤐\n\n` +
  `👥 ${MIN_PLAYERS} à ${MAX_PLAYERS} joueurs • *${P}loup roles* pour la composition.`

export const ROLES_TEXT = () => {
  const lines = ROLE_ORDER.map((r) => `${ROLES[r].emoji} *${ROLES[r].label}* — ${ROLES[r].short}`).join('\n')
  const table = []
  for (let n = MIN_PLAYERS; n <= Math.min(MAX_PLAYERS, MIN_PLAYERS + 6); n++) table.push(`• ${n} joueurs : ${compoText(n)}`)
  return `🎭 *RÔLES DISPONIBLES*\n\n${lines}\n\n📊 *Composition type selon le nombre de joueurs*\n${table.join('\n')}\n• …au-delà : 1 loup de plus tous les 3 joueurs${COMPOSITION_RANDOM ? '\n\n🎲 Chaque partie est tirée au sort : ±1 loup dès 10 joueurs, un rôle spécial peut manquer ou être remplacé par un « invité » (Nécromancien, Mentaliste).' : ''}`
}

export const HELP = () =>
  `🐺 *LOUP-GAROU — commandes*\n\n` +
  `*${P}loup* — ouvrir une partie\n*${P}loup join* — rejoindre\n*${P}loup go* — lancer (lanceur)\n*${P}loup stop* — annuler (lanceur)\n` +
  `*${P}loup role* — renvoyer ma carte (aussi en privé)\n*${P}loup roles* — rôles et composition\n*${P}loup regles* — règles\n` +
  `*${P}loup etat* — état de la partie\n*${P}loup vivants* — joueurs en vie\n*${P}loup vote @x* — voter\n` +
  `*${P}loup passer* — passer le débat (lanceur)\n*${P}loup top* — classement\n*${P}loup stats* — mes statistiques (ou *stats @x*)\n*${P}loup ouvrir* — rouvrir le groupe`
