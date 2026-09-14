import { useCallback, useState } from 'react'

// Switching tabs unmounts the screen you left and mounts the next one from
// scratch, so every navigation threw away what it had just fetched and showed a
// blank "טוען…" for a round trip. Each request is only ~150ms, but four of them
// with an empty screen in between is what "the app feels slow" actually meant.
//
// So the last result each screen loaded is kept here. Coming back renders from
// it immediately, and a fresh request goes out at the same time and replaces it
// a moment later — the numbers are never blank and never stale for long.
//
// In memory only, on purpose. A reload starts clean, so a wrong figure can
// never outlive the tab it was fetched in, which matters more here than saving
// one more request.
const store = new Map()

export function isCached(key) {
  return store.has(key)
}

/**
 * useState that survives its component being unmounted.
 *
 * Keys are per screen (`dashboard:txs`, not `txs`) because screens select
 * different columns and orderings of the same table — sharing one key would let
 * a narrower row set from one screen break another.
 */
export function useCached(key, initial) {
  const [value, setValue] = useState(() => (store.has(key) ? store.get(key) : initial))

  // stable, so a screen can list it as an effect dependency without the effect
  // re-running on every render
  const update = useCallback(
    (next) => {
      store.set(key, next)
      setValue(next)
    },
    [key],
  )

  return [value, update]
}
