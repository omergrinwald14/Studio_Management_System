import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './Login'
import Clients from './Clients'
import UserMenu from './UserMenu'

// The root component. Its only job right now is to decide which screen the
// session warrants: the login form, or the app. Everything else hangs off that.
export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

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

  return (
    <main className="login">
      <header className="top">
        <h1>לקוחות</h1>
        <UserMenu email={session.user.email} />
      </header>
      <div className="card">
        <Clients />
      </div>
    </main>
  )
}
