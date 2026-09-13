import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney, formatDate, todayISO, endOfMonth } from './lib/format'
import { balanceOf, receivablesOf, expectedMovements } from './lib/finance'
import { STAGES, DONE } from './lib/stages'
import WorkshopDays from './WorkshopDays'
import ShortList from './ShortList'

// The screen he opens standing in the lumber yard: what is in the account, what
// is left if he spends this, and what the balance looks like on a date he picks.
// Forward-looking, not a report of the past (D9).
export default function Dashboard({ go }) {
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
        .select('opening, opening_date, rent, rent_day, days_per_month')
        .eq('id', 1)
        .single(),
      supabase
        .from('txs')
        .select('id, date, description, category, amount, capital, adjust, project_id, project_share')
        .order('date'),
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

  // Receivables no longer have a block of their own here — the money owed is
  // visible on each project's card. They still feed the forecast, which is the
  // question the dashboard exists to answer.
  const expected = expectedMovements({
    receivables: receivablesOf(projects, txs),
    rent: settings.rent,
    rentDay: settings.rent_day,
    today,
    until,
    labelFor: (project) => clientName(project.client_id),
  })
  const forecast = expected.reduce((total, item) => total + item.amount, balance)

  const active = projects.filter((project) => project.stage < DONE).sort((a, b) => b.stage - a.stage)
  const recent = [...txs].sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)))

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
      .select('id, date, description, category, amount, capital, adjust, project_id, project_share')
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
            {asOf ? `נכון ל-${formatDate(asOf)}` : 'לא הוגדרה יתרת פתיחה'}
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

      <section>
        <div className="section-title">
          <h2>פרויקטים פעילים</h2>
        </div>
        {active.length === 0 ? (
          <p className="muted">אין פרויקטים פעילים</p>
        ) : (
          <ShortList items={active} rows={3} onAll={() => go('projects')} allLabel="לכל הפרויקטים">
            {(project) => (
              <li key={project.id}>
                {/* the dashboard names a project, so it should also be the way
                    in — `go` carries the id across to the projects screen */}
                <button
                  type="button"
                  className="row-btn column"
                  onClick={() => go('projects', project.id)}
                >
                  <span className="what">
                    <span className="desc">{project.name}</span>
                    <span className="cat">{STAGES[project.stage]}</span>
                  </span>
                  <span className="pipeline" aria-hidden="true">
                    {STAGES.map((label, index) => (
                      <span key={label} className={index <= project.stage ? 'seg on' : 'seg'} />
                    ))}
                  </span>
                </button>
              </li>
            )}
          </ShortList>
        )}
      </section>

      <WorkshopDays daysPerMonth={settings.days_per_month} />

      <section className="card forecast">
        <div className="fc-head">
          <span className="label">כמה כסף יהיה בתאריך</span>
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </div>
        <p className="value num">{formatMoney(forecast)}</p>
        <p className="muted small">יתרה צפויה ב-{formatDate(until)} · הערכה בלבד</p>

        <ul className="fc-list">
          {expected.length === 0 ? (
            <li className="muted">אין תנועות צפויות עד התאריך הזה</li>
          ) : (
            expected.map((item) => {
              const body = (
                <>
                  <span className="what">
                    <span className="desc">{item.label}</span>
                    <span className="cat">
                      {[item.note, formatDate(item.date)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={`num ${item.amount < 0 ? 'neg' : 'pos'}`}>
                    {formatMoney(item.amount)}
                  </span>
                </>
              )
              // The rent line names no job, so there is nothing to open — it
              // stays plain text rather than pretending to be a control.
              return (
                <li key={item.key} className={item.projectId ? 'tappable' : undefined}>
                  {item.projectId ? (
                    <button
                      type="button"
                      className="row-btn"
                      onClick={() => go('projects', item.projectId)}
                    >
                      {body}
                    </button>
                  ) : (
                    body
                  )}
                </li>
              )
            })
          )}
        </ul>
      </section>

      <section>
        <div className="section-title">
          <h2>תנועות אחרונות</h2>
        </div>
        {recent.length === 0 ? (
          <p className="muted">אין תנועות עדיין</p>
        ) : (
          <ShortList items={recent} rows={4} onAll={() => go('ledger')} allLabel="לכל התנועות">
            {(tx) => (
              <li key={tx.id}>
                <button type="button" className="row-btn" onClick={() => go('ledger')}>
                  <span className="what">
                    <span className="desc">{tx.description}</span>
                    <span className="cat">
                      {[tx.category, formatDate(tx.date)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className={`num ${tx.amount < 0 ? 'neg' : 'pos'}`}>
                    {formatMoney(tx.amount)}
                  </span>
                </button>
              </li>
            )}
          </ShortList>
        )}
      </section>
    </>
  )
}
