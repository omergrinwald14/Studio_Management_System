import { useState } from 'react'
import { supabase } from './lib/supabase'

// The login screen. Rendered whenever there is no session, so it is the only
// thing an unauthenticated visitor can reach. The real protection is not here
// though — it is the RLS policies on the server, since the publishable key
// ships inside the browser and anyone can read it.
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault() // stop the browser's own form submit, which reloads the page
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('פרטי ההתחברות שגויים')
    setBusy(false)
  }

  return (
    <main className="login">
      <h1>סטודיו לנגרות</h1>
      <form className="card" onSubmit={handleSubmit}>
        <label>
          אימייל
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          סיסמה
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'מתחבר…' : 'כניסה'}
        </button>
      </form>
    </main>
  )
}
