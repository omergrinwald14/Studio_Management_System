import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney, formatDate, todayISO, endOfMonth } from './lib/format'
import { balanceOf, receivablesOf, expectedMovements } from './lib/finance'
import { STAGES, DONE } from './lib/stages'
import WorkshopDays from './WorkshopDays'

// The screen he opens standing in the lumber yard: what is in the account, what
// is left if he spends this, what is still owed to him and what the balance
// looks like on a date he picks. Forward-looking, not a report of the past (D9).
export default function Dashboard() {
  const [settings, setSettings] = useState(null)
  const [txs, setTxs] = useState([])
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [spend, setSpend] = useState('')
  const [until, setUntil] = useState(endOfMonth())
  const [bank, setBank] = useState('')
  const [showBank, setShowBank] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('settings')
        .select('opening, opening_date, rent, days_per_month')
        .eq('id', 1)
        .single(),
      supabase.from('txs').select('id, date, amount, capital, adjust, project_id').order('date'),
      // a rejected quote's project is kept as history (lost = true) and owes nothing
      supabase.from('projects').select('id, name, client_id, price, due, stage').eq('lost', false),
      supabase.from('clients').select('id, name'),
    ]).then(([settingsResult, txsResult, projectsResult, clientsResult]) => {
      const failure =
        settingsResult.error || txsResult.error || projectsResult.error || clientsResult.error
      if (failure) setError(failure.message)
      else {
        setSettings(settingsResult.data)
        setTxs(txsResult.data)
        setProjects(projectsResult.data)
        setClients(clientsResult.data)
      }
      setLoading(false)
    })
  }, [])

  if (loading) return <p>טוען…</p>
  if (error) return <p className="error">{error}</p>

  const today = todayISO()
  const balance = balanceOf(txs, settings)

  // The figure is only as current as the last time it was checked against
  // reality — so say which date it speaks for instead of implying "now".
  const lastAdjust = txs
    .filter((tx) => tx.adjust)
    .map((tx) => tx.date)
    .sort()
    .pop()
  const asOf = lastAdjust || settings.opening_date

  const after = spend === '' ? null : balance - Number(spend)

  function clientName(id) {
    const client = clients.find((c) => c.id === id)
    return client ? client.name : ''
  }

  const receivables = receivablesOf(projects, txs)
  const receivableTotal = receivables.reduce((total, project) => total + project.due_amount, 0)

  const expected = expectedMovements({
    receivables,
    rent: settings.rent,
    today,
    until,
    labelFor: (project) => clientName(project.client_id),
  })
  const forecast = expected.reduce((total, item) => total + item.amount, balance)

  const active = projects.filter((project) => project.stage < DONE).sort((a, b) => b.stage - a.stage)

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
        date: today,
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
        <p className="label">יתרה בחשבון העסק</p>
        <p className="value num">{formatMoney(balance)}</p>
        <div className="asof-row">
          <span className="asof">
            {asOf ? `נכון ל־${formatDate(asOf)}` : 'לא הוגדרה יתרת פתיחה'}
          </span>
          <button type="button" className="link" onClick={() => setShowBank(!showBank)}>
            התאמה לבנק
          </button>
        </div>

        {showBank && (
          // He does not enter every bank fee, so the tracked balance drifts. He
          // types what the bank actually shows and the gap is booked as one row,
          // which resets the drift instead of letting it compound (D14).
          <form className="reconcile" onSubmit={handleReconcile}>
            <label>
              היתרה שמופיעה באפליקציה של הבנק
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

        <form className="afford" onSubmit={(e) => e.preventDefault()}>
          <label>
            כמה יישאר אחרי ההוצאה?
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={spend}
              onChange={(e) => setSpend(e.target.value)}
              placeholder="סכום בשקלים"
            />
          </label>
          {after !== null && (
            <p className={`after num ${after < 0 ? 'neg' : 'pos'}`}>{formatMoney(after)}</p>
          )}
        </form>
      </section>

      <WorkshopDays daysPerMonth={settings.days_per_month} />

      <section className="card forecast">
        <div className="fc-head">
          <span className="label">כמה כסף יהיה לי עד תאריך</span>
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
        <p className="value num">{formatMoney(forecast)}</p>
        <p className="muted small">יתרה צפויה ב־{formatDate(until)} · הערכה בלבד</p>

        <ul className="fc-list">
          {expected.length === 0 ? (
            <li className="muted">אין תנועות צפויות עד התאריך הזה</li>
          ) : (
            expected.map((item) => (
              <li key={item.key}>
                <span className="what">
                  <span className="desc">{item.label}</span>
                  <span className="cat">
                    {[item.note, formatDate(item.date)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={`num ${item.amount < 0 ? 'neg' : 'pos'}`}>
                  {formatMoney(item.amount)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <div className="section-title">
          <h2>יתרות לגבייה</h2>
          <span className="num">{formatMoney(receivableTotal)}</span>
        </div>
        {receivables.length === 0 ? (
          <p className="muted">אין יתרות פתוחות</p>
        ) : (
          <ul className="rows">
            {receivables.map((project) => (
              <li key={project.id}>
                <span className="what">
                  <span className="desc">{project.name}</span>
                  <span className="cat">
                    {[
                      clientName(project.client_id),
                      project.due ? `לגבייה עד ${formatDate(project.due)}` : 'ללא תאריך יעד',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="num">{formatMoney(project.due_amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="section-title">
          <h2>פרויקטים פעילים</h2>
        </div>
        {active.length === 0 ? (
          <p className="muted">אין פרויקטים פעילים</p>
        ) : (
          <ul className="rows">
            {active.map((project) => (
              <li key={project.id} className="stacked">
                <span className="what">
                  <span className="desc">{project.name}</span>
                  <span className="cat">{STAGES[project.stage]}</span>
                </span>
                <span className="pipeline" aria-hidden="true">
                  {STAGES.map((label, index) => (
                    <span key={label} className={index <= project.stage ? 'seg on' : 'seg'} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
