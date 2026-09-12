import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

// Everything he can change himself (D12). These are not constants in the code:
// the rent and the workshop-days figure feed the overhead rate that every quote
// and every profitability number is built on, so they have to be his to edit.
export default function Settings() {
  const [values, setValues] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // One row, pinned to id 1 by a check constraint — there is one studio.
    supabase
      .from('settings')
      .select('opening, opening_date, rent, days_per_month, day_rate')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setValues(data)
      })
  }, [])

  function set(field, value) {
    setValues({ ...values, [field]: value })
    setStatus('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { error } = await supabase
      .from('settings')
      .update({
        opening: Number(values.opening) || 0,
        opening_date: values.opening_date || null,
        rent: Number(values.rent) || 0,
        days_per_month: Number(values.days_per_month) || 0,
        day_rate: Number(values.day_rate) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    if (error) setError(error.message)
    else setStatus('נשמר')
    setBusy(false)
  }

  if (error && !values) return <p className="error">{error}</p>
  if (!values) return <p>טוען הגדרות…</p>

  // The rent spread over the days he actually works is what a workshop day
  // costs before he has touched a single board — the number behind every quote.
  const overheadDay = values.days_per_month > 0 ? values.rent / values.days_per_month : 0

  return (
    <form className="add" onSubmit={handleSubmit}>
      <div className="row">
        <label>
          יתרת פתיחה בעו"ש
          <input
            type="number"
            inputMode="decimal"
            value={values.opening ?? ''}
            onChange={(e) => set('opening', e.target.value)}
          />
        </label>
        <label>
          נכון לתאריך
          <input
            type="date"
            value={values.opening_date ?? ''}
            onChange={(e) => set('opening_date', e.target.value)}
          />
        </label>
      </div>

      <div className="row">
        <label>
          שכירות חודשית
          <input
            type="number"
            inputMode="decimal"
            value={values.rent ?? ''}
            onChange={(e) => set('rent', e.target.value)}
          />
        </label>
        <label>
          ימי סדנה בחודש
          <input
            type="number"
            inputMode="decimal"
            value={values.days_per_month ?? ''}
            onChange={(e) => set('days_per_month', e.target.value)}
          />
        </label>
      </div>

      <label>
        תעריף יום עבודה
        <input
          type="number"
          inputMode="decimal"
          value={values.day_rate ?? ''}
          onChange={(e) => set('day_rate', e.target.value)}
        />
      </label>

      <p className="note">
        תקורת יום סדנה: <span className="num">{formatMoney(overheadDay)}</span>
        <span className="muted"> — שכירות חלקי ימי סדנה</span>
      </p>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? 'שומר…' : 'שמירה'}
        </button>
        {status && <span className="saved">{status}</span>}
      </div>
    </form>
  )
}
