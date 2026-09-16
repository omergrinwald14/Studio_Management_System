import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { STAGES } from './lib/stages'

const EMPTY = { name: '', phone: '', address: '' }

// Clients are first-class from day one (D5): contact details in one place, and
// a card listing every project built for them. Not a CRM — there is nothing
// here about acquiring anyone, only about the people he already builds for.
export default function Clients() {
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [openId, setOpenId] = useState(null)
  // One state for both jobs: EMPTY means "new client", a row means "edit that
  // one". Two separate flags would let the screen contradict itself.
  const [editing, setEditing] = useState(null)
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

  function handleSaved(saved) {
    setClients(
      [...clients.filter((c) => c.id !== saved.id), saved].sort((a, b) =>
        a.name.localeCompare(b.name, 'he'),
      ),
    )
    setEditing(null)
  }

  if (loading) return <p>טוען לקוחות…</p>

  return (
    <>
      {error && <p className="error">{error}</p>}

      {editing && !editing.id ? (
        <ClientForm
          client={EMPTY}
          projectCount={0}
          onSaved={handleSaved}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" className="add-toggle" onClick={() => setEditing(EMPTY)}>
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
            const editingThis = editing?.id === client.id
            return (
              <li key={client.id} className="stacked">
                {/* the row opens the card in place — on a phone that beats
                    pushing a whole screen and needing a way back */}
                <button
                  type="button"
                  className="row-btn"
                  onClick={() => {
                    setOpenId(open ? null : client.id)
                    setEditing(null)
                  }}
                  aria-expanded={open}
                >
                  <span className="what">
                    <span className="desc">{client.name}</span>
                    <span className="cat">
                      {mine.length ? `${mine.length} פרויקטים` : 'ללא פרויקטים'}
                    </span>
                  </span>
                </button>

                {open && editingThis && (
                  // the form replaces the card body instead of opening at the
                  // top of the screen, so he can still see whom he is editing
                  <div className="card-body">
                    <ClientForm
                      client={client}
                      projectCount={mine.length}
                      onSaved={handleSaved}
                      onDeleted={(id) => {
                        setClients(clients.filter((c) => c.id !== id))
                        setEditing(null)
                        setOpenId(null)
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                )}

                {open && !editingThis && (
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

                    <div className="row">
                      <button type="button" className="ghost" onClick={() => setEditing(client)}>
                        עריכה
                      </button>
                    </div>
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

function ClientForm({ client, projectCount, onSaved, onDeleted, onCancel }) {
  const editing = Boolean(client.id)
  const [values, setValues] = useState({ ...EMPTY, ...client })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(field, value) {
    setValues({ ...values, [field]: value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const payload = {
      name: values.name.trim(),
      phone: values.phone?.trim() || null,
      address: values.address?.trim() || null,
    }
    // .select() after the write returns the stored row, so the list shows the
    // record the database actually holds rather than a local guess.
    const query = editing
      ? supabase.from('clients').update(payload).eq('id', client.id)
      : supabase.from('clients').insert(payload)

    const { data, error } = await query.select('id, name, phone, address').single()
    if (error) setError(error.message)
    else onSaved(data)
    setBusy(false)
  }

  async function handleDelete() {
    // A project with no client is a job nobody can be billed for, so a client
    // with work on him cannot be deleted. Refuse here rather than let the
    // foreign key decide: this way the message says what to do next.
    if (projectCount > 0) {
      setError(`ללקוח ${projectCount} פרויקטים. כדי למחוק אותו צריך למחוק אותם קודם.`)
      return
    }
    if (!window.confirm(`למחוק את ${client.name}?`)) return
    setBusy(true)
    const { error } = await supabase.from('clients').delete().eq('id', client.id)
    if (error) {
      setError(error.message)
      setBusy(false)
    } else onDeleted(client.id)
  }

  return (
    <form className="add" onSubmit={handleSubmit}>
      <label>
        שם
        <input value={values.name} onChange={(e) => set('name', e.target.value)} required />
      </label>
      <label>
        טלפון
        <input
          type="tel"
          value={values.phone ?? ''}
          onChange={(e) => set('phone', e.target.value)}
        />
      </label>
      <label>
        כתובת להובלה / התקנה
        <input value={values.address ?? ''} onChange={(e) => set('address', e.target.value)} />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy || !values.name.trim()}>
          {busy ? 'שומר…' : 'שמירה'}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          ביטול
        </button>
        {editing && (
          <button type="button" className="danger" onClick={handleDelete} disabled={busy}>
            מחיקה
          </button>
        )}
      </div>
    </form>
  )
}
