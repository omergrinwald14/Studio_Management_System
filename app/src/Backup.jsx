import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { TABLES, fetchEverything } from './lib/backup'
import { toCsv, download, stamp } from './lib/csv'
import { formatDate } from './lib/format'

const TABLE_NAMES = {
  txs: 'תנועות כספיות',
  projects: 'פרויקטים',
  clients: 'לקוחות',
  quotes: 'הצעות מחיר',
  quote_items: 'שורות בהצעות',
  quote_extras: 'תוספות בהצעות',
  materials: 'חומרים',
  suppliers: 'ספקים',
  stock: 'שאריות בסדנה',
  workshop_days: 'ימי סדנה',
  lessons: 'לקחים',
  media: 'גלריה',
  settings: 'הגדרות',
}

// The free Supabase tier takes no automatic backups at all — not nightly, not
// ever (D4). That was accepted knowingly while the database was empty; it stops
// being acceptable once it holds the only record of a year's income. A bad
// delete, or a bad day at Supabase, and there is nothing to go back to.
//
// So: one button that pulls every table into a file he keeps himself. Two
// formats, because they answer different questions — JSON is the one that could
// actually be put back, CSV is the one his accountant can open.
export default function Backup() {
  const [lastBackup, setLastBackup] = useState(null)
  const [table, setTable] = useState('txs') // the ledger is what the accountant asks for
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    supabase
      .from('settings')
      .select('last_backup')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setLastBackup(data.last_backup)
      })
  }, [])

  async function record() {
    // stored in settings rather than locally, so the reminder follows him from
    // the phone to the laptop instead of nagging on whichever he used last
    const today = stamp()
    await supabase.from('settings').update({ last_backup: today }).eq('id', 1)
    setLastBackup(today)
  }

  async function saveJson() {
    setBusy('json')
    setError('')
    setDone('')
    const { data, error } = await fetchEverything()
    if (error) setError(error)
    else {
      download(
        `studio-backup-${stamp()}.json`,
        JSON.stringify({ exported_at: new Date().toISOString(), data }, null, 2),
        'application/json',
      )
      await record()
      setDone('הגיבוי ירד למכשיר. שמור אותו במקום שאינו המחשב הזה בלבד.')
    }
    setBusy('')
  }

  // One table at a time, chosen from the list: browsers block a burst of
  // automatic downloads, and the tables have nothing in common column-wise, so
  // a single combined sheet would be unreadable anyway.
  async function saveCsv() {
    setBusy('csv')
    setError('')
    setDone('')
    const { data, error } = await supabase.from(table).select('*')
    if (error) setError(error.message)
    else {
      const csv = toCsv(data)
      if (!csv) setDone('אין נתונים בטבלה הזו.')
      else {
        download(`${table}-${stamp()}.csv`, csv)
        setDone('הקובץ ירד למכשיר.')
      }
    }
    setBusy('')
  }

  const daysSince = lastBackup ? daysBetween(lastBackup, stamp()) : null

  return (
    <>
      <section className="card">
        <div className="section-title">
          <h2>מתי גיבית לאחרונה</h2>
        </div>
        {lastBackup ? (
          <p className="stage-now">
            {formatDate(lastBackup)}
            <span className="muted small">
              {daysSince === 0 ? ' · היום' : ` · לפני ${daysSince} ימים`}
            </span>
          </p>
        ) : (
          <p className="warn">עוד לא גיבית אף פעם.</p>
        )}
        <p className="muted small">
          במסלול החינמי של Supabase אין גיבוי אוטומטי כלל. הקובץ שאתה מוריד כאן הוא העותק
          היחיד שקיים מחוץ למסד — שמור אותו בענן או בכונן נפרד, לא רק במחשב הזה.
        </p>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>גיבוי מלא</h2>
        </div>
        <p className="muted small">
          קובץ אחד עם כל הטבלאות. זה הקובץ שממנו אפשר לשחזר את המערכת אם משהו נמחק.
        </p>
        <div className="row stepper">
          <button type="button" onClick={saveJson} disabled={Boolean(busy)}>
            {busy === 'json' ? 'מוריד…' : 'הורדת גיבוי מלא'}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>ייצוא לאקסל</h2>
        </div>
        <p className="muted small">
          טבלה אחת בכל פעם, בפורמט שנפתח באקסל — לרואה החשבון ולדוחות המס.
        </p>
        <label>
          מה לייצא
          <select value={table} onChange={(e) => setTable(e.target.value)}>
            {TABLES.map((name) => (
              <option key={name} value={name}>
                {TABLE_NAMES[name] || name}
              </option>
            ))}
          </select>
        </label>
        <div className="row stepper">
          <button type="button" className="ghost" onClick={saveCsv} disabled={Boolean(busy)}>
            {busy === 'csv' ? 'מוריד…' : 'הורדת קובץ אקסל'}
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {done && <p className="note">{done}</p>}
    </>
  )
}

function daysBetween(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000)
}
