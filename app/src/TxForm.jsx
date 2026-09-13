import { useId, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO } from './lib/format'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, suggestFrom } from './lib/categories'

const COLUMNS = 'id, date, description, category, amount, capital, adjust, project_id, project_share'

// One form for both jobs: adding a transaction and editing an existing one.
// They differ only in which query runs on submit, so keeping them apart would
// mean maintaining the same fields, validation and layout twice.
export default function TxForm({
  tx,
  descriptions = [],
  categories = [],
  recall = {},
  projects = [],
  defaultProjectId = '', // set when the form is opened from inside a project
  defaultDirection = 'out', // follows the ledger's active filter
  onSaved,
  onDeleted,
  onCancel,
}) {
  const editing = Boolean(tx)
  const listId = useId() // unique per instance, so two open forms never share a datalist

  // Direction is a UI choice, not a column: it becomes the sign of `amount`,
  // so the ledger stays one flat list and a total is a sum, not two cases.
  const [direction, setDirection] = useState(tx ? (tx.amount > 0 ? 'in' : 'out') : defaultDirection)
  const [date, setDate] = useState(tx ? tx.date : todayISO())
  const [description, setDescription] = useState(tx ? tx.description : '')
  const [category, setCategory] = useState(tx ? tx.category || '' : '')
  const [projectId, setProjectId] = useState(
    tx && tx.project_id ? String(tx.project_id) : String(defaultProjectId || ''),
  )
  const [share, setShare] = useState(
    tx && tx.project_share != null ? String(tx.project_share) : '100',
  )
  const [amount, setAmount] = useState(tx ? String(Math.abs(tx.amount)) : '')
  const [capital, setCapital] = useState(tx ? tx.capital : false)
  // once he edits the category himself, stop guessing at it
  const [categoryTouched, setCategoryTouched] = useState(editing)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const categoryOptions = suggestFrom(
    direction === 'out' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES,
    categories,
  )

  // A description he has used before already carries an answer to "which
  // category?" — so reuse it instead of asking the same question twice.
  function handleDescription(value) {
    setDescription(value)
    if (!categoryTouched && recall[value]) setCategory(recall[value])
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const magnitude = Math.abs(Number(amount))
    const values = {
      date,
      description: description.trim(),
      category: category.trim() || null,
      // '' means the כללי / סדנה bucket — stored as null, not as a fake project
      project_id: projectId ? Number(projectId) : null,
      // a share only means anything against a project; the כללי bucket is whole
      project_share: projectId ? Number(share) || 100 : 100,
      amount: direction === 'out' ? -magnitude : magnitude,
      capital: direction === 'in' ? capital : false,
    }

    const query = editing
      ? supabase.from('txs').update(values).eq('id', tx.id)
      : supabase.from('txs').insert(values)

    const { data, error } = await query.select(COLUMNS).single()

    if (error) setError(error.message)
    else onSaved(data)
    setBusy(false)
  }

  async function handleDelete() {
    if (!window.confirm('למחוק את התנועה?')) return
    setBusy(true)
    const { error } = await supabase.from('txs').delete().eq('id', tx.id)
    if (error) setError(error.message)
    else onDeleted(tx.id)
    setBusy(false)
  }

  return (
    <form className={`add ${direction}`} onSubmit={handleSubmit}>
      <div className="chips">
        <button
          type="button"
          className={`chip out${direction === 'out' ? ' on' : ''}`}
          onClick={() => setDirection('out')}
        >
          − הוצאה
        </button>
        <button
          type="button"
          className={`chip in${direction === 'in' ? ' on' : ''}`}
          onClick={() => setDirection('in')}
        >
          + הכנסה
        </button>
      </div>

      <label>
        תיאור
        {/* a datalist is free text and a dropdown at once — he can pick a past
            entry or type something new, and the new one becomes an option next time */}
        <input
          value={description}
          onChange={(e) => handleDescription(e.target.value)}
          list={`${listId}-desc`}
          required
        />
        <datalist id={`${listId}-desc`}>
          {descriptions.map((text) => (
            <option key={text} value={text} />
          ))}
        </datalist>
      </label>

      <label>
        קטגוריה
        <input
          value={category}
          onChange={(e) => {
            setCategoryTouched(true)
            setCategory(e.target.value)
          }}
          list={`${listId}-cat`}
        />
        <datalist id={`${listId}-cat`}>
          {categoryOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>

      <label>
        פרויקט
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">כללי / סדנה</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      {projectId && (
        // A board bought half for this job and half for stock is one bank
        // movement. The ledger keeps the whole amount; only the project's own
        // cost takes the share.
        <label>
          כמה מזה שייך לפרויקט (%)
          <input
            type="number"
            inputMode="decimal"
            min="1"
            max="100"
            value={share}
            onChange={(e) => setShare(e.target.value)}
          />
        </label>
      )}

      <div className="row">
        <label>
          סכום
          <span className="amount-field">
            <span className="sign">{direction === 'out' ? '−' : '+'}</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </span>
        </label>
        <label>
          תאריך
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
      </div>

      {direction === 'in' && (
        <label className="check">
          <input type="checkbox" checked={capital} onChange={(e) => setCapital(e.target.checked)} />
          הזרמת הון בעלים (לא מחזור)
        </label>
      )}

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy || !description.trim() || !amount}>
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
