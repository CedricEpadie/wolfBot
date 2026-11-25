// ⏱️ Minuteries des étapes de jeu
import { alive } from './players.js'

// ───────── Minuteries ─────────
export const stopTimers = (g) => {
  clearTimeout(g.timer)
  for (const t of g.ticks || []) clearTimeout(t)
  g.ticks = []
  g.deadline = 0
}

// Attend `seconds` s (ou l’appel de g.finishStep()). `min` = durée minimale avant de rendre la main.
// `marks` = secondes restantes auxquelles `tick(m)` est appelé.
export const waitStep = (g, seconds, { min = 0, marks = [], tick } = {}) =>
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

export const finishStep = (g) => g.finishStep?.()
