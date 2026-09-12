import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney, todayISO } from './lib/format'
import { DONE } from './lib/stages'

// The screen he opens standing in the lumber yard: what is in the account, what
// is left if he spends this, and what is still owed to him. Forward-looking,
// not a report of the past (D9).
export default function Dashboard() {
  const [settings, setSettings] = useState(null)
  const [txs, setTxs] = useState([])
  const [projects, setProjects] = useState([])
  const [spend, setSpend] = useState('')
  const [bank, setBank] = useState('')
  const [showBank, setShowBank] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('settings').select('opening, opening_date').eq('id', 1).single(),
      supabase.from('txs').select('id, date, amount, capital, adjust, project_id').order('date'),
      // a rejected quote's project is kept as history (lost = true) and owes nothing
      supabase.from('projects').select('id, name, price, due, stage').eq('lost', false),
    ]).then(([settingsResult, txsResult, projectsResult]) => {
      const failure = settingsResult.error || txsResult.error || projectsResult.error
      if (failure) setError(failure.message)
      else {
        setSettings(settingsResult.data)
        setTxs(txsResult.data)
        setProjects(projectsResult.data)
      }
      setLoading(false)
    })
  }, [])

  if (loading) return <p>טוען…</p>
  if (error) return <p className="error">{error}</p>

  // Movements before the opening date are already inside the opening figure —
  // counting them again would double them.
  const counted = settings.opening_date
    ? txs.filter((tx) => tx.date >= settings.opening_date)
    : txs

  // Every row moves the account, reconciliation rows included: an adjustment
  // exists precisely to bring this number back to what the bank says (D14).
  const balance = counted.reduce((sum, tx) => sum + Number(tx.amount), Number(settings.opening))

  const after = spend === '' ? null : balance - Number(spend)

  // What a client has actually paid on a job: money in, on that project, that
  // came from him — an owner capital injection is cash but it is not payment.
  function paidOn(projectId) {
    return txs
      .filter((tx) => tx.project_id === projectId && tx.amount > 0 && !tx.capital && !tx.adjust)
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
  }

  const receivables = projects
    .filter((project) => project.price != null)
    .map((project) => ({ ...project, due_amount: Number(project.price) - paidOn(project.id) }))
    .filter((project) => project.due_amount > 0)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))

  const receivableTotal = receivables.reduce((sum, project) => sum + project.due_amount, 0)

  async function handleReconcile(event) {
    event.preventDefault()
    const difference = Number(bank) - balance
    if (!difference) {
      setShowBank(false)
      setBank('')
      return
    }
    setBusy(true)
    const { data, error } = await supabase
      .from('txs')
      .insert({
        date: todayISO(),
        description: 'התאמה לבנק',
        amount: difference,
        adjust: true,
      })
      .select('id, date, amount, capital, adjust, project_id')
      .single()

    if (error) setError(error.message)
    else {
      setTxs([...txs, data])
      setShowBank(false)
      setBank('')
    }
    setBusy(false)
  }

  return (
    <>
      <section className="hero card">
        <p className="label">יתרה בעו"ש</p>
        <p className="value num">{formatMoney(balance)}</p>

        <form className="afford" onSubmit={(e) => e.preventDefault()}>
          <label>
            כמה יישאר אחרי הוצאה של
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={spend}
              onChange={(e) => setSpend(e.target.value)}
              placeholder="0"
            />
          </label>
          {after !== null && (
            <p className={`after num ${after < 0 ? 'neg' : 'pos'}`}>{formatMoney(after)}</p>
          )}
        </form>

        <button type="button" className="link" onClick={() => setShowBank(!showBank)}>
          התאמה לבנק
        </button>

        {showBank && (
          // He does not enter every bank fee, so the tracked balance drifts. He
          // types what the bank actually shows and the gap is booked as one row,
          // which resets the drift instead of letting it compound (D14).
          <form className="reconcile" onSubmit={handleReconcile}>
            <label>
              היתרה שמופיעה בבנק
              <input
                type="number"
                inputMode="decimal"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? 'שומר…' : 'עדכון'}
            </button>
          </form>
        )}
      </section>

      <section>
        <div className="section-title">
          <h2>יתרות לגבייה</h2>
          <span className="num">{formatMoney(receivableTotal)}</span>
        </div>
        {receivables.length === 0 ? (
          <p className="muted">אין יתרות פתוחות</p>
        ) : (
          <ul className="receivables">
            {receivables.map((project) => (
              <li key={project.id}>
                <span className="what">
                  <span className="desc">{project.name}</span>
                  <span className="cat">
                    {project.due ? `לגבייה עד ${project.due}` : 'ללא תאריך יעד'}
                    {project.stage === DONE && ' · הושלם'}
                  </span>
                </span>
                <span className="num">{formatMoney(project.due_amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
