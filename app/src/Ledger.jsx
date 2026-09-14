import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney, formatMonth, formatDay, formatDate, todayISO } from './lib/format'
import { cashFlowBreakdown, sum, missingRentDates } from './lib/finance'
import { useCached, isCached } from './lib/cache'
import TxForm from './TxForm'

// The ledger: every transaction newest first, grouped by month with a subtotal —
// the shape he already reads in his spreadsheet.
export default function Ledger() {
  const [txs, setTxs] = useCached('ledger:txs', [])
  const [projects, setProjects] = useCached('ledger:projects', [])
  const [settings, setSettings] = useCached('ledger:settings', null)
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState(null) // null = nothing open, 'new' = the add form
  const [error, setError] = useState('')
  const [bookingRent, setBookingRent] = useState(false)
  const [loading, setLoading] = useState(!isCached('ledger:settings'))

  useEffect(() => {
    // Fetched together rather than one after the other: the screen is not usable
    // until both arrive, so there is nothing to gain by serialising them.
    Promise.all([
      supabase
        .from('txs')
        .select('id, date, description, category, amount, capital, adjust, project_id, project_share')
        .order('date', { ascending: false })
        .order('id', { ascending: false }), // tie-break, so same-day rows keep a stable order
      supabase.from('projects').select('id, name').order('id', { ascending: false }),
      supabase.from('settings').select('opening, opening_date, rent, rent_day').eq('id', 1).single(),
    ]).then(([txsResult, projectsResult, settingsResult]) => {
      const failure = txsResult.error || projectsResult.error || settingsResult.error
      if (failure) setError(failure.message)
      else {
        setTxs(txsResult.data)
        setProjects(projectsResult.data)
        setSettings(settingsResult.data)
      }
      setLoading(false)
    })
  }, [setTxs, setProjects, setSettings])

  // This component owns the list, so every change lands here — one place that
  // decides what the ledger holds, instead of each form keeping its own copy.
  function handleSaved(saved) {
    const without = txs.filter((tx) => tx.id !== saved.id)
    setTxs([saved, ...without].sort(byNewest))
    setEditingId(null)
  }

  function handleDeleted(id) {
    setTxs(txs.filter((tx) => tx.id !== id))
    setEditingId(null)
  }

  // Everything he has ever typed becomes a suggestion in the form — the list
  // grows by use instead of being a hand-maintained constant.
  const descriptions = [...new Set(txs.map((tx) => tx.description))].sort((a, b) =>
    a.localeCompare(b, 'he'),
  )
  const usedCategories = [...new Set(txs.map((tx) => tx.category))]

  // description -> the category it carried last time. txs arrive newest first,
  // so the first hit is the most recent answer and later ones must not overwrite it.
  const recall = {}
  for (const tx of txs) {
    if (tx.category && !(tx.description in recall)) recall[tx.description] = tx.category
  }

  function projectName(id) {
    const project = projects.find((p) => p.id === id)
    return project ? project.name : null
  }

  const visible = txs.filter((tx) => {
    if (filter === 'in') return tx.amount > 0 && !tx.adjust
    if (filter === 'out') return tx.amount < 0 && !tx.adjust
    return true
  })

  if (loading) return <p>טוען תנועות…</p>

  const formProps = { descriptions, categories: usedCategories, recall, projects }

  // The balance on the dashboard is one number; these are the rows it is made
  // of. They live here rather than on the dashboard because each one is a sum
  // of the ledger below — the breakdown belongs next to what produced it.
  const { received, ownCapital, spent, adjustments, balance } = cashFlowBreakdown(txs, settings)

  // Rent is the one movement the system can know about without being told: it
  // is the same amount, on the same day, every month. It is still offered
  // rather than inserted silently — a row that appears on its own in his books
  // is a row he cannot trust, and he may have paid a different amount.
  const missingRent = missingRentDates({
    txs,
    openingDate: settings.opening_date,
    rentDay: settings.rent_day,
    today: todayISO(),
  })

  async function bookRent() {
    setBookingRent(true)
    const { data, error } = await supabase
      .from('txs')
      .insert(
        missingRent.map((date) => ({
          date,
          description: 'שכירות סדנה',
          category: 'שכירות',
          amount: -Number(settings.rent),
        })),
      )
      .select('id, date, description, category, amount, capital, adjust, project_id, project_share')

    if (error) setError(error.message)
    else setTxs([...data, ...txs].sort(byNewest))
    setBookingRent(false)
  }

  return (
    <>
      {error && <p className="error">{error}</p>}

      <section className="card breakdown-card">
        <div className="section-title"><h2>תזרים מזומנים</h2></div>
        <dl className="breakdown">
          <div>
            <dt>
              יתרת פתיחה
              {settings.opening_date && ` · ${formatDate(settings.opening_date)}`}
            </dt>
            <dd className="num">{formatMoney(settings.opening)}</dd>
          </div>
          <div>
            <dt>התקבל מלקוחות</dt>
            <dd className="num">{formatMoney(received)}</dd>
          </div>
          <div>
            <dt>הון עצמי שהוזרם</dt>
            <dd className="num">{formatMoney(ownCapital)}</dd>
          </div>
          <div>
            <dt>סך ההוצאות</dt>
            <dd className="num">{formatMoney(spent)}</dd>
          </div>
          {adjustments !== 0 && (
            <div>
              <dt>התאמות לבנק</dt>
              <dd className="num">{formatMoney(adjustments)}</dd>
            </div>
          )}
        </dl>
        <div className="total">
          <span>היתרה בחשבון</span>
          <span className="num">{formatMoney(balance)}</span>
        </div>
      </section>

      {missingRent.length > 0 && Number(settings.rent) > 0 && (
        <section className="card notice">
          <p className="note">
            חסרות {missingRent.length === 1 ? 'תנועת שכירות אחת' : `${missingRent.length} תנועות שכירות`}
            {' — '}
            {missingRent.map((date) => formatDate(date)).join(', ')}
          </p>
          <button type="button" onClick={bookRent} disabled={bookingRent}>
            {bookingRent ? 'רושם…' : `רישום ${formatMoney(-settings.rent)} לכל חודש`}
          </button>
        </section>
      )}

      <div className="chips">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>הכל</Chip>
        <Chip active={filter === 'in'} onClick={() => setFilter('in')}>הכנסות</Chip>
        <Chip active={filter === 'out'} onClick={() => setFilter('out')}>הוצאות</Chip>
      </div>

      {editingId === 'new' ? (
        <TxForm
          {...formProps}
          defaultDirection={filter === 'in' ? 'in' : 'out'}
          onSaved={handleSaved}
          onCancel={() => setEditingId(null)}
        />
      ) : (
        // The filter says what he is looking at, so it is a fair guess at what
        // he is about to add — the button names it instead of staying generic.
        <button type="button" className="add-toggle" onClick={() => setEditingId('new')}>
          {filter === 'in' ? '+ הכנסה חדשה' : filter === 'out' ? '+ הוצאה חדשה' : '+ תנועה חדשה'}
        </button>
      )}

      {visible.length === 0 ? (
        <p className="muted">אין תנועות עדיין</p>
      ) : (
        groupByMonth(visible).map(([month, rows]) => (
          <section className="month" key={month}>
            <header>
              <h2>{formatMonth(month)}</h2>
              <span className="num">{formatMoney(subtotal(rows))}</span>
            </header>
            <ul>
              {rows.map((tx) =>
                editingId === tx.id ? (
                  <li className="editing" key={tx.id}>
                    <TxForm
                      {...formProps}
                      tx={tx}
                      onSaved={handleSaved}
                      onDeleted={handleDeleted}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <li key={tx.id}>
                    {/* the whole row is the control — a phone target, not a tiny pencil */}
                    <button type="button" className="row-btn" onClick={() => setEditingId(tx.id)}>
                      <span className="when">{formatDay(tx.date)}</span>
                      <span className="what">
                        <span className="desc">{tx.description}</span>
                        <span className="cat">
                          {[
                            tx.category,
                            // a partly-attributed row says so, since the figure on
                            // the right is the whole movement, not the project's part
                            tx.project_id && Number(tx.project_share) < 100
                              ? `${projectName(tx.project_id)} · ${tx.project_share}%`
                              : projectName(tx.project_id),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {tx.capital && <span className="tag">הון בעלים</span>}
                        {tx.adjust && <span className="tag">התאמה</span>}
                      </span>
                      <span className={`num ${tx.amount < 0 ? 'neg' : 'pos'}`}>
                        {formatMoney(tx.amount)}
                      </span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          </section>
        ))
      )}
    </>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`chip${active ? ' on' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

function byNewest(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  return b.id - a.id
}

// The subtotal counts real movement only: a bank reconciliation row (D14) is
// neither income nor expense, so including it would make the month lie.
function subtotal(rows) {
  return sum(rows.filter((tx) => !tx.adjust))
}

// [['2026-09', [...]], ['2026-08', [...]]] — already in date order, since the
// rows arrive sorted and a Map keeps insertion order.
function groupByMonth(rows) {
  const months = new Map()
  for (const tx of rows) {
    const key = tx.date.slice(0, 7)
    if (!months.has(key)) months.set(key, [])
    months.get(key).push(tx)
  }
  return [...months]
}
