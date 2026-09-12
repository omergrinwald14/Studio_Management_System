import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'

// The standard account control: an avatar in the header corner that opens a
// small menu. It keeps the identity and the sign-out button available without
// letting either compete with the screen's actual content.
export default function UserMenu({ email }) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef(null) // a handle on the real DOM node, to test clicks against

  useEffect(() => {
    if (!open) return
    function onPointerDown(event) {
      // A click anywhere outside the menu closes it — the behaviour every
      // dropdown has, and the reason the ref exists.
      if (!wrapper.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    // Listeners live outside React, so they are ours to remove; without this
    // every open would leave another one behind.
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="user-menu" ref={wrapper}>
      <button
        type="button"
        className="avatar"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="החשבון שלי"
      >
        {/* Drawn inline rather than loaded as a file: one icon, no request,
            and currentColor lets it follow the button's colour in both themes. */}
        <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"
             fill="none" stroke="currentColor" strokeWidth="1.7"
             strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.8 20c0-3.6 3.2-5.8 7.2-5.8s7.2 2.2 7.2 5.8" />
        </svg>
      </button>

      {open && (
        <div className="menu" role="menu">
          <p className="menu-email">{email}</p>
          <button type="button" role="menuitem" onClick={() => supabase.auth.signOut()}>
            יציאה
          </button>
        </div>
      )}
    </div>
  )
}
