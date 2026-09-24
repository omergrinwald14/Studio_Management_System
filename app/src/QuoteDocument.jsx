import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney, formatDate } from './lib/format'
import { componentPrice } from './lib/finance'

// The quote as the client sees it — the only screen in the system written for
// someone other than him.
//
// It itemises everything: the wood, the consumables, the labour and the
// workshop's running costs, each with its own discount spelled out. An earlier
// version folded the overhead into labour and hid the consumables, on the
// argument that a client should not be handed the shop's cost structure. He
// overruled it: he would rather the client see exactly what he is paying for,
// and a discount is worth nothing if the client cannot see it was given.
export default function QuoteDocument({ quote, project, client, settings, onBack }) {
  const [items, setItems] = useState([])
  const [extras, setExtras] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('quote_items')
        .select('id, name, qty, unit_cost')
        .eq('quote_id', quote.id)
        .order('id'),
      supabase.from('quote_extras').select('id, name, amount').eq('quote_id', quote.id).order('id'),
    ]).then(([itemsResult, extrasResult]) => {
      const failure = itemsResult.error || extrasResult.error
      if (failure) setError(failure.message)
      else {
        setItems(itemsResult.data)
        setExtras(extrasResult.data)
      }
      setLoading(false)
    })
  }, [quote.id])

  if (loading) return <p>טוען…</p>
  if (error) return <p className="error">{error}</p>

  const markup = quote.markup
  const labourCost =
    Number(quote.hours) > 0
      ? Number(quote.hours) * Number(quote.hourly_rate)
      : Number(quote.planned_days) * Number(quote.day_rate)

  // One row per thing he actually bought or spent, each priced and discounted
  // on its own so the client can see where a concession was made.
  const lines = [
    ...items.map((item) => ({
      key: `item${item.id}`,
      label: item.name === 'מתכלים' ? 'חומרים מתכלים' : item.name,
      // the client is buying a finished piece, not wood by volume — the
      // quantity stays in the builder for his own costing, and only the price
      // comes through here
      detail: item.name === 'מתכלים' ? 'שיוף, דבקים, גימור וכלי עבודה מתכלים' : null,
      cost: Number(item.qty) * Number(item.unit_cost),
      discountPercent: quote.materials_discount,
    })),
    {
      key: 'labour',
      label: 'עבודה',
      detail:
        Number(quote.hours) > 0
          ? `${quote.hours} שעות עבודה`
          : `${quote.planned_days} ימי עבודה בסדנה`,
      cost: labourCost,
      discountPercent: quote.labour_discount,
    },
    {
      key: 'overhead',
      label: 'תפעול הנגריה',
      detail: `עלות תפעול ${quote.planned_days} ימי עבודה`,
      cost: Number(quote.planned_days) * Number(quote.overhead_day),
      discountPercent: quote.overhead_discount,
    },
  ]
    .map((line) => {
      const before = componentPrice(line.cost, markup, 0)
      const after = componentPrice(line.cost, markup, line.discountPercent)
      return { ...line, before, after, discount: before - after }
    })
    // extras (הובלה, התקנה) are charged at the figure he typed: no markup, no
    // discount, so what he wrote is what the client reads
    .concat(
      extras.map((extra) => ({
        key: `extra${extra.id}`,
        label: extra.name,
        detail: null,
        before: Number(extra.amount),
        after: Number(extra.amount),
        discount: 0,
      })),
    )
    .filter((line) => line.before > 0)

  const beforeDiscount = lines.reduce((total, line) => total + line.before, 0)
  const afterDiscount = lines.reduce((total, line) => total + line.after, 0)
  const discounted = lines.filter((line) => line.discount > 0)
  // He can type a final price over the computed one, so the lines will not
  // always add up to it. Showing the gap as its own line keeps the arithmetic
  // honest instead of quietly presenting numbers that do not sum.
  const adjustment = Number(quote.price) - afterDiscount

  const deposit = Math.round((Number(quote.price) * Number(quote.deposit_percent || 0)) / 100)

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
              {[
                settings.business_phone,
                settings.business_email,
                settings.business_id && `עוסק ${settings.business_id}`,
              ]
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
              <tr key={line.key}>
                <td>
                  <span className="doc-line">{line.label}</span>
                  {line.detail && <span className="doc-detail">{line.detail}</span>}
                </td>
                <td className="num">{formatMoney(line.before)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {discounted.length > 0 && (
              <tr>
                <td>סה"כ לפני הנחה</td>
                <td className="num">{formatMoney(beforeDiscount)}</td>
              </tr>
            )}
            {/* every concession named, so the client can see what was given */}
            {discounted.map((line) => (
              <tr key={`d${line.key}`} className="doc-discount">
                <td>
                  הנחה על {line.label} ({line.discountPercent}%)
                </td>
                <td className="num">{formatMoney(-line.discount)}</td>
              </tr>
            ))}
            {adjustment !== 0 && (
              <tr>
                <td>עיגול</td>
                <td className="num">{formatMoney(adjustment)}</td>
              </tr>
            )}
            <tr className="doc-total">
              <td>סה"כ לתשלום</td>
              <td className="num">{formatMoney(quote.price)}</td>
            </tr>
            {deposit > 0 && (
              <>
                <tr>
                  <td>מקדמה לתשלום עם אישור ההצעה ({quote.deposit_percent}%)</td>
                  <td className="num">{formatMoney(deposit)}</td>
                </tr>
                <tr>
                  <td>היתרה בעת המסירה</td>
                  <td className="num">{formatMoney(Number(quote.price) - deposit)}</td>
                </tr>
              </>
            )}
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
      </article>
    </>
  )
}
