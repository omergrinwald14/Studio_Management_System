import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import Ledger from './Ledger'
import Projects from './Projects'
import Settings from './Settings'
import UserMenu from './UserMenu'

// The screens the tab bar switches between. Kept as data so the bar and the
// router below never disagree about what exists.
const SCREENS = [
  { id: 'home', title: 'בית', render: () => <Dashboard /> },
  { id: 'ledger', title: 'תנועות', render: () => <Ledger /> },
  { id: 'projects', title: 'פרויקטים', render: () => <Projects /> },
  { id: 'settings', title: 'הגדרות', render: () => <Settings /> },
]

// The root component. It decides what the session warrants — the login form or
// the app — and which screen is showing. Switching by state rather than by URL
// for now; a router earns its place once a screen needs to be linkable.
export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [screenId, setScreenId] = useState('home')

  useEffect(() => {
    // Supabase keeps the session in localStorage, so a refresh should not log
    // him out — but reading it is async, hence the "checking" state. Without it
    // the login form would flash for a moment on every reload.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })

    // Fires on login, logout and token refresh, in this tab and in others.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => data.subscription.unsubscribe() // stop listening when unmounted
  }, [])

  if (checking) return <main className="login"><p>טוען…</p></main>
  if (!session) return <Login />

  const screen = SCREENS.find((s) => s.id === screenId)

  return (
    <>
      <main className="app">
        <header className="top">
          <h1>{screen.title}</h1>
          <UserMenu email={session.user.email} />
        </header>
        {screen.render()}
      </main>

      <nav className="tabs">
        {SCREENS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === screenId ? 'on' : ''}
            onClick={() => setScreenId(s.id)}
          >
            {s.title}
          </button>
        ))}
      </nav>
    </>
  )
}
