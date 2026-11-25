// 💾 Lecture/écriture JSON : écriture atomique (fichier temporaire + renommage) pour ne jamais corrompre un fichier
import fs from 'node:fs'
import path from 'node:path'

export const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

export const writeJson = (file, data) => {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data))
    fs.renameSync(tmp, file)
    return true
  } catch (e) {
    console.warn('[loup-garou] écriture impossible :', file, e.message)
    return false
  }
}
