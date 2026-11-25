// 🪪 Carte de rôle d’un joueur (image + texte de repli)
import { ROLES } from '../game/roles.js'
import { bigCard } from './render.js'
import { plainName } from './names.js'

export const roleCardFor = (g, p) => {
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
