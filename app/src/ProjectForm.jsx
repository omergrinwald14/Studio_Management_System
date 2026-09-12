import { useState } from 'react'
import { supabase } from './lib/supabase'
import { STAGES } from './lib/stages'
import { todayISO } from './lib/format'

// Creating a project needs a client, and the client often does not exist yet —
// so the picker carries its own "new client" path. Forcing him to leave the
// screen, add a client, and come back is the kind of friction that makes a
// system go unused.
export default function ProjectForm({ clients, onSaved, onClientAdded, onCancel }) {
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState(clients.length ? String(clients[0].id) : 'new')
  const [newClient, setNewClient] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [stage, setStage] = useState(0)
  const [price, setPrice] = useState('')
  const [due, setDue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    let id = clientId
    if (clientId === 'new') {
      const { data, error } = await supabase
        .from('clients')
        .insert({ name: newClient.trim(), phone: newPhone.trim() || null })
        .select('id, name, phone')
        .single()
      if (error) {
        setError(error.message)
        setBusy(false)
        return // stop here: a project without its client would be half-saved
      }
      onClientAdded(data)
      id = data.id
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        client_id: Number(id),
        stage,
        price: price ? Number(price) : null,
        opened: todayISO(),
        due: due || null,
        days: 0,
        lost: false,
      })
      .select('id, name, client_id, stage, price, opened, due, days, planned_days, lost')
      .single()

    if (error) setError(error.message)
    else onSaved(data)
    setBusy(false)
  }

  const needsClientName = clientId === 'new' && !newClient.trim()

  return (
    <form className="add" onSubmit={handleSubmit}>
      <label>
        שם הפרויקט
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label>
        לקוח
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
          <option value="new">+ לקוח חדש</option>
        </select>
      </label>

      {clientId === 'new' && (
        <div className="row">
          <label>
            שם הלקוח
            <input value={newClient} onChange={(e) => setNewClient(e.target.value)} required />
          </label>
          <label>
            טלפון
            <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </label>
        </div>
      )}

      <label>
        שלב
        <select value={stage} onChange={(e) => setStage(Number(e.target.value))}>
          {STAGES.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="row">
        <label>
          מחיר סגור
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label>
          תאריך מסירה
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy || !name.trim() || needsClientName}>
          {busy ? 'שומר…' : 'שמירה'}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </form>
  )
}
