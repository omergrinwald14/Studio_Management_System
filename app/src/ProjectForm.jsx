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
  const [newAddress, setNewAddress] = useState('')
  const [stage, setStage] = useState(0)
  const [price, setPrice] = useState('')
  const [deposit, setDeposit] = useState('')
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
        .insert({
          name: newClient.trim(),
          phone: newPhone.trim() || null,
          address: newAddress.trim() || null,
        })
        .select('id, name, phone, address')
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

    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }

    // An advance paid up front is real money in, so it belongs in the ledger
    // from the start — not a fact he has to remember to add as a second step.
    if (Number(deposit) > 0) {
      const { error: depositError } = await supabase.from('txs').insert({
        date: todayISO(),
        description: `מקדמה — ${name.trim()}`,
        category: 'מקדמה',
        project_id: data.id,
        amount: Number(deposit),
        capital: false,
      })
      if (depositError) {
        // the project is already saved; a failed deposit row is a partial
        // problem, not a reason to lose the project he just created
        setError(`הפרויקט נשמר, אך המקדמה לא נרשמה: ${depositError.message}`)
        setBusy(false)
        onSaved(data)
        return
      }
    }

    onSaved(data)
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
        <>
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
          <label>
            כתובת להובלה / התקנה
            <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
          </label>
        </>
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
          מחיר
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

      <label>
        מקדמה שהתקבלה
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={deposit}
          onChange={(e) => setDeposit(e.target.value)}
          placeholder="אם כבר שולמה"
        />
      </label>

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
