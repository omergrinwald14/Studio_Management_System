import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

const EMPTY = {
  name: '',
  supplier_id: '',
  qty: 1,
  planned_thickness: '',
  actual_thickness: '',
  width: '',
  length: '',
  planned_cost: '',
  actual_cost: '',
  note: '',
}

// The materials log — planned against actual. This is the differentiator of the
// whole system, and it comes straight from his own lessons text: a board ordered
// at 50mm arrived at 42mm after planing and the cut plan had to be redrawn. A
// cost-only log would have recorded the money and lost the reason.
export default function Materials({ projectId }) {
  const [rows, setRows] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [editing, setEditing] = useState(null) // a row, {} for a new one, null for none
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('materials').select('*').eq('project_id', projectId).order('id'),
      supabase.from('suppliers').select('id, name').order('name'),
    ]).then(([materialsResult, suppliersResult]) => {
      const failure = materialsResult.error || suppliersResult.error
      if (failure) setError(failure.message)
      else {
        setRows(materialsResult.data)
        setSuppliers(suppliersResult.data)
      }
      setLoading(false)
    })
  }, [projectId])

  function supplierName(id) {
    const supplier = suppliers.find((s) => s.id === id)
    return supplier ? supplier.name : null
  }

  if (loading) return <p>טוען חומרים…</p>

  const plannedTotal = rows.reduce((sum, row) => sum + Number(row.planned_cost || 0), 0)
  const actualTotal = rows.reduce((sum, row) => sum + Number(row.actual_cost || 0), 0)

  return (
    <>
      {error && <p className="error">{error}</p>}

      {editing ? (
        <MaterialForm
          material={editing}
          projectId={projectId}
          suppliers={suppliers}
          onSaved={(saved) => {
            setRows([...rows.filter((row) => row.id !== saved.id), saved].sort((a, b) => a.id - b.id))
            setEditing(null)
          }}
          onDeleted={(id) => {
            setRows(rows.filter((row) => row.id !== id))
            setEditing(null)
          }}
          onSupplierAdded={(supplier) => setSuppliers([...suppliers, supplier])}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" className="add-toggle" onClick={() => setEditing(EMPTY)}>
          + חומר
        </button>
      )}

      {rows.length === 0 ? (
        <p className="muted">אין חומרים רשומים לפרויקט הזה</p>
      ) : (
        <>
          <ul className="rows">
            {rows.map((row) => {
              // the whole reason for two columns: say so when they disagree
              const planned = Number(row.planned_thickness)
              const actual = Number(row.actual_thickness)
              const mismatch = row.planned_thickness != null && row.actual_thickness != null && planned !== actual

              return (
                <li key={row.id}>
                  <button type="button" className="row-btn column" onClick={() => setEditing(row)}>
                    <span className="what">
                      <span className="desc">
                        {row.name}
                        {mismatch && (
                          <span className="tag bad">
                            <span className="num">{planned}</span>
                            {' → '}
                            <span className="num">{actual}</span> מ"מ
                          </span>
                        )}
                      </span>
                      <span className="cat">
                        {[
                          supplierName(row.supplier_id),
                          row.qty ? `כמות ${row.qty}` : null,
                          row.actual_cost != null
                            ? formatMoney(row.actual_cost)
                            : row.planned_cost != null
                              ? `מתוכנן ${formatMoney(row.planned_cost)}`
                              : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="total">
            <span>מתוכנן מול בפועל</span>
            <span>
              <span className="num">{formatMoney(plannedTotal)}</span>
              {' → '}
              <span className={`num ${actualTotal > plannedTotal ? 'neg' : 'pos'}`}>
                {formatMoney(actualTotal)}
              </span>
            </span>
          </div>
        </>
      )}
    </>
  )
}

function MaterialForm({ material, projectId, suppliers, onSaved, onDeleted, onSupplierAdded, onCancel }) {
  const editing = Boolean(material.id)
  const [values, setValues] = useState({ ...EMPTY, ...material, supplier_id: material.supplier_id ?? '' })
  const [newSupplier, setNewSupplier] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function set(field, value) {
    setValues({ ...values, [field]: value })
  }

  // '' from an empty input must reach the database as null, not as 0 — "not
  // measured yet" and "measured zero" are different answers.
  function num(value) {
    return value === '' || value == null ? null : Number(value)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    let supplierId = values.supplier_id
    if (supplierId === 'new') {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({ name: newSupplier.trim() })
        .select('id, name')
        .single()
      if (error) {
        setError(error.message)
        setBusy(false)
        return
      }
      onSupplierAdded(data)
      supplierId = data.id
    }

    const payload = {
      project_id: projectId,
      supplier_id: supplierId === '' ? null : Number(supplierId),
      name: values.name.trim(),
      qty: num(values.qty) ?? 1,
      planned_thickness: num(values.planned_thickness),
      actual_thickness: num(values.actual_thickness),
      width: num(values.width),
      length: num(values.length),
      planned_cost: num(values.planned_cost),
      actual_cost: num(values.actual_cost),
      note: values.note.trim() || null,
    }

    const query = editing
      ? supabase.from('materials').update(payload).eq('id', material.id)
      : supabase.from('materials').insert(payload)

    const { data, error } = await query.select('*').single()
    if (error) setError(error.message)
    else onSaved(data)
    setBusy(false)
  }

  async function handleDelete() {
    if (!window.confirm('למחוק את שורת החומר?')) return
    setBusy(true)
    const { error } = await supabase.from('materials').delete().eq('id', material.id)
    if (error) {
      setError(error.message)
      setBusy(false)
    } else onDeleted(material.id)
  }

  return (
    <form className="add" onSubmit={handleSubmit}>
      <label>
        חומר
        <input value={values.name} onChange={(e) => set('name', e.target.value)} required />
      </label>

      <label>
        ספק
        <select value={values.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
          <option value="">ללא ספק</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
          <option value="new">+ ספק חדש</option>
        </select>
      </label>

      {values.supplier_id === 'new' && (
        <label>
          שם הספק
          <input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} required />
        </label>
      )}

      <div className="row">
        <label>
          עובי מתוכנן (מ"מ)
          <input
            type="number"
            inputMode="decimal"
            value={values.planned_thickness ?? ''}
            onChange={(e) => set('planned_thickness', e.target.value)}
          />
        </label>
        <label>
          עובי בפועל (מ"מ)
          <input
            type="number"
            inputMode="decimal"
            value={values.actual_thickness ?? ''}
            onChange={(e) => set('actual_thickness', e.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <label>
          רוחב (מ"מ)
          <input
            type="number"
            inputMode="decimal"
            value={values.width ?? ''}
            onChange={(e) => set('width', e.target.value)}
          />
        </label>
        <label>
          אורך (מ"מ)
          <input
            type="number"
            inputMode="decimal"
            value={values.length ?? ''}
            onChange={(e) => set('length', e.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <label>
          כמות
          <input
            type="number"
            inputMode="decimal"
            value={values.qty ?? ''}
            onChange={(e) => set('qty', e.target.value)}
          />
        </label>
        <label>
          עלות מתוכננת
          <input
            type="number"
            inputMode="decimal"
            value={values.planned_cost ?? ''}
            onChange={(e) => set('planned_cost', e.target.value)}
          />
        </label>
        <label>
          עלות בפועל
          <input
            type="number"
            inputMode="decimal"
            value={values.actual_cost ?? ''}
            onChange={(e) => set('actual_cost', e.target.value)}
          />
        </label>
      </div>

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
            מחיקה
          </button>
        )}
      </div>
    </form>
  )
}
