import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { THEMES, readTheme, applyTheme } from './lib/theme'

// The standard account control: an avatar in the header corner that opens a
// small menu. It keeps the identity and the sign-out button available without
// letting either compete with the screen's actual content.
//
// The menu is positioned `fixed` and measured off the avatar each time it
// opens. Absolute positioning looked equivalent but was not: an absolutely
// positioned box still counts towards the page's scrollable area, so opening
// the menu grew the document — sideways past the edge, and downwards on a short
// screen. A fixed box contributes nothing to layout at all, which is exactly
// what "overlay what is beneath it" means.
export default function UserMenu({ email }) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState({ top: 0, left: 0 })
  const [theme, setTheme] = useState(readTheme)
  const wrapper = useRef(null) // a handle on the real DOM node, to test clicks against

  function toggle() {
    if (open) return setOpen(false)
    // The header is taller on screens that carry a back button, so the position
    // is measured rather than assumed from a constant.
    const rect = wrapper.current.getBoundingClientRect()
    setAt({ top: rect.bottom + 8, left: rect.left })
    setOpen(true)
  }

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
    // a fixed menu would otherwise sit still while the page moves under it
    const onScroll = () => setOpen(false)

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, { passive: true })
    // Listeners live outside React, so they are ours to remove; without this
    // every open would leave another one behind.
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll)
    }
  }, [open])

  return (
    <div className="user-menu" ref={wrapper}>
      <button
        type="button"
        className="avatar"
        onClick={toggle}
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
        <div className="menu" role="menu" style={{ top: at.top, left: at.left }}>
          <p className="menu-email">{email}</p>

          <div className="menu-theme">
            <div className="chips">
              {THEMES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`chip${theme === option.id ? ' on' : ''}`}
                  onClick={() => {
                    applyTheme(option.id)
                    setTheme(option.id)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button type="button" role="menuitem" onClick={() => supabase.auth.signOut()}>
            יציאה
          </button>
        </div>
      )}
    </div>
  )
}
