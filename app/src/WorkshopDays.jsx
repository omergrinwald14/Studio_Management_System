import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO, startOfWeek, startOfMonth } from './lib/format'

// How much he has worked and how much capacity is left — a business measure,
// with no project attached. Weekly and monthly are both date ranges over the
// same rows, which is the whole reason the log stores dates instead of a count.
export default function WorkshopDays({ daysPerMonth }) {
  const [days, setDays] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const today = todayISO()
  const monthStart = startOfMonth()
  const weekStart = startOfWeek()

  useEffect(() => {
    // Only this month is needed on the dashboard; the week is a subset of it.
    supabase
      .from('workshop_days')
      .select('date, days')
      .gte('date', monthStart)
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

  const loggedToday = days.some((row) => row.date === today)

  async function toggleToday() {
    setBusy(true)
    setError('')
    if (loggedToday) {
      const { error } = await supabase.from('workshop_days').delete().eq('date', today)
      if (error) setError(error.message)
      else setDays(days.filter((row) => row.date !== today))
    } else {
      const { data, error } = await supabase
        .from('workshop_days')
        .insert({ date: today, days: 1 })
        .select('date, days')
        .single()
      if (error) setError(error.message)
      else setDays([...days, data])
    }
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

      <button type="button" className="add-toggle" onClick={toggleToday} disabled={busy}>
        {loggedToday ? '✓ היום נרשם כיום סדנה — לביטול' : '+ רשום את היום כיום סדנה'}
      </button>
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
