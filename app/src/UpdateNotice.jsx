import { useEffect, useState } from 'react'

// The app changes most days while he is using it, and a tab left open keeps
// running whatever JavaScript it loaded — a pull-to-refresh on a phone often
// does not fetch a new one either. So the page checks for itself rather than
// leaving him on an old version without knowing it.
//
// Vite fingerprints the bundle, so "am I current?" is just: does the filename
// the server is serving still match the one I am running from?
const RUNNING = new URL(import.meta.url).pathname

export default function UpdateNotice() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    // the dev server hot-reloads, so there is nothing here to catch
    if (import.meta.env.DEV) return

    async function check() {
      try {
        const html = await fetch('/', { cache: 'no-store' }).then((response) => response.text())
        const match = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)
        if (match && !RUNNING.endsWith(match[0])) setStale(true)
      } catch {
        // offline, or the request was blocked — just try again next time
      }
    }

    check()
    // Coming back to the app is exactly when a new version is most likely to
    // have shipped, and the cheapest moment to notice.
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      clearInterval(timer)
    }
  }, [])

  if (!stale) return null

  return (
    <div className="update-notice">
      <span>יצאה גרסה חדשה</span>
      {/* reload(true) is long gone; a cache-busting location assignment is what
          actually forces the new bundle on a stubborn mobile browser */}
      <button type="button" onClick={() => window.location.replace(window.location.pathname)}>
        רענון
      </button>
    </div>
  )
}
