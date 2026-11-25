// 🔠 Polices embarquées : doit être importé AVANT « sharp »
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT } from '../paths.js'

// Polices embarquées (dossier fonts/) : les cartes s’affichent pareil sur n’importe quel serveur.
try {
  const fontDir = path.join(ROOT, 'fonts')
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
