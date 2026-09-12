import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { STAGES } from './lib/stages'

// Clients are first-class from day one (D5): contact details in one place, and
// a card listing every project built for them. Not a CRM — there is nothing
// here about acquiring anyone, only about the people he already builds for.
export default function Clients() {
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('id, name, phone, address').order('name'),
      supabase.from('projects').select('id, name, client_id, price, stage, lost'),
    ]).then(([clientsResult, projectsResult]) => {
      const failure = clientsResult.error || projectsResult.error
      if (failure) setError(failure.message)
      else {
        setClients(clientsResult.data)
        setProjects(projectsResult.data)
      }
      setLoading(false)
    })
  }, [])

  if (loading) return <p>טוען לקוחות…</p>

  return (
    <>
      {error && <p className="error">{error}</p>}

      {adding ? (
        <ClientForm
          onSaved={(client) => {
            setClients([...clients, client].sort((a, b) => a.name.localeCompare(b.name, 'he')))
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="add-toggle" onClick={() => setAdding(true)}>
          + לקוח חדש
        </button>
      )}

      {clients.length === 0 ? (
        <p className="muted">אין לקוחות עדיין</p>
      ) : (
        <ul className="rows">
          {clients.map((client) => {
            const mine = projects.filter((project) => project.client_id === client.id)
            const open = openId === client.id
            return (
              <li key={client.id} className="stacked">
                {/* the row opens the card in place — on a phone that beats
                    pushing a whole screen and needing a way back */}
                <button
                  type="button"
                  className="row-btn"
                  onClick={() => setOpenId(open ? null : client.id)}
                  aria-expanded={open}
                >
                  <span className="what">
                    <span className="desc">{client.name}</span>
                    <span className="cat">
                      {mine.length ? `${mine.length} פרויקטים` : 'ללא פרויקטים'}
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="card-body">
                    {client.phone && (
                      // a tel: link so a tap on his phone opens the dialer
                      <a className="contact" href={`tel:${client.phone}`} dir="ltr">
                        {client.phone}
                      </a>
                    )}
                    {client.address && <p className="muted small">{client.address}</p>}

                    {mine.length === 0 ? (
                      <p className="muted small">עוד לא נבנה עבורו כלום</p>
                    ) : (
                      <ul className="sublist">
                        {mine.map((project) => (
                          <li key={project.id}>
                            <span className="what">
                              <span className="desc">{project.name}</span>
                              <span className="cat">
                                {project.lost ? 'הצעה נדחתה' : STAGES[project.stage]}
                              </span>
                            </span>
                            {project.price != null && (
                              <span className="num">{formatMoney(project.price)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function ClientForm({ onSaved, onCancel }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    // .select() after .insert() returns the stored row, so the list shows the
    // real record with its generated id rather than a local guess.
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      .select('id, name, phone, address')
      .single()

    if (error) setError(error.message)
    else onSaved(data)
    setBusy(false)
  }

  return (
    <form className="add" onSubmit={handleSubmit}>
      <label>
        שם
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        טלפון
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        כתובת להובלה / התקנה
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy || !name.trim()}>
          {busy ? 'שומר…' : 'שמירה'}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </form>
  )
}
