// 📁 Chemins du projet
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Racine du projet : le dossier qui contient package.json, .env, assets/, fonts/…
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
