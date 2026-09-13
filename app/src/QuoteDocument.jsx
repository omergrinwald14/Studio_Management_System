import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney, formatDate } from './lib/format'
import { componentPrice } from './lib/finance'

// The quote as the client sees it — the only screen in the system written for
// someone other than him. Everything internal stays out: no cost, no markup, no
// overhead line. A customer-facing quote that shows "workshop rent: 900₪"
// invites an argument about a number that is none of their business.
//
// Saved as a PDF through the browser's own Print dialog rather than a PDF
// library: it works on his phone, adds nothing to the bundle, and what he sees
// on screen is exactly what comes out.
export default function QuoteDocument({ quote, project, client, settings, onBack }) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('quote_items')
      .select('name, qty, unit_cost')
      .eq('quote_id', quote.id)
      .order('id')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setItems(data)
        setLoading(false)
      })
  }, [quote.id])

  if (loading) return <p>טוען…</p>
  if (error) return <p className="error">{error}</p>

  const materialsCost = items.reduce(
    (total, item) => total + Number(item.qty || 0) * Number(item.unit_cost || 0),
    0,
  )
  const labourCost =
    Number(quote.hours) > 0
      ? Number(quote.hours) * Number(quote.hourly_rate)
      : Number(quote.planned_days) * Number(quote.day_rate)
  const overheadCost = Number(quote.planned_days) * Number(quote.overhead_day)

  // Overhead is folded into the labour line here. It is a real cost and it is
  // in the price either way, but to a client "the work" is one thing.
  const lines = [
    {
      label: 'חומרים',
      detail: items
        .filter((item) => item.name !== 'מתכלים')
        .map((item) => `${item.name} · ${item.qty} קו"ב`)
        .join(' · '),
      before: componentPrice(materialsCost, quote.markup, 0),
      after: componentPrice(materialsCost, quote.markup, quote.materials_discount),
    },
    {
      label: 'עבודה',
      detail:
        Number(quote.hours) > 0
          ? `${quote.hours} שעות עבודה`
          : `${quote.planned_days} ימי עבודה בסדנה`,
      before:
        componentPrice(labourCost, quote.markup, 0) + componentPrice(overheadCost, quote.markup, 0),
      after:
        componentPrice(labourCost, quote.markup, quote.labour_discount) +
        componentPrice(overheadCost, quote.markup, quote.overhead_discount),
    },
  ].filter((line) => line.before > 0)

  const beforeDiscount = lines.reduce((total, line) => total + line.before, 0)
  const afterDiscount = lines.reduce((total, line) => total + line.after, 0)
  const discount = beforeDiscount - afterDiscount
  // He can type a final price over the computed one, so the lines will not
  // always add up to it. Showing the gap as its own line keeps the arithmetic
  // honest instead of quietly presenting numbers that do not sum.
  const adjustment = Number(quote.price) - afterDiscount

  return (
    <>
      <div className="no-print">
        <button type="button" className="back" onClick={onBack}>
          → חזרה להצעות
        </button>
        <div className="row" style={{ margin: '12px 0 20px' }}>
          <button type="button" onClick={() => window.print()}>
            הדפסה / שמירה כ-PDF
          </button>
        </div>
        {!settings.business_name && (
          <p className="warn small">
            לא הוגדרו פרטי העסק — מלא אותם במסך ההגדרות כדי שיופיעו במסמך.
          </p>
        )}
      </div>

      <article className="doc">
        <header className="doc-head">
          <div>
            <h1>{settings.business_name || 'סטודיו לנגרות'}</h1>
            <p className="doc-contact">
              {[settings.business_phone, settings.business_email, settings.business_id && `עוסק ${settings.business_id}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="doc-title">
            <p className="doc-kind">הצעת מחיר</p>
            <p className="doc-date">{formatDate(quote.sent || project.opened)}</p>
          </div>
        </header>

        <section className="doc-to">
          <p>
            <span className="doc-label">לכבוד</span> {client ? client.name : ''}
          </p>
          {client && client.phone && (
            <p>
              <span className="doc-label">טלפון</span> <span dir="ltr">{client.phone}</span>
            </p>
          )}
          {client && client.address && (
            <p>
              <span className="doc-label">כתובת</span> {client.address}
            </p>
          )}
          <p>
            <span className="doc-label">פרויקט</span> {project.name}
          </p>
        </section>

        <table className="doc-table">
          <thead>
            <tr>
              <th>פירוט</th>
              <th>סכום</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.label}>
                <td>
                  <span className="doc-line">{line.label}</span>
                  {line.detail && <span className="doc-detail">{line.detail}</span>}
                </td>
                <td className="num">{formatMoney(line.before)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {discount > 0 && (
              <>
                <tr>
                  <td>סה"כ</td>
                  <td className="num">{formatMoney(beforeDiscount)}</td>
                </tr>
                <tr>
                  <td>הנחה</td>
                  <td className="num">{formatMoney(-discount)}</td>
                </tr>
              </>
            )}
            {adjustment !== 0 && (
              <tr>
                <td>התאמת מחיר</td>
                <td className="num">{formatMoney(adjustment)}</td>
              </tr>
            )}
            <tr className="doc-total">
              <td>סה"כ לתשלום</td>
              <td className="num">{formatMoney(quote.price)}</td>
            </tr>
          </tfoot>
        </table>

        <section className="doc-terms">
          {project.due && (
            <p>
              <span className="doc-label">תאריך אספקה משוער</span> {formatDate(project.due)}
            </p>
          )}
          {quote.decision_due && (
            <p>
              <span className="doc-label">ההצעה בתוקף עד</span> {formatDate(quote.decision_due)}
            </p>
          )}
          {settings.quote_terms && <p className="doc-note">{settings.quote_terms}</p>}
        </section>

        <section className="doc-sign">
          <p>חתימת הלקוח: ______________________</p>
          <p>תאריך: ______________</p>
        </section>
      </article>
    </>
  )
}
