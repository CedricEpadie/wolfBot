// 🐺 LOUP-GAROU — bot WhatsApp autonome (Baileys), préfixe « / » par défaut
//
// Rôles : 🐺 Loup-Garou • 🧙‍♀️ Sorcière • 🏹 Chasseur • 🔮 Voyante bavarde • 🛡️ Garde • 🧑‍🌾 Simple villageois
//
// Déroulement : cartes de rôle envoyées en privé (image avec emoji) → nuit (le groupe est fermé) :
// Garde → Voyante → Loups → Sorcière → jour (le groupe est rouvert) : annonce des morts, débat, vote.
// Le bot doit être ADMIN du groupe pour le fermer la nuit et le rouvrir le jour.
//
// Commandes (dans un groupe) :
//  /loup            → ouvre une partie        /loup join   → rejoindre
//  /loup go         → lancer (lanceur)        /loup stop   → annuler (lanceur)
//  /loup role       → renvoyer sa carte (aussi en PRIVÉ avec le bot)
//  /loup roles      → rôles disponibles et composition selon le nombre de joueurs
//  /loup regles     → règles du jeu           /loup etat   → où en est la partie
//  /loup vivants    → joueurs encore en vie   /loup top    → classement des victoires
//  /loup vote @x    → voter (ou simplement mentionner @x / répondre à son message pendant le vote)
//  /loup passer     → passer le débat et voter tout de suite (lanceur)
//  /loup ouvrir     → rouvrir le groupe s’il est resté fermé (hors partie)
//  /loup aide       → liste des commandes
//
// Actions de nuit : le bot écrit en PRIVÉ aux joueurs concernés avec une carte numérotée.
// Il suffit de répondre par un numéro (la Sorcière répond « vie », « mort 3 » ou « rien »).

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  normalizeMessageContent,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'

const HERE = path.dirname(fileURLToPath(import.meta.url))

try {
  process.loadEnvFile(path.join(HERE, '.env')) // Node ≥ 20.12 ; sans .env, on utilise les variables d’environnement de l’hébergeur
} catch {}

// Polices embarquées (dossier fonts/) : les cartes s’affichent pareil sur n’importe quel serveur.
try {
  const fontDir = path.join(HERE, 'fonts')
  if (fs.existsSync(fontDir)) {
    const conf = path.join(os.tmpdir(), 'loup-garou-fonts.conf')
    fs.writeFileSync(
      conf,
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n` +
        `  <dir>${fontDir}</dir>\n  <cachedir>${path.join(os.tmpdir(), 'loup-garou-fontcache')}</cachedir>\n` +
        `  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n</fontconfig>\n`
    )
    process.env.FONTCONFIG_FILE = conf
  }
} catch (e) {
  console.warn('[loup-garou] configuration des polices impossible :', e.message)
}

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch (e) {
  console.warn('[loup-garou] sharp indisponible :', e.message)
}

// ───────── Configuration (variables d’environnement) ─────────
const P = process.env.PREFIX || '/'
const AUTH_DIR = process.env.AUTH_DIR || path.join(HERE, 'auth') // dossier de session : à placer sur un volume persistant
const PAIRING_NUMBER = (process.env.PAIRING_NUMBER || '').replace(/\D/g, '') // ex. 237600000000 → connexion par code au lieu du QR
// photo : carte image envoyée en privé, supprimée après ROLE_SELF_DESTRUCT s • text : même chose en texte
const ROLE_DELIVERY = (process.env.ROLE_DELIVERY || 'photo').toLowerCase() === 'text' ? 'text' : 'photo'
const SELF_DESTRUCT = Number(process.env.ROLE_SELF_DESTRUCT ?? 60) || 0
const WIPE_DM_CHAT = (process.env.WIPE_DM_CHAT || 'true').toLowerCase() !== 'false'
// Voyante bavarde : le RÔLE découvert est annoncé au village. Mettre true pour annoncer aussi le NOM du joueur.
const VOYANTE_REVEAL_NAME = (process.env.VOYANTE_REVEAL_NAME || 'false').toLowerCase() === 'true'
// Groupe secret des loups : keep = le bot crée le groupe, y reste, retire les loups morts et le dissout à la fin
// leave = le bot crée le groupe puis le quitte aussitôt (il ne voit plus rien, mais ne peut plus le dissoudre)
// off = pas de groupe, les messages des loups sont relayés par le bot en privé
const WOLF_GROUP = ['keep', 'leave', 'off'].includes((process.env.WOLF_GROUP || 'keep').toLowerCase()) ? (process.env.WOLF_GROUP || 'keep').toLowerCase() : 'keep'
// Révéler le rôle des joueurs morts
const REVEAL_ROLES = (process.env.REVEAL_ROLES || 'true').toLowerCase() !== 'false'

// ───────── Réglages du jeu ─────────
const MIN_PLAYERS = Math.max(6, Number(process.env.MIN_PLAYERS) || 6) // 6 minimum pour que tous les rôles existent
const MAX_PLAYERS = 16
const LOBBY_SECONDS = 120 // temps pour rejoindre avant le lancement automatique
const READ_SECONDS = 25 // lecture de sa carte avant la première nuit
const NIGHT_STEP_SECONDS = 40 // temps accordé au Garde, à la Voyante, à la Sorcière
const NIGHT_WOLF_SECONDS = 60 // temps accordé aux Loups
const NIGHT_MIN_STEP = 12 // durée minimale d’une étape de nuit (évite de deviner qui est vivant au temps de réponse)
const HUNTER_SECONDS = 30 // dernière balle du Chasseur
const DAY_SECONDS = 120 // débat
const VOTE_SECONDS = 60
const DM_DELAY_SECONDS = 4 // pause entre deux cartes envoyées en privé (limite les risques de blocage)

// ───────── Rôles ─────────
const ROLES = {
  loup: {
    label: 'LOUP-GAROU',
    emoji: '🐺',
    img: 'loup',
    color: '#ff5d5d',
    camp: 'Camp : les Loups-Garous',
    lines: ['Chaque nuit, avec tes complices, vous', 'choisissez une victime à dévorer.', 'Le jour, mens, accuse et survis !'],
    short: 'dévore un villageois chaque nuit avec ses complices',
  },
  sorciere: {
    label: 'SORCIÈRE',
    emoji: '🧙‍♀️',
    img: 'sorciere',
    color: '#b57cff',
    camp: 'Camp : le Village',
    lines: ['Tu possèdes 2 potions à usage unique :', 'VIE = sauve la victime des loups,', 'MORT = élimine le joueur de ton choix.'],
    short: 'une potion de vie et une potion de mort, à usage unique',
  },
  chasseur: {
    label: 'CHASSEUR',
    emoji: '🏹',
    img: 'chasseur',
    color: '#f5a524',
    camp: 'Camp : le Village',
    lines: ['Si tu meurs (de nuit ou par le vote),', 'tu emportes IMMÉDIATEMENT un joueur', 'de ton choix avec toi.'],
    short: 'quand il meurt, il tire une dernière balle sur un joueur',
  },
  voyante: {
    label: 'VOYANTE BAVARDE',
    emoji: '🔮',
    img: 'voyante',
    color: '#4dc3ff',
    camp: 'Camp : le Village',
    lines: ['Chaque nuit, découvre le rôle d’un joueur.', 'Bavarde : le rôle que tu découvres est', 'annoncé à tout le village (sans ton nom).'],
    short: 'voit un rôle chaque nuit, mais le village l’apprend aussi',
  },
  garde: {
    label: 'GARDE',
    emoji: '🛡️',
    img: 'garde',
    color: '#3ddc84',
    camp: 'Camp : le Village',
    lines: ['Chaque nuit, protège un joueur des loups.', 'Pas deux nuits de suite le même joueur.', 'Tu peux te protéger toi-même.'],
    short: 'protège un joueur des loups chaque nuit',
  },
  villageois: {
    label: 'SIMPLE VILLAGEOIS',
    emoji: '🧑‍🌾',
    img: 'villageois',
    color: '#e0b36a',
    camp: 'Camp : le Village',
    lines: ['Pas de pouvoir spécial : observe, débats', 'et vote pour démasquer les loups-garous.', 'Ta voix peut sauver le village !'],
    short: 'aucun pouvoir, mais sa voix compte',
  },
}
const ROLE_ORDER = ['loup', 'sorciere', 'chasseur', 'voyante', 'garde', 'villageois']

const composition = (n) => {
  const wolves = Math.max(1, Math.floor(n / 3))
  const list = ['sorciere', 'chasseur', 'voyante', 'garde']
  for (let i = 0; i < wolves; i++) list.push('loup')
  while (list.length < n) list.push('villageois')
  return list.slice(0, n)
}
const countRoles = (list) => {
  const c = {}
  for (const r of list) c[r] = (c[r] || 0) + 1
  return c
}
const compoText = (n) =>
  ROLE_ORDER.map((r) => ({ r, k: countRoles(composition(n))[r] || 0 }))
    .filter((x) => x.k)
    .map((x) => `${x.k} ${ROLES[x.r].emoji} ${ROLES[x.r].label}`)
    .join(' • ')

// ───────── État (en mémoire : remis à zéro au redémarrage du bot) ─────────
const games = new Map() // une partie par groupe (clé = jid du groupe)
const wins = new Map() // victoires : groupe → Map(num → { jid, name, n })
const sentTexts = [] // derniers textes envoyés par le bot (évite de les prendre pour des commandes)
const cooldowns = new Map()
let sock = null

// ───────── Utilitaires ─────────
const num = (jid) => String(jid || '').split('@')[0].split(':')[0]
const clean = (jid) => {
  const [user, server] = String(jid || '').split('@')
  return `${user.split(':')[0]}@${server}`
}
const tag = (jid) => '@' + num(jid)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const rand = (a, b) => a + Math.random() * (b - a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const progressBar = (done, total) => '▰'.repeat(done) + '▱'.repeat(total - done)
const onCooldown = (id, seconds) => {
  const now = Date.now()
  if ((cooldowns.get(id) || 0) > now) return true
  cooldowns.set(id, now + seconds * 1000)
  return false
}

// Nom lisible sur les cartes (les emojis et alphabets non latins ne s’affichent pas dans l’image)
const plainName = (p) => {
  const s = String(p.name || '')
    .replace(/[^\p{Script=Latin}\p{N}\s'’.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 22)
  return s || `Joueur ${String(p.num).slice(-4)}`
}

const senderOf = (m) => {
  const k = m.key
  const group = k.remoteJid.endsWith('@g.us')
  let jid
  let alt
  if (k.fromMe) {
    jid = sock?.user?.id
    alt = sock?.user?.lid
  } else if (group) {
    jid = k.participant
    alt = k.participantAlt || k.participantPn || k.senderPn
  } else {
    jid = k.remoteJid
    alt = k.remoteJidAlt || k.senderPn
  }
  if (!jid) return null
  jid = clean(jid)
  if (alt) alt = clean(alt)
  const ids = new Set([num(jid)])
  if (alt) ids.add(num(alt))
  const dm = [jid, alt].find((j) => j && j.endsWith('@s.whatsapp.net')) || jid
  return { jid, dm, ids, name: m.pushName || '' }
}

const toPlayer = (s) => ({ num: num(s.jid), jid: s.jid, dm: s.dm, ids: s.ids, name: s.name, role: null, alive: true })
const hasId = (p, ids) => !!p && [...ids].some((i) => p.ids.has(i))
const findPlayer = (g, ids) => g.players.find((p) => hasId(p, ids))
const jidsOf = (list) => list.map((p) => p.jid)
const listOf = (list) => list.map((p) => tag(p.jid)).join(', ')
const living = (g) => g.players.filter((p) => p.alive)
const alive = (g) => games.get(g.key) === g && !g.aborted

// ───────── Envoi ─────────
const say = async (chat, text, mentions = []) => {
  sentTexts.push(text)
  if (sentTexts.length > 60) sentTexts.shift()
  try {
    return await sock.sendMessage(chat, { text, mentions })
  } catch (e) {
    console.error('[loup-garou] envoi impossible :', e.message)
    return null
  }
}

const editMsg = async (chat, sent, text, mentions = []) => {
  if (!sent?.key) return
  try {
    await sock.sendMessage(chat, { text, edit: sent.key, mentions })
  } catch {}
}

// Efface la conversation privée côté bot (le téléphone du bot n’en garde pas de trace)
const wipeChat = async (jid, sent) => {
  if (!WIPE_DM_CHAT || !sent?.key) return
  try {
    await sock.chatModify(
      { delete: true, lastMessages: [{ key: sent.key, messageTimestamp: Number(sent.messageTimestamp) }] },
      jid
    )
  } catch (e) {
    console.warn('[loup-garou] effacement de la conversation impossible :', e.message)
  }
}

const afterSend = (jid, sent, destruct = SELF_DESTRUCT) => {
  setTimeout(() => wipeChat(jid, sent).catch(() => {}), 3000)
  if (destruct > 0 && sent?.key) {
    setTimeout(async () => {
      try {
        await sock.sendMessage(jid, { delete: sent.key })
      } catch {}
    }, destruct * 1000)
  }
}

// Message privé simple (confirmations, messages entre loups). Retourne true si envoyé.
const sendText = async (jids, text, { destruct = 0 } = {}) => {
  for (const jid of [...new Set([].concat(jids).filter(Boolean))]) {
    try {
      const sent = await sock.sendMessage(jid, { text })
      afterSend(jid, sent, destruct)
      return true
    } catch (e) {
      console.error('[loup-garou] message privé impossible :', e.message)
    }
  }
  return false
}

// ───────── Cartes (images) ─────────
const EMOJI = {}
const loadEmoji = () => {
  for (const r of ROLE_ORDER) {
    EMOJI[r] = 'data:image/png;base64,' + fs.readFileSync(path.join(HERE, 'assets', 'emoji', `${ROLES[r].img}.png`)).toString('base64')
  }
}
const FONT = 'DejaVu Sans, Arial, Helvetica, sans-serif'
const txt = (x, y, size, fill, content, { bold = false, anchor = 'middle' } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}"${bold ? ' font-weight="bold"' : ''} fill="${fill}">${esc(content)}</text>`
const toJpeg = (svg) => {
  if (!sharp) throw new Error('le module « sharp » n’est pas installé')
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer()
}

// Carte « grande » : emoji du rôle, titre, sous-titre, lignes de texte
const bigCard = ({ role, title, subtitle, lines = [], footer }) => {
  const R = ROLES[role]
  const body = lines.map((l, i) => txt(450, 400 + i * 40, 27, '#d7dce3', l)).join('')
  const titleSize = Math.max(34, Math.min(58, Math.floor(800 / (title.length * 0.68))))
  return toJpeg(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <rect width="900" height="620" rx="36" fill="#14181f"/>
  <rect x="22" y="22" width="856" height="576" rx="28" fill="none" stroke="${R.color}" stroke-width="5"/>
  <image href="${EMOJI[role]}" x="340" y="44" width="220" height="207"/>
  ${txt(450, 305, titleSize, R.color, title, { bold: true })}
  ${txt(450, 352, 27, '#9aa4b2', subtitle)}
  ${body}
  ${txt(450, 575, 22, '#7d8794', footer || 'Ne montre cette carte à personne • elle s’efface toute seule')}
</svg>`)
}

// Carte « liste » : choix numérotés (action de nuit, tir du chasseur…)
const listCard = ({ role, title, subtitle, items, notes = [] }) => {
  const R = ROLES[role]
  const cols = items.length > 8 ? 2 : 1
  const rows = Math.ceil(items.length / cols)
  const rowH = 52
  const top = 215
  const maxChars = cols === 2 ? 17 : 28
  const noteY = top + rows * rowH + 20
  const H = noteY + notes.length * 36 + 50
  const cells = items
    .map((p, i) => {
      const col = Math.floor(i / rows)
      const row = i % rows
      const x = 50 + col * 420
      const y = top + row * rowH + 34
      const name = plainName(p)
      const shown = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name
      return txt(x, y, 32, R.color, `${i + 1}.`, { bold: true, anchor: 'start' }) + txt(x + 62, y, 32, '#ffffff', shown, { anchor: 'start' })
    })
    .join('')
  const noteSvg = notes.map((n, i) => txt(450, noteY + 26 + i * 36, 23, '#aeb6c2', n)).join('')
  return toJpeg(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${H}" viewBox="0 0 900 ${H}">
  <rect width="900" height="${H}" rx="36" fill="#14181f"/>
  <rect x="22" y="22" width="856" height="${H - 44}" rx="28" fill="none" stroke="${R.color}" stroke-width="5"/>
  <image href="${EMOJI[role]}" x="48" y="40" width="124" height="116"/>
  ${txt(195, 92, 44, R.color, title, { bold: true, anchor: 'start' })}
  ${txt(195, 138, 25, '#9aa4b2', subtitle, { anchor: 'start' })}
  <line x1="48" y1="176" x2="852" y2="176" stroke="#2b323d" stroke-width="3"/>
  ${cells}
  ${noteSvg}
</svg>`)
}

// Envoie une carte privée à `p` (image, ou texte si ROLE_DELIVERY=text). Ne journalise jamais le contenu.
// Retourne { ok: true } ou { ok: false, error }.
const sendCard = async (p, renderFn, fallbackText, caption) => {
  let content
  try {
    content = ROLE_DELIVERY === 'text' ? { text: fallbackText } : { image: await renderFn(), mimetype: 'image/jpeg', caption }
  } catch (e) {
    console.error('[loup-garou] génération de la carte impossible :', e.message)
    return { ok: false, error: `génération de la carte impossible (${e.message})` }
  }
  let lastError = 'erreur inconnue'
  for (const jid of [...new Set([p.dm, p.jid].filter(Boolean))]) {
    try {
      const sent = await sock.sendMessage(jid, content)
      console.log(`[loup-garou] envoi privé accepté par WhatsApp (destinataire : ${jid.endsWith('@lid') ? 'LID' : 'numéro'})`)
      afterSend(jid, sent)
      return { ok: true }
    } catch (e) {
      lastError = e?.message || String(e)
      console.error('[loup-garou] envoi privé impossible :', lastError)
    }
  }
  return { ok: false, error: lastError }
}

const roleCardFor = (g, p) => {
  const R = ROLES[p.role]
  const lines = [...R.lines]
  if (p.role === 'loup') {
    const mates = g.players.filter((x) => x.role === 'loup' && x !== p).map(plainName)
    lines[2] = mates.length ? `Tes complices : ${mates.join(', ')}`.slice(0, 52) : 'Tu es le seul loup : sois discret !'
  }
  return {
    render: () => bigCard({ role: p.role, title: R.label, subtitle: R.camp, lines }),
    text:
      `${R.emoji} *${R.label}*\n${R.camp}\n\n${R.lines.join('\n')}` +
      (p.role === 'loup'
        ? `\n\n🐺 Complices : ${g.players.filter((x) => x.role === 'loup' && x !== p).map(plainName).join(', ') || 'aucun (tu es seul)'}`
        : ''),
    caption: `${R.emoji} *${R.label}*`,
  }
}

// ───────── Résolution des numéros privés (LID → numéro) ─────────
const resolveDms = async (g) => {
  const lids = g.players.filter((p) => p.dm.endsWith('@lid'))
  if (!lids.length) return
  try {
    const meta = await sock.groupMetadata(g.key)
    for (const p of lids) {
      const m = (meta.participants || []).find((x) => [x.id, x.lid, x.jid, x.phoneNumber].some((v) => v && num(v) === num(p.dm)))
      const pn = m && [m.phoneNumber, m.jid, m.id].find((v) => v && String(v).endsWith('@s.whatsapp.net'))
      if (pn) {
        p.dm = clean(pn)
        p.ids.add(num(pn))
      }
    }
  } catch (e) {
    console.warn('[loup-garou] résolution des numéros impossible :', e.message)
  }
}

// ───────── Groupe : fermeture la nuit, ouverture le jour ─────────
const isBotAdmin = async (chat) => {
  try {
    const meta = await sock.groupMetadata(chat)
    const mine = new Set([num(sock.user?.id), num(sock.user?.lid)].filter(Boolean))
    const me = (meta.participants || []).find((x) => [x.id, x.lid, x.jid, x.phoneNumber].some((v) => v && mine.has(num(v))))
    return !!me && !!me.admin
  } catch {
    return null // inconnu
  }
}

const lockGroup = async (g, lock) => {
  try {
    await sock.groupSettingUpdate(g.key, lock ? 'announcement' : 'not_announcement')
    g.locked = lock
    return true
  } catch (e) {
    console.warn('[loup-garou] verrouillage du groupe impossible :', e.message)
    if (!g.lockWarned) {
      g.lockWarned = true
      await say(
        g.key,
        `⚠️ Je ne peux pas ${lock ? 'fermer' : 'rouvrir'} le groupe : je ne suis sans doute pas *admin*. Faites-moi admin pour une vraie nuit silencieuse ; sinon, jouez le jeu : 🤫 *silence la nuit* !`
      )
    }
    return false
  }
}

// ───────── Minuteries ─────────
const stopTimers = (g) => {
  clearTimeout(g.timer)
  for (const t of g.ticks || []) clearTimeout(t)
  g.ticks = []
  g.deadline = 0
}

// Attend `seconds` s (ou l’appel de g.finishStep()). `min` = durée minimale avant de rendre la main.
// `marks` = secondes restantes auxquelles `tick(m)` est appelé.
const waitStep = (g, seconds, { min = 0, marks = [], tick } = {}) =>
  new Promise((resolve) => {
    stopTimers(g)
    g.deadline = Date.now() + seconds * 1000
    let minReached = min <= 0
    let finished = false
    const resolveNow = () => {
      stopTimers(g)
      resolve()
    }
    const done = () => {
      if (finished) return
      finished = true
      if (g.finishStep === done) g.finishStep = null
      if (minReached) resolveNow()
    }
    g.finishStep = done
    if (!minReached) {
      g.ticks.push(
        setTimeout(() => {
          minReached = true
          if (finished) resolveNow()
        }, min * 1000)
      )
    }
    for (const m of marks) {
      if (m >= seconds || !tick) continue
      g.ticks.push(
        setTimeout(() => {
          if (finished || !alive(g)) return
          Promise.resolve(tick(m)).catch((e) => console.error('[loup-garou]', e))
        }, (seconds - m) * 1000)
      )
    }
    g.timer = setTimeout(done, seconds * 1000)
  })

const finishStep = (g) => g.finishStep?.()

// ───────── Choix en privé ─────────
// Envoie une carte numérotée (ordre mélangé pour chaque joueur) et enregistre le choix attendu.
const askPick = async (g, player, { role, title, subtitle, items, notes = [], kind = 'pick', onPick, keep = false, extra = {} }) => {
  const list = shuffle(items)
  g.prompts.set(player, { kind, list, onPick, keep, ...extra })
  const R = ROLES[role]
  const fallback =
    `${R.emoji} *${title}*\n${subtitle}\n\n` +
    list.map((p, i) => `${i + 1}. ${plainName(p)}`).join('\n') +
    (notes.length ? `\n\n${notes.join('\n')}` : '') +
    `\n\nRéponds avec le *numéro*.`
  const r = await sendCard(player, () => listCard({ role, title, subtitle, items: list, notes }), fallback, `${R.emoji} *${title}*`)
  if (!r.ok) console.error('[loup-garou] carte de choix non envoyée :', r.error)
  return list
}

// ───────── Groupe secret des loups ─────────
const WOLF_FILE = path.join(HERE, 'wolf-groups.json')
const readWolfFile = () => {
  try {
    return JSON.parse(fs.readFileSync(WOLF_FILE, 'utf8'))
  } catch {
    return []
  }
}
const writeWolfFile = (list) => {
  try {
    fs.writeFileSync(WOLF_FILE, JSON.stringify(list))
  } catch {}
}
const wolfGroups = new Set(readWolfFile()) // jids des groupes de loups connus (pour ne pas y traiter de commandes)
const trackWolfGroup = (jid) => {
  wolfGroups.add(jid)
  writeWolfFile([...new Set([...readWolfFile(), jid])])
}
const untrackWolfGroup = (jid) => {
  wolfGroups.delete(jid)
  writeWolfFile(readWolfFile().filter((x) => x !== jid))
}

// Retire tous les membres puis quitte le groupe : WhatsApp supprime alors le groupe vide.
const dissolveGroup = async (jid) => {
  try {
    const meta = await sock.groupMetadata(jid)
    const mine = new Set([num(sock.user?.id), num(sock.user?.lid)].filter(Boolean))
    const others = (meta.participants || []).filter((x) => ![x.id, x.lid, x.jid, x.phoneNumber].some((v) => v && mine.has(num(v)))).map((x) => x.id)
    if (others.length) await sock.groupParticipantsUpdate(jid, others, 'remove')
  } catch (e) {
    console.warn('[loup-garou] retrait des membres impossible :', e.message)
  }
  try {
    await sock.groupLeave(jid)
  } catch (e) {
    console.warn('[loup-garou] sortie du groupe impossible :', e.message)
  }
}

const createWolfGroup = async (g) => {
  const wolves = g.players.filter((p) => p.role === 'loup')
  if (WOLF_GROUP === 'off' || wolves.length < 2) return
  try {
    const meta = await sock.groupCreate('🐺 Meute — Loup-Garou', wolves.map((w) => w.dm))
    const jid = meta.id
    g.wolfGroup = { jid, present: true, removed: new Set() }
    if (WOLF_GROUP === 'keep') trackWolfGroup(jid)
    else wolfGroups.add(jid)

    // Qui a pu être ajouté ? Les autres reçoivent un lien d’invitation en privé.
    const inGroup = new Set()
    try {
      const m = await sock.groupMetadata(jid)
      for (const x of m.participants || []) for (const v of [x.id, x.lid, x.jid, x.phoneNumber]) if (v) inGroup.add(num(v))
    } catch {}
    const missing = wolves.filter((w) => ![...w.ids].some((i) => inGroup.has(i)))
    if (missing.length) {
      let link = null
      try {
        link = 'https://chat.whatsapp.com/' + (await sock.groupInviteCode(jid))
      } catch (e) {
        console.warn('[loup-garou] lien d’invitation impossible :', e.message)
      }
      if (link) {
        for (const w of missing) {
          await sendText([w.dm, w.jid], `🐺 Je n’ai pas pu t’ajouter au groupe secret de la meute (réglage de confidentialité ?). Rejoins-le avec ce lien, sans le partager :\n${link}`)
        }
      }
    }

    const welcome = await say(
      jid,
      `🐺 *LA MEUTE*\n\nBienvenue, loups-garous : ${listOf(wolves)}\n\n` +
        `Ici, discutez librement et mettez-vous d’accord. Chaque nuit, la victime se choisit en répondant par un *numéro* à la carte que je vous envoie *en privé*.\n` +
        (WOLF_GROUP === 'keep'
          ? `Les loups éliminés sont retirés du groupe, et il sera dissous à la fin de la partie. 🌕`
          : `Je quitte ce groupe pour que personne d’autre que vous n’ait accès à vos messages. À la fin de la partie, quittez-le. 🌕`),
      jidsOf(wolves)
    )
    await say(g.key, '🐺 La meute a son propre groupe secret… 🤫')
    if (WOLF_GROUP === 'leave') {
      g.wolfGroup.present = false
      try {
        await sock.groupLeave(jid)
      } catch (e) {
        console.warn('[loup-garou] sortie du groupe impossible :', e.message)
      }
      setTimeout(() => wipeChat(jid, welcome).catch(() => {}), 2000)
    }
  } catch (e) {
    console.warn('[loup-garou] création du groupe des loups impossible (relais en privé à la place) :', e.message)
    g.wolfGroup = null
  }
}

// Retire du groupe les loups morts
const syncWolfGroup = async (g) => {
  const wg = g.wolfGroup
  if (!wg?.present) return
  const dead = g.players.filter((p) => p.role === 'loup' && !p.alive && !wg.removed.has(p))
  if (!dead.length) return
  for (const p of dead) wg.removed.add(p)
  await say(wg.jid, `💀 ${listOf(dead)} a été éliminé : il quitte la meute…`, jidsOf(dead))
  for (const p of dead) {
    try {
      await sock.groupParticipantsUpdate(wg.jid, [p.jid], 'remove')
    } catch {
      try {
        await sock.groupParticipantsUpdate(wg.jid, [p.dm], 'remove')
      } catch (e) {
        console.warn('[loup-garou] retrait du loup impossible :', e.message)
      }
    }
  }
}

// Fin de partie : dissout le groupe (mode keep) ou prévient les loups de le quitter (mode leave)
const endWolfGroup = async (g, { quick = false } = {}) => {
  const wg = g.wolfGroup
  if (!wg) return
  g.wolfGroup = null
  if (!wg.present) {
    for (const w of g.players.filter((p) => p.role === 'loup')) {
      await sendText([w.dm, w.jid], '🌕 La partie est terminée : tu peux quitter le groupe de la meute.')
    }
    return
  }
  const sent = await say(wg.jid, '🌕 *La partie est terminée.* Ce groupe se dissout dans quelques secondes…')
  if (!quick) await sleep(6000)
  await dissolveGroup(wg.jid)
  setTimeout(() => wipeChat(wg.jid, sent).catch(() => {}), 2000)
  untrackWolfGroup(wg.jid)
}

// Au démarrage : dissout les groupes de loups restés ouverts après un plantage
const cleanupOrphans = async () => {
  for (const jid of readWolfFile()) {
    if ([...games.values()].some((g) => g.wolfGroup?.jid === jid)) continue
    await dissolveGroup(jid)
    untrackWolfGroup(jid)
  }
}

const notifyWolfVote = (g, wolves, w, t) =>
  g.wolfGroup?.present
    ? say(g.wolfGroup.jid, `🗳️ ${tag(w.jid)} vote contre *${plainName(t)}*`, [w.jid])
    : Promise.all(wolves.filter((o) => o !== w).map((o) => sendText([o.dm, o.jid], `🐺 ${plainName(w)} vote contre *${plainName(t)}*.`, { destruct: SELF_DESTRUCT })))

// ───────── Fin de partie ─────────
const winnerOf = (g) => {
  const alivePl = living(g)
  if (!alivePl.length) return 'egalite'
  const wolves = alivePl.filter((p) => p.role === 'loup').length
  if (wolves === 0) return 'village'
  if (wolves >= alivePl.length - wolves) return 'loups'
  return null
}

const finish = async (g, winner) => {
  if (!alive(g)) return
  g.over = true
  stopTimers(g)
  games.delete(g.key)
  if (g.locked) await lockGroup(g, false)

  const board = wins.get(g.key) || new Map()
  const winners = g.players.filter((p) => (winner === 'village' ? p.role !== 'loup' : winner === 'loups' ? p.role === 'loup' : false))
  for (const p of winners) {
    const e = board.get(p.num) || { jid: p.jid, n: 0 }
    e.n++
    board.set(p.num, e)
  }
  wins.set(g.key, board)

  const recap = g.players.map((p) => `${ROLES[p.role].emoji} ${tag(p.jid)} — ${ROLES[p.role].label}${p.alive ? '' : ' 💀'}`).join('\n')
  const title =
    winner === 'village'
      ? '🎉 *LE VILLAGE GAGNE !*\nTous les loups-garous ont été démasqués. 🏡'
      : winner === 'loups'
        ? '🐺 *LES LOUPS-GAROUS GAGNENT !*\nLe village est tombé sous leurs crocs… 🌕'
        : '💀 *ÉGALITÉ !*\nIl ne reste plus personne en vie.'
  await say(
    g.key,
    `🏁 *FIN DE PARTIE*\n\n${title}\n\n🎭 *Les rôles*\n${recap}\n\n🏆 *${P}loup top* : classement • Rejouer : *${P}loup*`,
    jidsOf(g.players)
  )
  await endWolfGroup(g)
}

const abort = async (g) => {
  g.aborted = true
  stopTimers(g)
  games.delete(g.key)
  g.finishStep?.()
  if (g.locked) await lockGroup(g, false)
  await endWolfGroup(g, { quick: true })
}

// ───────── Morts ─────────
const roleTag = (p) => `${ROLES[p.role].emoji} *${ROLES[p.role].label}*`
const deathLine = (p) => (REVEAL_ROLES ? `☠️ ${tag(p.jid)} — c’était ${roleTag(p)}` : `☠️ ${tag(p.jid)}`)

const hunterShot = async (g, h) => {
  const targets = living(g)
  if (!targets.length || !alive(g)) return
  g.phase = 'hunter'
  await say(g.key, `🏹 ${tag(h.jid)} était le *CHASSEUR* ! Il a *${HUNTER_SECONDS} s* pour tirer sa dernière balle…`, [h.jid])
  let chosen = null
  await askPick(g, h, {
    role: 'chasseur',
    title: 'TIRE !',
    subtitle: `Dernière balle • ${HUNTER_SECONDS} s`,
    items: targets,
    notes: ['Réponds avec le numéro du joueur à abattre.'],
    onPick: (t) => {
      chosen = t
      finishStep(g)
    },
  })
  await waitStep(g, HUNTER_SECONDS, { marks: [10], tick: () => sendText([h.dm, h.jid], '⏳ Plus que 10 secondes pour tirer !') })
  g.prompts.clear()
  if (!alive(g)) return
  if (chosen) {
    chosen.alive = false
    await say(g.key, `💥 ${tag(h.jid)} tire sur ${tag(chosen.jid)} !\n${deathLine(chosen)}`, [h.jid, chosen.jid])
  } else {
    await say(g.key, `🕯️ ${tag(h.jid)} n’a pas tiré à temps… la balle se perd.`, [h.jid])
  }
  await sleep(1500)
  await syncWolfGroup(g)
}

// Après des morts : tir du chasseur s’il est parmi eux. Retourne true si la partie est terminée.
const resolveDeaths = async (g, dead) => {
  await syncWolfGroup(g)
  for (const p of dead) {
    if (p.role === 'chasseur') {
      await hunterShot(g, p)
      if (!alive(g)) return true
    }
  }
  const w = winnerOf(g)
  if (w) {
    await finish(g, w)
    return true
  }
  return false
}

// ───────── Nuit ─────────
const runStep = async (g, { role, start, end, seconds = NIGHT_STEP_SECONDS, canAct, setup, after }) => {
  const actors = g.players.filter((p) => p.role === role && p.alive && (!canAct || canAct(p)))
  await say(g.key, start)
  if (!alive(g)) return
  if (actors.length) {
    await setup(actors)
    await waitStep(g, seconds, { min: NIGHT_MIN_STEP })
  } else {
    // Rôle mort ou sans pouvoir : on attend un temps aléatoire pour ne rien révéler
    await waitStep(g, rand(NIGHT_MIN_STEP, seconds))
  }
  g.prompts.clear()
  if (!alive(g)) return
  if (after) await after()
  await say(g.key, end)
  await sleep(1500)
}

const stepGarde = (g) =>
  runStep(g, {
    role: 'garde',
    start: '🛡️ *Le Garde se réveille* et choisit qui protéger cette nuit…',
    end: '🛡️ Le Garde se rendort.',
    setup: async ([guard]) => {
      const prev = g.lastProtected
      g.lastProtected = null
      const items = living(g).filter((p) => p !== prev)
      await askPick(g, guard, {
        role: 'garde',
        title: 'QUI PROTÉGER ?',
        subtitle: `Nuit ${g.nightNo} • ${NIGHT_STEP_SECONDS} s`,
        items,
        notes: [prev ? `Interdit cette nuit : ${plainName(prev)}` : 'Tu peux te protéger toi-même.', 'Réponds avec le numéro.'],
        onPick: (t) => {
          g.night.protected = t
          g.lastProtected = t
          finishStep(g)
        },
      })
    },
  })

const stepVoyante = (g) =>
  runStep(g, {
    role: 'voyante',
    start: '🔮 *La Voyante bavarde se réveille* et sonde un joueur…',
    end: '🔮 La Voyante se rendort.',
    setup: async ([seer]) => {
      await askPick(g, seer, {
        role: 'voyante',
        title: 'QUI SONDER ?',
        subtitle: `Nuit ${g.nightNo} • ${NIGHT_STEP_SECONDS} s`,
        items: living(g).filter((p) => p !== seer),
        notes: ['Le rôle que tu découvres sera annoncé au village.', 'Réponds avec le numéro.'],
        onPick: async (t) => {
          g.night.seen = t
          const R = ROLES[t.role]
          await sendCard(
            seer,
            () => bigCard({ role: t.role, title: R.label, subtitle: `Vision : ${plainName(t)} est…`, lines: ['Le village connaîtra ce rôle', 'mais pas ton nom ni ta cible.'], footer: 'Elle s’efface toute seule' }),
            `🔮 *Vision* : ${plainName(t)} est ${R.emoji} *${R.label}*`,
            `🔮 ${R.emoji} *${R.label}*`
          )
          finishStep(g)
        },
      })
    },
  })

const stepLoups = (g) =>
  runStep(g, {
    role: 'loup',
    seconds: NIGHT_WOLF_SECONDS,
    start: '🐺 *Les Loups-Garous se réveillent* et choisissent leur victime…',
    end: '🐺 Les Loups-Garous se rendorment.',
    setup: async (wolves) => {
      g.night.wolfVotes = new Map()
      const targets = living(g).filter((p) => p.role !== 'loup')
      if (g.wolfGroup?.present) {
        await say(g.wolfGroup.jid, `🌙 *Nuit ${g.nightNo}* — à vous de jouer, la meute ! Concertez-vous ici, puis votez en répondant par un numéro à ma carte privée (⏱️ ${NIGHT_WOLF_SECONDS} s).`, jidsOf(wolves))
      }
      for (const w of wolves) {
        const mates = wolves.filter((x) => x !== w).map(plainName)
        await askPick(g, w, {
          role: 'loup',
          kind: 'wolf',
          keep: true, // un loup peut changer d’avis jusqu’à la fin de l’étape
          extra: { wolves },
          title: 'QUI DÉVORER ?',
          subtitle: `Nuit ${g.nightNo} • ${NIGHT_WOLF_SECONDS} s`,
          items: targets,
          notes: [
            mates.length ? `Complices vivants : ${mates.join(', ')}` : 'Tu es le seul loup en vie.',
            mates.length ? (g.wolfGroup ? 'Discutez dans le groupe secret de la meute.' : 'Écris un message : il sera transmis à tes complices.') : 'Réponds avec le numéro.',
          ],
          onPick: (t) => {
            g.night.wolfVotes.set(w, t)
            notifyWolfVote(g, wolves, w, t).catch(() => {})
            if (wolves.every((x) => g.night.wolfVotes.has(x))) finishStep(g)
          },
        })
        await sleep(DM_DELAY_SECONDS * 250)
      }
    },
    after: async () => {
      const counts = new Map()
      for (const t of g.night.wolfVotes.values()) counts.set(t, (counts.get(t) || 0) + 1)
      if (!counts.size) return
      const max = Math.max(...counts.values())
      g.night.wolfTarget = pick([...counts.entries()].filter(([, c]) => c === max).map(([t]) => t))
      if (g.wolfGroup?.present) await say(g.wolfGroup.jid, `🎯 La meute a choisi sa victime : *${plainName(g.night.wolfTarget)}*.`)
    },
  })

const stepSorciere = (g) =>
  runStep(g, {
    role: 'sorciere',
    start: '🧙‍♀️ *La Sorcière se réveille* et consulte ses potions…',
    end: '🧙‍♀️ La Sorcière se rendort.',
    canAct: () => g.witch.life || g.witch.death,
    setup: async ([witch]) => {
      const victim = g.night.wolfTarget
      const items = shuffle(living(g).filter((p) => p !== witch))
      g.prompts.set(witch, { kind: 'witch', list: items, victim })
      const notes = [
        `Potion de vie : ${g.witch.life ? 'disponible' : 'utilisée'} • Potion de mort : ${g.witch.death ? 'disponible' : 'utilisée'}`,
        '« vie » : sauver la victime',
        '« mort N » : empoisonner le joueur N',
        '« rien » : ne rien faire (une seule potion par nuit)',
      ]
      const subtitle = victim ? `Les loups ont attaqué : ${plainName(victim)}` : 'Les loups n’ont attaqué personne cette nuit'
      const r = await sendCard(
        witch,
        () => listCard({ role: 'sorciere', title: 'TES POTIONS', subtitle, items, notes }),
        `🧙‍♀️ *TES POTIONS*\n${subtitle}\n\nJoueurs pour la potion de mort :\n${items.map((p, i) => `${i + 1}. ${plainName(p)}`).join('\n')}\n\n${notes.join('\n')}`,
        '🧙‍♀️ *TES POTIONS*'
      )
      if (!r.ok) console.error('[loup-garou] carte de la sorcière non envoyée :', r.error)
    },
  })

const night = async (g) => {
  g.nightNo = (g.nightNo || 0) + 1
  g.phase = 'night'
  g.night = { protected: null, wolfTarget: null, saved: false, poisoned: null, seen: null, wolfVotes: new Map() }
  g.prompts.clear()
  await lockGroup(g, true)
  await say(
    g.key,
    `🌙 *NUIT ${g.nightNo}*\n\nLe village s’endort… 😴\n${g.locked ? '🔒 Le groupe est fermé jusqu’à l’aube.\n' : ''}📩 Ceux qui ont un pouvoir recevront une carte en privé.`
  )
  await sleep(2500)
  if (!alive(g)) return
  await stepGarde(g)
  if (!alive(g)) return
  await stepVoyante(g)
  if (!alive(g)) return
  await stepLoups(g)
  if (!alive(g)) return
  await stepSorciere(g)
  if (!alive(g)) return
  await dawn(g)
}

const dawn = async (g) => {
  g.phase = 'day'
  await lockGroup(g, false)
  const n = g.night
  const dead = []
  if (n.wolfTarget && !n.saved && n.protected !== n.wolfTarget) dead.push(n.wolfTarget)
  if (n.poisoned && !dead.includes(n.poisoned)) dead.push(n.poisoned)

  await say(g.key, `☀️ *JOUR ${g.nightNo}*\n\nLe soleil se lève sur le village… 🐓\n${g.locked === false ? '🔓 Le groupe est rouvert.' : ''}`)
  await sleep(2500)
  if (!alive(g)) return

  if (dead.length) {
    for (const p of dead) p.alive = false
    await say(g.key, `💀 *${dead.length > 1 ? 'Victimes' : 'Victime'} de la nuit*\n${dead.map(deathLine).join('\n')}`, jidsOf(dead))
  } else {
    await say(g.key, '🕊️ *Miracle !* Personne n’est mort cette nuit.')
  }
  await sleep(2000)
  if (!alive(g)) return

  if (n.seen) {
    const R = ROLES[n.seen.role]
    await say(
      g.key,
      `🔮 *La Voyante bavarde* a parlé !\nCette nuit, elle a vu ${VOYANTE_REVEAL_NAME ? `${tag(n.seen.jid)} : ` : 'un joueur : '}${R.emoji} *${R.label}*`,
      VOYANTE_REVEAL_NAME ? [n.seen.jid] : []
    )
    await sleep(2000)
    if (!alive(g)) return
  }
  await resolveDeaths(g, dead)
}

// ───────── Jour ─────────
const registerVote = async (g, voter, targetJid) => {
  if (g.phase !== 'vote' || !voter?.alive) return
  const suspect = g.players.find((p) => p.alive && p.ids.has(num(targetJid)))
  if (!suspect) return say(g.key, `⛔ ${tag(voter.jid)} : ce joueur n’est pas en vie ou ne participe pas.`, [voter.jid])
  if (suspect === voter) return say(g.key, `⛔ ${tag(voter.jid)} : tu ne peux pas voter contre toi-même !`, [voter.jid])
  const changed = g.votes.has(voter)
  g.votes.set(voter, suspect)
  const against = [...g.votes.values()].filter((t) => t === suspect).length
  const pending = living(g).filter((p) => !g.votes.has(p))
  await say(
    g.key,
    (changed ? `🔄 ${tag(voter.jid)} change son vote et vote maintenant contre ${tag(suspect.jid)}` : `🗳️ ${tag(voter.jid)} vote contre ${tag(suspect.jid)}`) +
      ` (${against} voix contre lui)\n` +
      (pending.length ? `🕐 Reste à voter : ${listOf(pending)}` : '✅ Tout le monde a voté !'),
    [voter.jid, suspect.jid, ...jidsOf(pending)]
  )
  if (!pending.length) finishStep(g)
}

const day = async (g) => {
  g.phase = 'day'
  const alivePl = living(g)
  await say(
    g.key,
    `🗣️ *DÉBAT* — ${alivePl.length} joueur(s) en vie\n${listOf(alivePl)}\n\nQui sont les loups-garous ? Accusez, défendez-vous !\n` +
      `⏱️ *${DAY_SECONDS} s* — le lanceur peut taper *${P}loup passer* pour voter tout de suite.`,
    jidsOf(alivePl)
  )
  await waitStep(g, DAY_SECONDS, {
    marks: [60, 30, 10],
    tick: (m) => say(g.key, m > 10 ? `⏳ Il reste *${m} s* de débat…` : `🚨 Le vote commence dans *${m} s* !`),
  })
  if (!alive(g)) return

  g.phase = 'vote'
  g.votes = new Map()
  const voters = living(g)
  await say(
    g.key,
    `🗳️ *VOTE DU VILLAGE*\n\n👥 *Joueurs en vie*\n${voters.map((p, i) => `${i + 1}. ${tag(p.jid)}`).join('\n')}\n\n` +
      `👉 *Mentionne (@)* le suspect ou *réponds à son message* (ou \`${P}loup vote @joueur\`).\n` +
      `Votes publics • le dernier vote compte • pas de vote pour soi-même.\n⏱️ *${VOTE_SECONDS} s*`,
    jidsOf(voters)
  )
  await waitStep(g, VOTE_SECONDS, {
    marks: [30, 15, 5],
    tick: (m) => {
      const pending = living(g).filter((p) => !g.votes.has(p))
      return say(g.key, `⏳ *${m} s* — ${g.votes.size}/${voters.length} vote(s).\n🕐 Reste à voter : ${listOf(pending)}`, jidsOf(pending))
    },
  })
  if (!alive(g)) return

  await say(g.key, '🔔 *Le vote est clos !* Dépouillement… 🥁')
  await sleep(2500)
  if (!alive(g)) return

  const counts = new Map()
  for (const t of g.votes.values()) counts.set(t, (counts.get(t) || 0) + 1)
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (!ranking.length) {
    await say(g.key, '🤷 Personne n’a voté : le village se rendort, sans éliminer personne.')
    return
  }
  const lines = ranking.map(([p, c]) => `${'🟥'.repeat(c)} ${tag(p.jid)} — ${c} voix`).join('\n')
  const tie = ranking.length > 1 && ranking[1][1] === ranking[0][1]
  await say(g.key, `📊 *Résultat du vote*\n\n${lines}`, ranking.map(([p]) => p.jid))
  await sleep(2000)
  if (!alive(g)) return
  if (tie) {
    await say(g.key, '⚖️ *Égalité !* Le village n’arrive pas à se décider : personne n’est éliminé.')
    return
  }
  const [victim] = ranking[0]
  victim.alive = false
  await say(g.key, `⚖️ *Le village a tranché !*\n${tag(victim.jid)} est éliminé.\n${deathLine(victim)}`, [victim.jid])
  await sleep(2000)
  if (!alive(g)) return
  await resolveDeaths(g, [victim])
}

// ───────── Déroulement ─────────
const runGame = async (g) => {
  try {
    await distribute(g)
    while (alive(g) && !g.over) {
      await night(g)
      if (!alive(g) || g.over) return
      await day(g)
    }
  } catch (e) {
    console.error('[loup-garou] erreur dans la partie :', e)
    if (alive(g)) {
      await say(g.key, '💥 Une erreur est survenue : la partie est interrompue.')
      await abort(g)
    }
  }
}

const distribute = async (g) => {
  g.phase = 'roles'
  const total = g.players.length
  const roles = shuffle(composition(total))
  g.players.forEach((p, i) => (p.role = roles[i]))
  g.prompts = new Map()
  g.witch = { life: true, death: true }
  g.lastProtected = null

  await resolveDms(g)
  const progress = (done, last) =>
    `🎴 *DISTRIBUTION DES CARTES*\n\n👥 ${total} joueurs : ${listOf(g.players)}\n\n📩 Envoi des cartes en privé…\n${progressBar(done, total)} ${done}/${total}` +
    (last ? `\n${last}` : '')
  const first = await say(g.key, progress(0), jidsOf(g.players))

  const failed = []
  let firstError = ''
  let done = 0
  for (const p of g.players) {
    if (!alive(g)) return
    const c = roleCardFor(g, p)
    const r = await sendCard(p, c.render, c.text, c.caption)
    done++
    if (!r.ok) {
      failed.push(p)
      if (!firstError) firstError = r.error
    }
    await editMsg(g.key, first, progress(done, r.ok ? `✅ ${tag(p.jid)} a reçu sa carte` : `⚠️ ${tag(p.jid)} : envoi impossible`), jidsOf(g.players))
    if (done < total) await sleep(DM_DELAY_SECONDS * 1000)
  }
  if (!alive(g)) return

  if (failed.length) {
    await say(
      g.key,
      `⚠️ Je n’ai pas pu écrire en privé à ${listOf(failed)}. Écrivez-moi d’abord en privé (un simple « salut »), puis tapez *${P}loup role*.\n🔧 Détail technique : ${firstError}`,
      jidsOf(failed)
    )
  }
  await createWolfGroup(g)
  if (!alive(g)) return
  await say(
    g.key,
    `🎭 *Composition de la partie*\n${compoText(total)}\n\n📖 Lis bien ta carte : elle s’efface après *${SELF_DESTRUCT || '∞'} s* (renvoi : *${P}loup role* en privé).\n` +
      `🌙 La première nuit tombe dans *${READ_SECONDS} s*…`
  )
  await waitStep(g, READ_SECONDS, { marks: [10, 5], tick: (m) => say(g.key, `⏳ La nuit tombe dans *${m} s*…`) })
}

const beginGame = async (key, manual = false) => {
  const g = games.get(key)
  if (!g || g.phase !== 'lobby') return
  if (g.players.length < MIN_PLAYERS) {
    if (manual) return say(key, `⛔ Il manque encore *${MIN_PLAYERS - g.players.length}* joueur(s) (${g.players.length}/${MIN_PLAYERS} minimum).`)
    games.delete(key)
    stopTimers(g)
    return say(key, `😕 Pas assez de joueurs (${g.players.length}/${MIN_PLAYERS} minimum). Partie annulée.`)
  }
  stopTimers(g)
  g.phase = 'roles'
  return runGame(g)
}

// ───────── Messages privés : choix de nuit ─────────
const handlePrivate = async (me, text) => {
  for (const g of games.values()) {
    const p = findPlayer(g, me.ids)
    const pr = p && g.prompts?.get(p)
    if (!pr) continue

    const reply = (t) => sendText([p.dm, p.jid], t)

    if (pr.kind === 'witch') {
      const t = norm(text)
      if (t === 'rien' || t === 'non' || t === 'passer' || t === 'fin') {
        g.prompts.delete(p)
        await reply('✅ Compris : tu ne fais rien cette nuit.')
        finishStep(g)
      } else if (t === 'vie' || t === 'sauver') {
        if (!g.witch.life) {
          await reply('⛔ Ta potion de vie est déjà utilisée.')
          return true
        }
        if (!pr.victim) {
          await reply('⛔ Il n’y a personne à sauver cette nuit.')
          return true
        }
        g.witch.life = false
        g.night.saved = true
        g.prompts.delete(p)
        await reply('✅ Potion de vie utilisée.')
        finishStep(g)
      } else if (/^(mort|poison|tuer)\s+\d{1,2}$/.test(t)) {
        const n = Number(t.split(' ')[1])
        if (!g.witch.death) {
          await reply('⛔ Ta potion de mort est déjà utilisée.')
          return true
        }
        if (n < 1 || n > pr.list.length) {
          await reply(`⛔ Numéro invalide (1 à ${pr.list.length}).`)
          return true
        }
        g.witch.death = false
        g.night.poisoned = pr.list[n - 1]
        g.prompts.delete(p)
        await reply('✅ Potion de mort utilisée.')
        finishStep(g)
      } else {
        await reply('⛔ Réponds « vie », « mort N » (N = numéro du joueur) ou « rien ».')
      }
      return true
    }

    const m = /^\/?\s*(\d{1,2})\s*$/.exec(text)
    if (!m) {
      if (pr.kind === 'wolf' && g.wolfGroup) {
        await reply('🐺 Discute avec ta meute dans le groupe secret. Ici, réponds seulement avec un numéro.')
        return true
      }
      if (pr.kind === 'wolf' && pr.wolves && pr.wolves.length > 1) {
        const msg = `🐺 ${plainName(p)} : ${text.slice(0, 200)}`
        for (const o of pr.wolves) if (o !== p) await sendText([o.dm, o.jid], msg, { destruct: SELF_DESTRUCT })
        return true
      }
      await reply(`⛔ Réponds avec un numéro entre 1 et ${pr.list.length}.`)
      return true
    }
    const n = Number(m[1])
    if (n < 1 || n > pr.list.length) {
      await reply(`⛔ Numéro invalide (1 à ${pr.list.length}).`)
      return true
    }
    if (!pr.keep) g.prompts.delete(p)
    await reply('✅ Choix enregistré.')
    await pr.onPick(pr.list[n - 1])
    return true
  }
  return false
}

// ───────── Commandes ─────────
const RULES = () =>
  `📖 *RÈGLES DU LOUP-GAROU*\n\n` +
  `🏡 *Village* : démasquer et éliminer tous les loups.\n🐺 *Loups-Garous* : devenir aussi nombreux que les autres joueurs.\n\n` +
  `🌙 *La nuit* (le groupe est fermé) : le Garde protège, la Voyante sonde, les Loups choisissent une victime, la Sorcière agit. Tout se passe par cartes numérotées en privé.\n` +
  `☀️ *Le jour* (le groupe est rouvert) : le bot annonce les morts (et leur rôle), le village débat puis vote. Le joueur le plus voté est éliminé (égalité = personne).\n\n` +
  `🛡️ Le Garde ne peut pas protéger deux nuits de suite la même personne. Un joueur protégé n’est pas dévoré.\n` +
  `🧙‍♀️ La Sorcière a 1 potion de vie et 1 potion de mort, une seule potion par nuit.\n` +
  `🏹 Le Chasseur emporte un joueur dans sa mort (nuit ou vote).\n` +
  `🔮 La Voyante est bavarde : le rôle qu’elle découvre est annoncé à tous${VOYANTE_REVEAL_NAME ? ' avec le nom du joueur' : ' (sans le nom du joueur)'}.\n` +
  `💀 Les morts ne parlent plus : silence jusqu’à la fin ! 🤐\n\n` +
  `👥 ${MIN_PLAYERS} à ${MAX_PLAYERS} joueurs • *${P}loup roles* pour la composition.`

const ROLES_TEXT = () => {
  const lines = ROLE_ORDER.map((r) => `${ROLES[r].emoji} *${ROLES[r].label}* — ${ROLES[r].short}`).join('\n')
  const table = []
  for (let n = MIN_PLAYERS; n <= Math.min(MAX_PLAYERS, MIN_PLAYERS + 6); n++) table.push(`• ${n} joueurs : ${compoText(n)}`)
  return `🎭 *RÔLES DISPONIBLES*\n\n${lines}\n\n📊 *Composition selon le nombre de joueurs*\n${table.join('\n')}\n• …au-delà : 1 loup de plus tous les 3 joueurs`
}

const HELP = () =>
  `🐺 *LOUP-GAROU — commandes*\n\n` +
  `*${P}loup* — ouvrir une partie\n*${P}loup join* — rejoindre\n*${P}loup go* — lancer (lanceur)\n*${P}loup stop* — annuler (lanceur)\n` +
  `*${P}loup role* — renvoyer ma carte (aussi en privé)\n*${P}loup roles* — rôles et composition\n*${P}loup regles* — règles\n` +
  `*${P}loup etat* — état de la partie\n*${P}loup vivants* — joueurs en vie\n*${P}loup vote @x* — voter\n` +
  `*${P}loup passer* — passer le débat (lanceur)\n*${P}loup top* — classement\n*${P}loup ouvrir* — rouvrir le groupe`

const resendRole = async (chat, isGroup, me) => {
  let game = null
  for (const g of games.values()) if (g.players.some((p) => p.role) && findPlayer(g, me.ids)) game = g
  if (!game) return say(chat, 'Je ne te trouve dans aucune partie en cours (ou les cartes ne sont pas encore distribuées).')
  if (onCooldown(`role:${num(me.jid)}`, 10)) return say(chat, '⏳ Patiente quelques secondes avant de redemander ta carte.')
  const p = findPlayer(game, me.ids)
  const c = roleCardFor(game, p)
  const r = await sendCard(p, c.render, c.text, c.caption)
  if (!isGroup) return r.ok ? undefined : say(chat, `Impossible de t’envoyer ta carte pour le moment.\n🔧 ${r.error}`)
  return say(
    chat,
    r.ok ? `📩 ${tag(me.jid)} : carte renvoyée en privé.` : `Impossible de t’écrire en privé : envoie-moi d’abord un message en privé, puis *${P}loup role*.\n🔧 ${r.error}`,
    [me.jid]
  )
}

const COMMAND_WORDS = new Set(['loup', 'loups', 'lg'])

const handleCommand = async (chat, isGroup, me, text, mentioned, quoted) => {
  const [cmdRaw, ...args] = text.slice(P.length).trim().split(/\s+/)
  if (!COMMAND_WORDS.has((cmdRaw || '').toLowerCase())) return
  const word = norm(args[0] || '')

  if (word === 'role' || word === 'carte') return resendRole(chat, isGroup, me)
  if (word === 'roles') return say(chat, ROLES_TEXT())
  if (word === 'regles' || word === 'regle' || word === 'rules') return say(chat, RULES())
  if (word === 'aide' || word === 'help') return say(chat, HELP())
  if (!isGroup) return say(chat, `🐺 Ce jeu se joue dans un groupe. Ici, tape *${P}loup role* pour retrouver ta carte, ou *${P}loup aide*.`)

  const key = chat
  const g = games.get(key)
  const isStarter = !!g && hasId(g.starter, me.ids)

  if (word === 'ouvrir') {
    if (g) return say(chat, 'Une partie est en cours : le bot gère lui-même la fermeture du groupe.')
    try {
      await sock.groupSettingUpdate(chat, 'not_announcement')
      return say(chat, '🔓 Groupe rouvert.')
    } catch (e) {
      return say(chat, `❌ Impossible de rouvrir le groupe (suis-je admin ?).\n🔧 ${e.message}`)
    }
  }

  if (word === 'top') {
    const board = wins.get(key)
    if (!board || !board.size) return say(chat, 'Aucune victoire pour l’instant. Lancez une partie ! 🐺')
    const sorted = [...board.values()].sort((a, b) => b.n - a.n).slice(0, 10)
    const medals = ['🥇', '🥈', '🥉']
    return say(chat, `🏆 *Classement du Loup-Garou*\n\n${sorted.map((e, i) => `${medals[i] || '▫️'} ${tag(e.jid)} — ${e.n} victoire(s)`).join('\n')}`, sorted.map((e) => e.jid))
  }

  if (word === 'etat' || word === 'statut') {
    if (!g) return say(chat, `Aucune partie en cours. Lance-en une avec *${P}loup*.`)
    const phaseLabel = { lobby: '🚪 Salle d’attente', roles: '🎴 Distribution des cartes', night: `🌙 Nuit ${g.nightNo}`, day: `☀️ Jour ${g.nightNo} — débat`, vote: `🗳️ Jour ${g.nightNo} — vote`, hunter: '🏹 Tir du chasseur' }[g.phase] || g.phase
    const left = g.deadline ? Math.max(0, Math.ceil((g.deadline - Date.now()) / 1000)) : null
    const dead = g.players.filter((p) => !p.alive)
    return say(
      chat,
      `📊 *État de la partie*\n\n🧭 ${phaseLabel}\n👥 En vie (${living(g).length}/${g.players.length}) : ${listOf(living(g))}\n` +
        (dead.length ? `💀 Morts : ${listOf(dead)}\n` : '') +
        (left !== null && g.phase !== 'night' ? `⏱️ Temps restant : *${left} s*\n` : ''),
      jidsOf(g.players)
    )
  }

  if (word === 'vivants' || word === 'liste') {
    if (!g) return say(chat, 'Aucune partie en cours.')
    const list = g.phase === 'lobby' ? g.players : living(g)
    return say(chat, `👥 *${g.phase === 'lobby' ? 'Inscrits' : 'Joueurs en vie'}* (${list.length})\n${list.map((p, i) => `${i + 1}. ${tag(p.jid)}`).join('\n')}`, jidsOf(list))
  }

  if (word === 'vote') {
    if (!g || g.phase !== 'vote') return say(chat, 'Le vote n’est possible que pendant la phase de vote.')
    const voter = findPlayer(g, me.ids)
    if (!voter || !voter.alive) return say(chat, 'Seuls les joueurs en vie peuvent voter.')
    const target = mentioned[0] || quoted
    if (!target) return say(chat, `Mentionne le suspect : *${P}loup vote @joueur*`)
    return registerVote(g, voter, target)
  }

  if (word === 'passer' || word === 'skip') {
    if (!g || g.phase !== 'day') return say(chat, 'Il n’y a pas de débat à passer pour le moment.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut passer le débat 😉')
    finishStep(g)
    return
  }

  if (word === 'join' || word === 'rejoindre') {
    if (!g) return say(chat, `Aucune partie ouverte. Lance-en une avec *${P}loup*.`)
    if (g.phase !== 'lobby') return say(chat, 'La partie a déjà commencé, rendez-vous à la prochaine ! 😉')
    if (findPlayer(g, me.ids)) return say(chat, 'Tu es déjà dans la partie 😉')
    if (g.players.length >= MAX_PLAYERS) return say(chat, `La partie est complète (${MAX_PLAYERS} joueurs max).`)
    g.players.push(toPlayer(me))
    const missing = MIN_PLAYERS - g.players.length
    await say(
      chat,
      `✅ ${tag(me.jid)} rejoint la partie ! (${g.players.length}/${MAX_PLAYERS})\n👥 ${listOf(g.players)}\n` +
        (missing > 0 ? `⏳ Il manque encore *${missing}* joueur(s) pour démarrer.` : `✅ Assez de joueurs ! Le lanceur peut taper *${P}loup go*.`),
      jidsOf(g.players)
    )
    if (g.players.length >= MAX_PLAYERS) {
      await say(chat, '🚪 Salle complète : on démarre tout de suite !')
      beginGame(key).catch((e) => console.error('[loup-garou]', e))
    }
    return
  }

  if (word === 'go' || word === 'start' || word === 'lancer') {
    if (!g || g.phase !== 'lobby') return say(chat, 'Aucune partie en attente de lancement.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut démarrer la partie 😉')
    beginGame(key, true).catch((e) => console.error('[loup-garou]', e))
    return
  }

  if (word === 'stop' || word === 'fin') {
    if (!g) return say(chat, 'Aucune partie en cours.')
    if (!isStarter) return say(chat, 'Seul le lanceur peut annuler la partie 😉')
    await abort(g)
    return say(chat, '🛑 Partie annulée par le lanceur.' + (g.phase !== 'lobby' ? ' Le groupe est rouvert.' : ''))
  }

  if (word) return say(chat, `Commande inconnue. Tape *${P}loup aide* pour la liste des commandes.`)

  // Ouverture d’une partie
  if (g) {
    return say(
      chat,
      g.phase === 'lobby'
        ? `⏳ Une partie attend des joueurs (${g.players.length}/${MAX_PLAYERS}). Rejoins-la avec *${P}loup join* !`
        : '⚠️ Une partie est déjà en cours dans ce groupe.'
    )
  }
  const starter = toPlayer(me)
  const created = { key, phase: 'lobby', starter, players: [starter], timer: null, ticks: [], deadline: 0, prompts: new Map() }
  games.set(key, created)
  const admin = await isBotAdmin(chat)
  const warn =
    admin === false
      ? `\n⚠️ Je ne suis pas *admin* : je ne pourrai pas fermer le groupe la nuit. Faites-moi admin !`
      : ''
  waitStep(created, LOBBY_SECONDS, {
    marks: [90, 60, 30, 10],
    tick: (m) =>
      say(key, `⏳ Départ dans *${m} s* — ${created.players.length}/${MAX_PLAYERS} joueurs (minimum ${MIN_PLAYERS}).\n👥 ${listOf(created.players)}\n➡️ Rejoindre : *${P}loup join*`, jidsOf(created.players)),
  }).then(() => {
    if (games.get(key) === created && created.phase === 'lobby') return beginGame(key)
  }).catch((e) => console.error('[loup-garou]', e))
  return say(
    chat,
    `🐺 *LOUP-GAROU* 🌕\n\nLe village dort, les loups rôdent…\n\n` +
      `🎭 Rôles : ${ROLE_ORDER.map((r) => ROLES[r].emoji).join(' ')} (*${P}loup roles*)\n` +
      `👥 Joueurs (1/${MAX_PLAYERS}, minimum ${MIN_PLAYERS}) : ${tag(me.jid)}\n` +
      `➡️ Rejoindre : *${P}loup join*\n▶️ Lancer : *${P}loup go* (lanceur), sinon départ automatique dans *${LOBBY_SECONDS} s*\n` +
      `📖 Règles : *${P}loup regles*${warn}`,
    [me.jid]
  )
}

// ───────── Messages du groupe : votes par mention ou réponse ─────────
const handleGameText = async (chat, me, mentioned, quoted) => {
  const g = games.get(chat)
  if (!g || g.phase !== 'vote') return
  const voter = findPlayer(g, me.ids)
  if (!voter || !voter.alive) return
  const target = mentioned[0] || quoted
  if (!target) return
  return registerVote(g, voter, target)
}

// ───────── Réception des messages ─────────
const onMessage = async (m) => {
  if (!m.message || !m.key?.remoteJid) return
  const chat = m.key.remoteJid
  if (chat === 'status@broadcast' || chat.endsWith('@broadcast') || chat.endsWith('@newsletter')) return

  const c = normalizeMessageContent(m.message)
  const text = String(c?.conversation || c?.extendedTextMessage?.text || c?.imageMessage?.caption || c?.videoMessage?.caption || '').trim()
  if (!text) return
  if (m.key.fromMe && sentTexts.includes(text)) return

  if (wolfGroups.has(chat)) return // groupe secret des loups : aucune commande ni vote ici
  const me = senderOf(m)
  if (!me) return
  const isGroup = chat.endsWith('@g.us')
  // garde les noms à jour (pour les cartes)
  if (me.name) for (const g of games.values()) {
    const p = findPlayer(g, me.ids)
    if (p) p.name = me.name
  }
  const info = c?.extendedTextMessage?.contextInfo
  const mentioned = info?.mentionedJid || []
  const quoted = info?.participant

  if (!isGroup) {
    const isCmd = new RegExp(`^${escRe(P)}\\s*(loup|loups|lg)\\b`, 'i').test(text)
    if (!isCmd && (await handlePrivate(me, text))) return
  }
  if (text.startsWith(P)) return handleCommand(chat, isGroup, me, text, mentioned, quoted)
  if (isGroup) return handleGameText(chat, me, mentioned, quoted)
}

// ───────── Connexion WhatsApp ─────────
let pairingRequested = false

const start = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  let version
  try {
    ;({ version } = await fetchLatestBaileysVersion())
  } catch (e) {
    console.warn('Version WhatsApp Web introuvable, version par défaut utilisée :', e.message)
  }

  const current = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  })
  sock = current

  current.ev.on('creds.update', saveCreds)

  current.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      if (PAIRING_NUMBER && !state.creds.registered) {
        if (!pairingRequested) {
          pairingRequested = true
          try {
            const code = await current.requestPairingCode(PAIRING_NUMBER)
            console.log(`\n🔗 Code de jumelage : ${code}\nWhatsApp → Appareils connectés → Connecter un appareil → Lier avec le numéro de téléphone.\n`)
          } catch (e) {
            pairingRequested = false
            console.error('Impossible d’obtenir le code de jumelage :', e.message)
          }
        }
      } else {
        console.log('\n📱 Scanne ce QR code avec WhatsApp → Appareils connectés :\n')
        qrcode.generate(qr, { small: true })
      }
    }

    if (connection === 'open') {
      pairingRequested = false
      console.log(`✅ Bot connecté (${num(current.user?.id)}). Préfixe : ${P} • Cartes : ${ROLE_DELIVERY} • Groupe des loups : ${WOLF_GROUP}`)
      cleanupOrphans().catch((e) => console.warn('[loup-garou] nettoyage des groupes :', e.message))
    }

    if (connection === 'close') {
      pairingRequested = false
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        console.error('🔒 Session déconnectée par WhatsApp (401). Session supprimée : une nouvelle liaison est nécessaire.')
        fs.rmSync(AUTH_DIR, { recursive: true, force: true })
        setTimeout(() => start().catch(console.error), 2000)
      } else {
        console.warn(`⚠️ Connexion fermée (code ${code ?? '?'}), reconnexion…`)
        setTimeout(() => start().catch(console.error), 3000)
      }
    }
  })

  current.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const m of messages) {
      try {
        await onMessage(m)
      } catch (e) {
        console.error('[loup-garou] erreur :', e)
      }
    }
  })
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection :', e))
process.on('uncaughtException', (e) => console.error('uncaughtException :', e))

// Vérifie au démarrage que les cartes peuvent être générées (emojis, polices, sharp)
if (ROLE_DELIVERY === 'photo') {
  try {
    loadEmoji()
    for (const r of ROLE_ORDER) {
      await bigCard({ role: r, title: ROLES[r].label, subtitle: ROLES[r].camp, lines: ROLES[r].lines })
    }
    await listCard({ role: 'garde', title: 'TEST', subtitle: 'test', items: [{ name: 'Test', num: '0000' }], notes: ['ok'] })
  } catch (e) {
    console.error(
      `❌ Impossible de générer les cartes (${e.message}).\n` +
        `   Vérifie que « yarn install » a bien installé sharp et que les dossiers assets/ et fonts/ sont présents,\n` +
        `   ou mets ROLE_DELIVERY=text dans .env (cartes en texte, sans image).`
    )
    process.exit(1)
  }
}

start().catch((e) => {
  console.error('Démarrage impossible :', e)
  process.exit(1)
})