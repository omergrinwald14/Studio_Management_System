import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { useAppVersion } from './lib/version'

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
      .select('opening, opening_date, rent, rent_day, days_per_month, day_rate, hourly_rate, business_name, business_phone, business_email, business_id, quote_terms')
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
        rent_day: Number(values.rent_day) || 1,
        days_per_month: Number(values.days_per_month) || 0,
        day_rate: Number(values.day_rate) || 0,
        hourly_rate: Number(values.hourly_rate) || 0,
        business_name: values.business_name?.trim() || null,
        business_phone: values.business_phone?.trim() || null,
        business_email: values.business_email?.trim() || null,
        business_id: values.business_id?.trim() || null,
        quote_terms: values.quote_terms?.trim() || null,
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
          יום חיוב בחודש
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="28"
            value={values.rent_day ?? ''}
            onChange={(e) => set('rent_day', e.target.value)}
          />
        </label>
      </div>

      <label>
        ימי סדנה בחודש
        <input
          type="number"
          inputMode="decimal"
          value={values.days_per_month ?? ''}
          onChange={(e) => set('days_per_month', e.target.value)}
        />
      </label>

      <div className="row">
        <label>
          תעריף יום עבודה
          <input
            type="number"
            inputMode="decimal"
            value={values.day_rate ?? ''}
            onChange={(e) => set('day_rate', e.target.value)}
          />
        </label>
        <label>
          תעריף עובד לשעה
          <input
            type="number"
            inputMode="decimal"
            value={values.hourly_rate ?? ''}
            onChange={(e) => set('hourly_rate', e.target.value)}
          />
        </label>
      </div>

      <p className="note">
        תקורת יום סדנה: <span className="num">{formatMoney(overheadDay)}</span>
        <span className="muted"> — שכירות חלקי ימי סדנה</span>
      </p>

      {/* Only these leave the building — they head every quote he sends out. */}
      <div className="items">
        <p className="menu-label">פרטי העסק — מופיעים בהצעות ללקוח</p>
        <label>
          שם העסק
          <input
            value={values.business_name ?? ''}
            onChange={(e) => set('business_name', e.target.value)}
          />
        </label>
        <div className="row">
          <label>
            טלפון
            <input
              type="tel"
              value={values.business_phone ?? ''}
              onChange={(e) => set('business_phone', e.target.value)}
            />
          </label>
          <label>
            מספר עוסק
            <input
              value={values.business_id ?? ''}
              onChange={(e) => set('business_id', e.target.value)}
            />
          </label>
        </div>
        <label>
          אימייל
          <input
            type="email"
            value={values.business_email ?? ''}
            onChange={(e) => set('business_email', e.target.value)}
          />
        </label>
        <label>
          תנאים קבועים בתחתית ההצעה
          <textarea
            rows="3"
            value={values.quote_terms ?? ''}
            onChange={(e) => set('quote_terms', e.target.value)}
            placeholder="תנאי תשלום, תוקף ההצעה, הערות"
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? 'שומר…' : 'שמירה'}
        </button>
        {status && <span className="saved">{status}</span>}
      </div>

      <Version />
    </form>
  )
}

// Tucked at the foot of settings rather than raised as a banner, at his
// request. The check still runs on its own in the background — this is only
// where the answer is reported and acted on.
function Version() {
  const { stale, checking, reload } = useAppVersion()

  return (
    <p className="version">
      {stale ? (
        <>
          <span>יצאה גרסה חדשה</span>
          <button type="button" className="link" onClick={reload}>
            רענון
          </button>
        </>
      ) : (
        <span className="muted">{checking ? 'בודק עדכונים…' : 'הגרסה מעודכנת'}</span>
      )}
    </p>
  )
}
