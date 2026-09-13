import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatDate, todayISO, startOfWeek, startOfMonth } from './lib/format'

// How much he has worked and how much capacity is left — a business measure,
// with no project attached. Weekly and monthly are both date ranges over the
// same rows, which is the whole reason the log stores dates instead of a count.
export default function WorkshopDays({ daysPerMonth }) {
  const [days, setDays] = useState([])
  const [open, setOpen] = useState(false) // the log-a-day form
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('1')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const monthStart = startOfMonth()
  const weekStart = startOfWeek()

  useEffect(() => {
    // Only this month is needed on the dashboard; the week is a subset of it.
    supabase
      .from('workshop_days')
      .select('date, days')
      .gte('date', monthStart)
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setDays(data)
        setLoading(false)
      })
  }, [monthStart])

  if (loading) return null

  const monthUsed = sum(days)
  const weekUsed = sum(days.filter((row) => row.date >= weekStart))
  const monthCap = Number(daysPerMonth) || 0
  // His own framing is "8 a month / 2 a week", so a week is a quarter of the
  // month rather than an exact 4.33 — the round number is the one he plans with.
  const weekCap = monthCap ? Math.round(monthCap / 4) : 0

  // A date he already logged gets overwritten rather than duplicated — the
  // primary key is the date itself, so upsert is the natural fit here.
  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { data, error } = await supabase
      .from('workshop_days')
      .upsert({ date, days: Number(amount) || 1 }, { onConflict: 'date' })
      .select('date, days')
      .single()

    if (error) setError(error.message)
    else {
      setDays([data, ...days.filter((row) => row.date !== data.date)].sort((a, b) => b.date.localeCompare(a.date)))
      setOpen(false)
      setDate(todayISO())
      setAmount('1')
    }
    setBusy(false)
  }

  async function handleDelete(rowDate) {
    setBusy(true)
    const { error } = await supabase.from('workshop_days').delete().eq('date', rowDate)
    if (error) setError(error.message)
    else setDays(days.filter((row) => row.date !== rowDate))
    setBusy(false)
  }

  return (
    <section>
      <div className="section-title">
        <h2>ימי סדנה</h2>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="tiles">
        <Tile label="השבוע" used={weekUsed} cap={weekCap} />
        <Tile label="החודש" used={monthUsed} cap={monthCap} />
      </div>

      {open ? (
        <form className="add" onSubmit={handleSubmit}>
          <div className="row">
            <label>
              תאריך
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              ימים
              <input
                type="number"
                inputMode="decimal"
                min="0.5"
                max="2"
                step="0.5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="row">
            <button type="submit" disabled={busy}>
              {busy ? 'שומר…' : 'רישום'}
            </button>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>
              ביטול
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="add-toggle" onClick={() => setOpen(true)}>
          + רישום יום סדנה
        </button>
      )}

      {days.length > 0 && (
        <ul className="rows">
          {days.map((row) => (
            <li key={row.date}>
              <span className="what">
                <span className="desc">{formatDate(row.date)}</span>
                <span className="cat">{row.days === 1 ? 'יום מלא' : `${row.days} ימים`}</span>
              </span>
              <button type="button" className="danger" disabled={busy} onClick={() => handleDelete(row.date)}>
                הסרה
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Tile({ label, used, cap }) {
  const share = cap > 0 ? Math.min(used / cap, 1) : 0
  const left = cap - used
  return (
    <div className="card tile">
      <p className="label">{label}</p>
      <p className="value">
        <span className="num">{used}</span>{' '}
        <span className="of">{cap ? `מתוך ${cap}` : ''}</span>
      </p>
      <div className="meter">
        <i className={left < 0 ? 'over' : ''} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="foot muted">
        {!cap ? 'לא הוגדרה קיבולת' : left > 0 ? `נותרו ${left}` : left === 0 ? 'הקיבולת נוצלה' : `חריגה של ${-left}`}
      </p>
    </div>
  )
}

function sum(rows) {
  return rows.reduce((total, row) => total + Number(row.days), 0)
}
