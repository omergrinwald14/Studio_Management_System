import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

// A throwaway screen that exists to prove the chain end to end: Vite, React,
// auth, RLS, and real rows — read and written from the browser. The real
// clients screen comes in Phase 3.
export default function Clients() {
  const [clients, setClients] = useState([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // select() returns { data, error } rather than throwing, so an RLS refusal
    // arrives as an ordinary value we can render instead of a crash.
    supabase
      .from('clients')
      .select('id, name, phone')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setClients(data)
        setLoading(false)
      })
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    // .select() after .insert() asks the server to hand back the saved row,
    // so the list shows the real record — with the id the database generated —
    // instead of a local guess that might differ from what was stored.
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: name.trim(), phone: phone.trim() || null })
      .select('id, name, phone')
      .single()

    if (error) setError(error.message)
    else {
      setClients([...clients, data].sort((a, b) => a.name.localeCompare(b.name, 'he')))
      setName('')
      setPhone('')
    }
    setSaving(false)
  }

  if (loading) return <p>טוען לקוחות…</p>

  return (
    <>
      {error && <p className="error">{error}</p>}

      {clients.length === 0 ? (
        <p className="muted">אין לקוחות עדיין</p>
      ) : (
        <ul className="clients">
          {clients.map((client) => (
            <li key={client.id}>
              {client.name}
              {client.phone && <span className="muted"> · {client.phone}</span>}
            </li>
          ))}
        </ul>
      )}

      <form className="add" onSubmit={handleSubmit}>
        <label>
          שם לקוח
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          טלפון
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <button type="submit" disabled={saving || !name.trim()}>
          {saving ? 'שומר…' : 'הוספת לקוח'}
        </button>
      </form>
    </>
  )
}
