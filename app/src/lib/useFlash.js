import { useCallback, useEffect, useRef, useState } from 'react'

const SHOWN_FOR = 2800

/**
 * [message, show] for a short confirmation (see Toast.jsx). The message clears
 * itself after a few seconds, so no screen has to remember to hide it.
 */
export function useFlash() {
  const [message, setMessage] = useState('')
  const timer = useRef(null)

  const show = useCallback((text) => {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(''), SHOWN_FOR)
  }, [])

  // a form closed mid-countdown must not set state on something that is gone
  useEffect(() => () => clearTimeout(timer.current), [])

  return [message, show]
}
