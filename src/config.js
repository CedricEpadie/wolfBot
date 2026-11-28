// ⚙️ Configuration : variables d’environnement (.env) et réglages du jeu
import path from 'node:path'
import './env.js' // charge le .env AVANT la lecture des variables ci-dessous
import { ROOT } from './paths.js'

// ───────── Configuration (variables d’environnement) ─────────
export const P = process.env.PREFIX || '/'
export const AUTH_DIR = process.env.AUTH_DIR || path.join(ROOT, 'auth') // dossier de session : à placer sur un volume persistant
export const PAIRING_NUMBER = (process.env.PAIRING_NUMBER || '').replace(/\D/g, '') // ex. 237600000000 → connexion par code au lieu du QR
// photo : carte image envoyée en privé, supprimée après ROLE_SELF_DESTRUCT s • text : même chose en texte
export const ROLE_DELIVERY = (process.env.ROLE_DELIVERY || 'photo').toLowerCase() === 'text' ? 'text' : 'photo'
export const SELF_DESTRUCT = Number(process.env.ROLE_SELF_DESTRUCT ?? 60) || 0
export const WIPE_DM_CHAT = (process.env.WIPE_DM_CHAT || 'true').toLowerCase() !== 'false'
// Voyante bavarde : le RÔLE découvert est annoncé au village. Mettre true pour annoncer aussi le NOM du joueur.
export const VOYANTE_REVEAL_NAME = (process.env.VOYANTE_REVEAL_NAME || 'false').toLowerCase() === 'true'
// Groupe secret des loups : keep = le bot crée le groupe, y reste, retire les loups morts et le dissout à la fin
// leave = le bot crée le groupe puis le quitte aussitôt (il ne voit plus rien, mais ne peut plus le dissoudre)
// off = pas de groupe, les messages des loups sont relayés par le bot en privé
export const WOLF_GROUP = ['keep', 'leave', 'off'].includes((process.env.WOLF_GROUP || 'keep').toLowerCase()) ? (process.env.WOLF_GROUP || 'keep').toLowerCase() : 'keep'
// Joueurs éliminés dans le groupe principal : delete = le bot supprime leurs messages (il doit être admin) • off = rien
export const DEAD_SILENCE = (process.env.DEAD_SILENCE || 'delete').toLowerCase() === 'off' ? 'off' : 'delete'
// Révéler le rôle des joueurs morts
export const REVEAL_ROLES = (process.env.REVEAL_ROLES || 'true').toLowerCase() !== 'false'

// ───────── Réglages du jeu ─────────
export const MIN_PLAYERS = Math.max(6, Number(process.env.MIN_PLAYERS) || 6) // 6 minimum pour que tous les rôles existent
export const MAX_PLAYERS = 20
export const LOBBY_SECONDS = 120 // temps pour rejoindre avant le lancement automatique
export const READ_SECONDS = 25 // lecture de sa carte avant la première nuit
export const NIGHT_STEP_SECONDS = 40 // temps accordé au Garde, à la Voyante, à la Sorcière
export const NIGHT_WOLF_SECONDS = 60 // temps accordé aux Loups
export const NIGHT_MIN_STEP = 12 // durée minimale d’une étape de nuit (évite de deviner qui est vivant au temps de réponse)
export const HUNTER_SECONDS = 30 // dernière balle du Chasseur
export const DAY_SECONDS = 120 // débat
export const VOTE_SECONDS = 60
export const DM_DELAY_SECONDS = 4 // pause entre deux cartes envoyées en privé (limite les risques de blocage)

// Mots qui déclenchent le bot : « /loup », « /loups » ou « /lg »
export const COMMAND_WORDS = new Set(['loup', 'loups', 'lg'])


// ───────── Maire ─────────
// Élu au jour 1 : sa voix compte double, il tranche les égalités, et désigne son successeur s’il meurt.
export const MAYOR = (process.env.MAYOR || 'true').toLowerCase() !== 'false'
export const MAYOR_ELECTION_SECONDS = 60 // élection (discussion + vote)
export const MAYOR_TIE_SECONDS = 30 // temps accordé au maire pour trancher une égalité
export const MAYOR_SUCCESSION_SECONDS = 25 // temps accordé au maire mourant pour désigner son successeur

// ───────── Persistance ─────────
// Statistiques des joueurs + sauvegarde des parties en cours (à placer sur un volume persistant en hébergement)
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data')
// Reprendre les parties interrompues par un redémarrage/plantage (au début de la phase en cours)
export const RESUME_GAMES = (process.env.RESUME_GAMES || 'true').toLowerCase() !== 'false'
export const RESUME_MAX_MINUTES = Math.max(1, Number(process.env.RESUME_MAX_MINUTES) || 120) // au-delà, la partie est abandonnée

// ───────── Cartes d’information (règles, rôles, composition) ─────────
// photo : images • text : messages texte
export const INFO_DELIVERY = (process.env.INFO_DELIVERY || 'photo').toLowerCase() === 'text' ? 'text' : 'photo'


// ───────── Nécromancien et Mentaliste ─────────
// Désactivables si tu ne veux pas ces rôles (NECROMANCER=false : plus de groupe des morts ; MENTALIST=false).
// Groupe des morts : créé au premier mort, chaque mort y est ajouté (false = désactivé, et le Nécromancien aussi)
export const DEAD_GROUP = (process.env.DEAD_GROUP || 'true').toLowerCase() !== 'false'
export const NECROMANCER = (process.env.NECROMANCER || 'true').toLowerCase() !== 'false' && DEAD_GROUP
export const MENTALIST = (process.env.MENTALIST || 'true').toLowerCase() !== 'false'
export const NECRO_MIN_PLAYERS = 8 // le Nécromancien apparaît à partir de ce nombre de joueurs
export const MENTALIST_MIN_PLAYERS = 10 // le Mentaliste apparaît à partir de ce nombre de joueurs
export const NIGHT_NECRO_SECONDS = 90 // durée minimale de la visite du Nécromancien au groupe des morts (la nuit ne finit pas avant)
export const MENTALIST_EXTRA_SECONDS = 30 // temps de vote supplémentaire quand un Mentaliste est dans la partie

// ───────── Aléatoire ─────────
// Rotation des rôles : une valeur de 0 à 1 qui réduit la probabilité de retomber sur un rôle déjà reçu dans les
// 4 dernières parties du groupe (0 = hasard pur sans mémoire, 1 = rotation maximale). Jamais de probabilité nulle.
const rotation = Number.parseFloat(process.env.ROLE_ROTATION)
export const ROLE_ROTATION = Number.isFinite(rotation) ? Math.min(1, Math.max(0, rotation)) : 0.8
// Composition variable : ±1 loup dès 10 joueurs, rôles spéciaux parfois absents ou remplacés par un « invité »
// (false = composition fixe, toujours identique pour un nombre de joueurs donné)
export const COMPOSITION_RANDOM = (process.env.COMPOSITION_RANDOM || 'true').toLowerCase() !== 'false'
