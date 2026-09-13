import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

const EMPTY = { name: '', amount: '', thickness: '', width: '', length: '', source: '', note: '' }

// What is lying around the workshop. Not inventory management — nothing is
// deducted automatically and there is no running balance, because a stock figure
// nobody maintains perfectly is worse than none: it gets believed. This answers
// one question, standing in the lumber yard: do I already have this?
export default function Stock() {
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('stock')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRows(data)
        setLoading(false)
      })
  }, [])

  if (loading) return <p>טוען מלאי…</p>

  // He searches by species or by thickness — "אגוז", "42" — so both are matched
  // against the same box rather than behind two separate controls.
  const term = query.trim()
  const visible = term
    ? rows.filter((row) =>
        [row.name, row.amount, row.source, row.note, row.thickness, row.width, row.length]
          .filter(Boolean)
          .join(' ')
          .includes(term),
      )
    : rows

  return (
    <>
      {error && <p className="error">{error}</p>}

      <label className="search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש — סוג עץ, עובי, מקור"
        />
      </label>

      {editing ? (
        <StockForm
          item={editing}
          onSaved={(saved) => {
            setRows(
              [...rows.filter((row) => row.id !== saved.id), saved].sort((a, b) =>
                a.name.localeCompare(b.name, 'he'),
              ),
            )
            setEditing(null)
          }}
          onDeleted={(id) => {
            setRows(rows.filter((row) => row.id !== id))
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" className="add-toggle" onClick={() => setEditing(EMPTY)}>
          + שארית
        </button>
      )}

      {visible.length === 0 ? (
        <p className="muted">{rows.length ? 'אין התאמה לחיפוש' : 'אין שאריות רשומות'}</p>
      ) : (
        <ul className="rows">
          {visible.map((row) => (
            <li key={row.id}>
              <button type="button" className="row-btn" onClick={() => setEditing(row)}>
                <span className="what">
                  <span className="desc">{row.name}</span>
                  <span className="cat">
                    {[row.amount, dimensions(row), row.source].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// "42 × 200 × 1200 מ"מ", skipping whatever he did not measure
function dimensions(row) {
  const parts = [row.thickness, row.width, row.length].filter((value) => value != null)
  return parts.length ? `${parts.join(' × ')} מ"מ` : null
}

function StockForm({ item, onSaved, onDeleted, onCancel }) {
  const editing = Boolean(item.id)
  const [values, setValues] = useState({ ...EMPTY, ...item })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(field, value) {
    setValues({ ...values, [field]: value })
  }

  function num(value) {
    return value === '' || value == null ? null : Number(value)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const payload = {
      name: values.name.trim(),
      amount: values.amount?.trim() || null,
      thickness: num(values.thickness),
      width: num(values.width),
      length: num(values.length),
      source: values.source?.trim() || null,
      note: values.note?.trim() || null,
    }

    const query = editing
      ? supabase.from('stock').update(payload).eq('id', item.id)
      : supabase.from('stock').insert(payload)

    const { data, error } = await query.select('*').single()
    if (error) setError(error.message)
    else onSaved(data)
    setBusy(false)
  }

  async function handleDelete() {
    if (!window.confirm('להסיר את השארית מהרשימה?')) return
    setBusy(true)
    const { error } = await supabase.from('stock').delete().eq('id', item.id)
    if (error) {
      setError(error.message)
      setBusy(false)
    } else onDeleted(item.id)
  }

  return (
    <form className="add" onSubmit={handleSubmit}>
      <label>
        חומר
        <input value={values.name} onChange={(e) => set('name', e.target.value)} required />
      </label>

      <label>
        כמה נשאר
        <input
          value={values.amount ?? ''}
          onChange={(e) => set('amount', e.target.value)}
          placeholder="שני לוחות · חצי יריעה"
        />
      </label>

      <div className="row">
        <label>
          עובי
          <input
            type="number"
            inputMode="decimal"
            value={values.thickness ?? ''}
            onChange={(e) => set('thickness', e.target.value)}
          />
        </label>
        <label>
          רוחב
          <input
            type="number"
            inputMode="decimal"
            value={values.width ?? ''}
            onChange={(e) => set('width', e.target.value)}
          />
        </label>
        <label>
          אורך
          <input
            type="number"
            inputMode="decimal"
            value={values.length ?? ''}
            onChange={(e) => set('length', e.target.value)}
          />
        </label>
      </div>

      <label>
        מאיפה הגיע
        <input
          value={values.source ?? ''}
          onChange={(e) => set('source', e.target.value)}
          placeholder="ספסל מאיה · מחסן עצים"
        />
      </label>

      <label>
        הערה
        <input value={values.note ?? ''} onChange={(e) => set('note', e.target.value)} />
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
            הסרה
          </button>
        )}
      </div>
    </form>
  )
}
