// Light or dark, or whatever the phone is already set to. The choice is a
// per-device preference rather than business data, so it stays in localStorage
// and never reaches the database.

const KEY = 'theme'
export const THEMES = [
  { id: 'auto', label: 'לפי המכשיר' },
  { id: 'light', label: 'בהיר' },
  { id: 'dark', label: 'כהה' },
]

export function readTheme() {
  // A private window can refuse localStorage outright, and a theme is never
  // worth a crash — fall back to following the device.
  try {
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'auto'
  } catch {
    return 'auto'
  }
}

// "auto" removes the attribute entirely, which hands the page back to the
// prefers-color-scheme media query rather than pinning it to a guess.
export function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  try {
    if (theme === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // nothing to do: the page still looks right for this session
  }
}
