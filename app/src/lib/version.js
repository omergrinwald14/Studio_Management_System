import { useCallback, useEffect, useState } from 'react'

// Is this tab running the version the server is serving?
//
// Vite fingerprints the bundle, so the question is just whether the filename in
// the served HTML still matches the one this code was loaded from. A tab left
// open keeps running whatever it loaded, and a pull-to-refresh on a phone often
// does not fetch a new one — which is how the client spent a day on yesterday's
// app without knowing.
const RUNNING = new URL(import.meta.url).pathname

export function useAppVersion() {
  // the dev server hot-reloads, so there is never anything here to catch
  const [status, setStatus] = useState(import.meta.env.DEV ? 'current' : 'checking')

  // Every write happens after the await, never synchronously while the effect
  // below is running — a synchronous setState there sets off a second render
  // before the first has been committed.
  const check = useCallback(async () => {
    if (import.meta.env.DEV) return
    try {
      const html = await fetch('/', { cache: 'no-store' }).then((response) => response.text())
      const match = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)
      setStatus(match && !RUNNING.endsWith(match[0]) ? 'stale' : 'current')
    } catch {
      // offline, or the request was blocked. Saying "up to date" would be a
      // claim we cannot make, so the last known answer stands.
    }
  }, [])

  useEffect(() => {
    // The rule sees that `check` can call setState and assumes it happens
    // during this effect. It cannot: every write in `check` is behind an
    // `await`, so the earliest any of them lands is a later microtask, which
    // is precisely the cascading render the rule exists to prevent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    check()
    // Coming back to the app is when a new version is most likely to have
    // shipped, and the cheapest moment to notice.
    document.addEventListener('visibilitychange', check)
    const timer = setInterval(check, 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', check)
      clearInterval(timer)
    }
  }, [check])

  return {
    stale: status === 'stale',
    checking: status === 'checking',
    check,
    // reload() will happily serve the cached page back; replacing the location
    // is what actually forces a stubborn mobile browser to fetch the new bundle
    reload: () => window.location.replace(window.location.pathname),
  }
}
