import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useCached, isCached } from './lib/cache'

const EMPTY = { name: '', phone: '', note: '' }

// The suppliers library. The table has existed since the materials log needed
// something to point at, but until now there was no way to see one — which made
// the `note` column unreachable, and that column is the entire point of the
// feature in his spec: "מחסן X – איכות מצוינת, מידות בטלפון לא תמיד מדויקות".
// A phone number he can find elsewhere; what he learned about a yard he cannot.
export default function Suppliers() {
  const [suppliers, setSuppliers] = useCached('suppliers:list', [])
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!isCached('suppliers:list'))

  useEffect(() => {
    supabase
      .from('suppliers')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setSuppliers(data)
        setLoading(false)
      })
  }, [setSuppliers])

  if (loading) return <p>טוען ספקים…</p>

  return (
    <>
      {error && <p className="error">{error}</p>}

      {editing ? (
        <SupplierForm
          supplier={editing}
          onSaved={(saved) => {
            setSuppliers(
              [...suppliers.filter((s) => s.id !== saved.id), saved].sort((a, b) =>
                a.name.localeCompare(b.name, 'he'),
              ),
            )
            setEditing(null)
          }}
          onDeleted={(id) => {
            setSuppliers(suppliers.filter((s) => s.id !== id))
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" className="add-toggle" onClick={() => setEditing(EMPTY)}>
          + ספק חדש
        </button>
      )}

      {suppliers.length === 0 ? (
        <p className="muted">אין ספקים עדיין</p>
      ) : (
        <ul className="rows">
          {suppliers.map((supplier) => (
            <li key={supplier.id} className="stacked">
              <button type="button" className="row-btn" onClick={() => setEditing(supplier)}>
                <span className="what">
                  <span className="desc">{supplier.name}</span>
                  {supplier.note && <span className="cat">{supplier.note}</span>}
                </span>
              </button>
              {supplier.phone && (
                // a tap on his phone dials, which is what he wants from a
                // supplier list while standing in the workshop
                <a className="contact" href={`tel:${supplier.phone}`} dir="ltr">
                  {supplier.phone}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function SupplierForm({ supplier, onSaved, onDeleted, onCancel }) {
  const editing = Boolean(supplier.id)
  const [values, setValues] = useState({ ...EMPTY, ...supplier })
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
      note: values.note?.trim() || null,
    }
    const query = editing
      ? supabase.from('suppliers').update(payload).eq('id', supplier.id)
      : supabase.from('suppliers').insert(payload)

    const { data, error } = await query.select('*').single()
    if (error) setError(error.message)
    else onSaved(data)
    setBusy(false)
  }

  async function handleDelete() {
    // materials point at suppliers with ON DELETE SET NULL, so the record of
    // what was bought survives losing the supplier it came from
    if (!window.confirm('למחוק את הספק? רשומות החומרים שנקנו ממנו יישארו.')) return
    setBusy(true)
    const { error } = await supabase.from('suppliers').delete().eq('id', supplier.id)
    if (error) {
      setError(error.message)
      setBusy(false)
    } else onDeleted(supplier.id)
  }

  return (
    <form className="add" onSubmit={handleSubmit}>
      <label>
        שם הספק
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
        מה כדאי לזכור עליו
        <textarea
          rows="3"
          value={values.note ?? ''}
          onChange={(e) => set('note', e.target.value)}
          placeholder="איכות, אמינות המידות בטלפון, זמני אספקה"
        />
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
