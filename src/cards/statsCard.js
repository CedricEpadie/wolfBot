// 📈 Carte de statistiques d’un joueur (commande « /loup stats »)
import { P } from '../config.js'
import { ROLES, ROLE_ORDER } from '../game/roles.js'
import { displaySegments, fitSegments } from './names.js'
import { txt, toJpeg, nameSvg } from './draw.js'
import { W, MUTED, GOLD, HEADER_BOTTOM, svgPage, emojiImg, roleImg, panel, divider } from './kit.js'

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0)
const GREEN = '#3ddc84'
const BLUE = '#7fb2ff'

// Grosse tuile « valeur + libellé »
const tile = (x, y, w, h, value, label, color) =>
  panel(x, y, w, h, { fill: color, opacity: 0.13, stroke: color, rx: 20 }) + txt(x + w / 2, y + h * 0.56, 62, color, `${value}`, { bold: true }) + txt(x + w / 2, y + h - 22, 25, MUTED, label)

// Tuile « icône + libellé + valeur »
const mini = (x, y, w, icon, label, value) =>
  panel(x, y, w, 92, { opacity: 0.06, rx: 18 }) + emojiImg(icon, x + 18, y + 22, 48) + txt(x + 82, y + 38, 24, MUTED, label, { anchor: 'start' }) + txt(x + 82, y + 76, 36, '#ffffff', `${value}`, { bold: true, anchor: 'start' })

// entry : résultat de statsOf() • rank : { rank, total } ou null • recent : derniers rôles reçus (le plus récent d’abord)
export const statsCard = ({ entry: e, rank = null, recent = [] }) => {
  const favorite = Object.entries(e.roles).sort((a, b) => b[1] - a[1])[0]?.[0] || 'villageois'
  const rate = pct(e.wins, e.played)
  const wolfGames = e.roles.loup || 0
  const villageGames = e.played - wolfGames
  const who = { name: e.name || '', num: e.jid.split('@')[0].split(':')[0] }

  let body = roleImg(favorite, 48, 36, 108)
  body += nameSvg(fitSegments(displaySegments(who, false), 46, 650), 186, 92, 46, '#ffffff')
  body += txt(186, 140, 26, MUTED, rank ? `Classement du groupe : n° ${rank.rank} sur ${rank.total}` : 'Statistiques du joueur', { anchor: 'start' })
  body += divider(HEADER_BOTTOM)

  // Parties / victoires / taux
  let y = HEADER_BOTTOM + 30
  const tw = 252
  body += tile(48, y, tw, 150, e.played, 'parties', BLUE) + tile(48 + tw + 24, y, tw, 150, e.wins, e.wins > 1 ? 'victoires' : 'victoire', GREEN) + tile(48 + 2 * (tw + 24), y, tw, 150, `${rate} %`, 'de victoires', GOLD)
  y += 150 + 30

  // Barre du taux de victoire
  body += panel(48, y, 804, 26, { opacity: 0.1, rx: 13 })
  if (rate > 0) body += panel(48, y, Math.max(26, (804 * rate) / 100), 26, { fill: GREEN, opacity: 1, rx: 13 })
  y += 26 + 38

  // Par camp
  const camp = (x, role, title, color, wins, games) =>
    panel(x, y, 392, 128, { fill: color, opacity: 0.11, stroke: color, rx: 20 }) +
    roleImg(role, x + 16, y + 20, 88) +
    txt(x + 122, y + 40, 26, MUTED, title, { anchor: 'start' }) +
    txt(x + 122, y + 86, 44, color, `${wins} / ${games}`, { bold: true, anchor: 'start' }) +
    txt(x + 122, y + 114, 22, MUTED, 'victoires / parties', { anchor: 'start' }) +
    txt(x + 392 - 20, y + 86, 30, '#ffffff', games ? `${pct(wins, games)} %` : '–', { bold: true, anchor: 'end' })
  body += camp(48, 'loup', 'EN LOUP-GAROU', ROLES.loup.color, e.winsWolf, wolfGames) + camp(460, 'villageois', 'EN VILLAGE', ROLES.villageois.color, e.winsVillage, villageGames)
  y += 128 + 24

  // Séries, survie, mairie
  body += mini(48, y, 392, '🔥', 'Série en cours', e.streak) + mini(460, y, 392, '⭐', 'Record de série', e.bestStreak)
  y += 92 + 16
  body += mini(48, y, 392, '💚', 'Survivant', `${e.survived} fois`) + mini(460, y, 392, '👑', 'Maire', `${e.mayor} fois`)
  y += 92 + 40

  // Rôles joués
  const played = ROLE_ORDER.filter((r) => e.roles[r]).sort((a, b) => e.roles[b] - e.roles[a])
  if (played.length) {
    body += txt(56, y + 8, 30, GOLD, 'RÔLES JOUÉS', { bold: true, anchor: 'start' })
    y += 30
    const max = e.roles[played[0]]
    for (const r of played) {
      body += roleImg(r, 56, y + 4, 56)
      body += txt(128, y + 38, 25, ROLES[r].color, ROLES[r].label, { bold: true, anchor: 'start' })
      body += panel(430, y + 16, 330, 22, { opacity: 0.08, rx: 11 }) + panel(430, y + 16, Math.max(22, (330 * e.roles[r]) / max), 22, { fill: ROLES[r].color, opacity: 0.9, rx: 11 })
      body += txt(W - 60, y + 38, 28, '#ffffff', `${e.roles[r]}`, { bold: true, anchor: 'end' })
      y += 62
    }
    y += 34
  }

  // Dernières parties
  if (recent.length) {
    body += txt(56, y + 8, 30, GOLD, 'DERNIÈRES PARTIES', { bold: true, anchor: 'start' })
    body += txt(W - 60, y + 8, 22, MUTED, 'la plus récente à gauche', { anchor: 'end' })
    y += 28
    recent.slice(0, 6).forEach((r, i) => {
      const x = 56 + i * 134
      body += panel(x, y, 116, 116, { fill: ROLES[r].color, opacity: 0.12, stroke: ROLES[r].color, rx: 18 }) + roleImg(r, x + 14, y + 14, 88)
    })
    y += 116 + 24
  }

  const H = y + 100
  body += divider(H - 84)
  body += txt(W / 2, H - 42, 25, MUTED, `${P}loup top : classement du groupe`)
  return toJpeg(svgPage(H, GOLD, body))
}
