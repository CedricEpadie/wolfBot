// 🔗 Socket WhatsApp courant.
// `sock` est une « live binding » ES : tous les modules qui l’importent voient automatiquement
// le nouveau socket après une reconnexion (setSock).
export let sock = null
export const setSock = (s) => {
  sock = s
}
