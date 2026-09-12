import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import Ledger from './Ledger'
import Projects from './Projects'
import Clients from './Clients'
import Settings from './Settings'
import More from './More'
import UserMenu from './UserMenu'

// Every screen in one table, so the tab bar, the title and the router can never
// disagree about what exists. `tab` marks the four that earn a place on the bar;
// the rest live under "עוד" — a phone tab bar stops being thumb-friendly at five.
const SCREENS = {
  home: { title: 'בית', tab: true, render: () => <Dashboard /> },
  ledger: { title: 'תנועות', tab: true, render: () => <Ledger /> },
  projects: { title: 'פרויקטים', tab: true, render: () => <Projects /> },
  more: { title: 'עוד', tab: true, render: (go) => <More go={go} /> },
  clients: { title: 'לקוחות', parent: 'more', render: () => <Clients /> },
  settings: { title: 'הגדרות', parent: 'more', render: () => <Settings /> },
}

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

  const screen = SCREENS[screenId]
  // A screen reached from the hub highlights the hub's tab, so the bar always
  // says where you are rather than going blank.
  const activeTab = screen.parent || screenId

  return (
    <>
      <main className="app">
        <header className="top">
          <div>
            {screen.parent && (
              <button type="button" className="back" onClick={() => setScreenId(screen.parent)}>
                → {SCREENS[screen.parent].title}
              </button>
            )}
            <h1>{screen.title}</h1>
          </div>
          <UserMenu email={session.user.email} />
        </header>
        {screen.render(setScreenId)}
      </main>

      <nav className="tabs">
        {Object.entries(SCREENS)
          .filter(([, s]) => s.tab)
          .map(([id, s]) => (
            <button
              key={id}
              type="button"
              className={id === activeTab ? 'on' : ''}
              onClick={() => setScreenId(id)}
            >
              {s.title}
            </button>
          ))}
      </nav>
    </>
  )
}
