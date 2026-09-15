import { useRef, useState } from 'react'

// A text field with its own list of suggestions, in place of <datalist>.
// On an iPhone a datalist shows only three matches in the bar above the keyboard,
// with no way to scroll to the rest — so the list is drawn here instead, in the
// page, as a box that scrolls.
//
// It sits in the flow of the form rather than floating over it: several forms
// open inside a list whose corners are clipped (overflow:hidden), and a floating
// box would be cut off there.
//
// `multi` is for comma-separated values (tags): suggestions complete the last
// entry and skip the ones already typed.
export default function Suggest({ value, onChange, options, multi = false, ...inputProps }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1) // keyboard highlight, for the laptop
  const wrapper = useRef(null)

  const parts = multi ? value.split(',') : [value]
  const term = parts[parts.length - 1].trim()
  const taken = multi ? parts.slice(0, -1).map((part) => part.trim()) : []

  const matches = options.filter(
    (option) =>
      !taken.includes(option) &&
      option !== term && // already typed in full, nothing left to suggest
      option.includes(term),
  )
  const showing = open && matches.length > 0

  function pick(option) {
    if (multi) {
      const kept = parts.slice(0, -1).map((part) => part.trim()).filter(Boolean)
      onChange([...kept, option].join(', ') + ', ')
    } else {
      onChange(option)
      setOpen(false)
    }
    setActive(-1)
  }

  function handleKeyDown(event) {
    if (!showing) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      pick(matches[active])
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false)
    }
  }

  // Tapping the list itself must not close it, or it could never be scrolled.
  // Focus that lands on another field (a tap, or the keyboard's next arrow) does.
  function handleBlur(event) {
    const next = event.relatedTarget
    if (next && !wrapper.current.contains(next)) setOpen(false)
  }

  return (
    <div className="suggest" ref={wrapper} onBlur={handleBlur}>
      <input
        {...inputProps}
        value={value}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={showing}
        aria-autocomplete="list"
      />
      {showing && (
        // mousedown would move focus off the input on a laptop and close the list
        // before the click on an option could land
        <ul className="suggest-list" role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {matches.map((option, index) => (
            <li
              key={option}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'on' : undefined}
              onClick={(e) => {
                // the list sits inside a <label>, whose click would otherwise
                // refocus the input and throw the list straight open again
                e.preventDefault()
                pick(option)
              }}
            >
              {option}
            </li>
          ))}
          <li
            className="suggest-close"
            onClick={(e) => {
              e.preventDefault()
              setOpen(false)
            }}
          >
            סגירה
          </li>
        </ul>
      )}
    </div>
  )
}
