// 🔑 Chargement du fichier .env (doit être importé avant config.js)
import path from 'node:path'
import { ROOT } from './paths.js'

try {
  process.loadEnvFile(path.join(ROOT, '.env')) // Node ≥ 20.12 ; sans .env, on utilise les variables d’environnement de l’hébergeur
} catch {}
