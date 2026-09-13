import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import Ledger from './Ledger'
import Projects from './Projects'
import Clients from './Clients'
import Quotes from './Quotes'
import Stock from './Stock'
import Settings from './Settings'
import More from './More'
import UserMenu from './UserMenu'

// Every screen in one table, so the tab bar, the title and the router can never
// disagree about what exists. `tab` marks the four that earn a place on the bar;
// the rest live under "עוד" — a phone tab bar stops being thumb-friendly at five.
//
// `arg` is how one screen hands the next a subject: tapping a project on the
// dashboard opens that project's card rather than the bare list.
const SCREENS = {
  home: { title: 'בית', tab: true, render: (go) => <Dashboard go={go} /> },
  ledger: { title: 'תנועות', tab: true, render: () => <Ledger /> },
  projects: { title: 'פרויקטים', tab: true, render: (go, arg) => <Projects openId={arg} /> },
  more: { title: 'עוד', tab: true, render: (go) => <More go={go} /> },
  quotes: { title: 'הצעות מחיר', parent: 'more', render: () => <Quotes /> },
  stock: { title: 'שאריות בסדנה', parent: 'more', render: () => <Stock /> },
  clients: { title: 'לקוחות', parent: 'more', render: () => <Clients /> },
  settings: { title: 'הגדרות', parent: 'more', render: () => <Settings /> },
}

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [screen, setScreen] = useState({ id: 'home', arg: null })

  // One function handed to any screen that needs to send the user elsewhere.
  function go(id, arg = null) {
    setScreen({ id, arg })
  }

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

  const current = SCREENS[screen.id]
  // A screen reached from the hub highlights the hub's tab, so the bar always
  // says where you are rather than going blank.
  const activeTab = current.parent || screen.id

  return (
    <>
      <main className="app">
        <header className="top">
          <div>
            {current.parent && (
              <button type="button" className="back" onClick={() => go(current.parent)}>
                → {SCREENS[current.parent].title}
              </button>
            )}
            <h1>{current.title}</h1>
          </div>
          <UserMenu email={session.user.email} />
        </header>
        {current.render(go, screen.arg)}
      </main>

      <nav className="tabs">
        {Object.entries(SCREENS)
          .filter(([, s]) => s.tab)
          .map(([id, s]) => (
            <button
              key={id}
              type="button"
              className={id === activeTab ? 'on' : ''}
              onClick={() => go(id)}
            >
              {s.title}
            </button>
          ))}
      </nav>
    </>
  )
}
