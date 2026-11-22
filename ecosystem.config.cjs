// Configuration pm2 (fichier .cjs car le projet utilise les modules ES)
module.exports = {
  apps: [
    {
      name: 'loup-garou',
      script: 'index.js',
      cwd: __dirname, // pour que .env, auth/, fonts/ et assets/ soient trouvés
      instances: 1, // UNE SEULE instance par session WhatsApp
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      max_memory_restart: '400M',
      time: true,
      env: { NODE_ENV: 'production' },
    },
  ],
}
