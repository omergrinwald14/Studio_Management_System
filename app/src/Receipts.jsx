import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { receiptUrls } from './lib/receipts'
import { formatMoney, formatMonth, formatDay } from './lib/format'
import { groupByMonth } from './lib/txs'

// Every receipt in one place, by month. A receipt belongs to a transaction and
// is attached from the ledger; this screen is for finding one again, or going
// through a month's worth with the accountant, without opening rows one by one.
export default function Receipts() {
  const [txs, setTxs] = useState([])
  const [urls, setUrls] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('txs')
      .select('id, date, description, amount, receipt_path')
      .not('receipt_path', 'is', null)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .then(async ({ data, error }) => {
        if (error) setError(error.message)
        else {
          setTxs(data)
          // one request for every tile; the links last an hour, which is
          // longer than anyone keeps this screen open
          const { urls, error: urlError } = await receiptUrls(data.map((tx) => tx.receipt_path))
          if (urlError) setError(urlError)
          else setUrls(urls)
        }
        setLoading(false)
      })
  }, [])

  if (loading) return <p>טוען קבלות…</p>

  return (
    <>
      {error && <p className="error">{error}</p>}

      {txs.length === 0 ? (
        <p className="muted">אין קבלות עדיין. מצלמים קבלה מתוך תנועה, במסך התנועות.</p>
      ) : (
        groupByMonth(txs).map(([month, rows]) => (
          <section className="month" key={month}>
            <header>
              <h2>{formatMonth(month)}</h2>
              <span className="muted small">
                {rows.length === 1 ? 'קבלה אחת' : `${rows.length} קבלות`}
              </span>
            </header>
            <div className="gallery">
              {rows.map((tx) => (
                <ReceiptTile key={tx.id} tx={tx} url={urls[tx.receipt_path]} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}

function ReceiptTile({ tx, url }) {
  // a supplier's PDF has no picture to shrink into a tile, so it gets a label
  const pdf = tx.receipt_path.toLowerCase().endsWith('.pdf')
  const caption = (
    <span className="receipt-caption">
      <span className="receipt-desc">{tx.description}</span>
      <span className="muted">
        {formatDay(tx.date)} · <span className="num">{formatMoney(tx.amount)}</span>
      </span>
    </span>
  )

  // the link could not be signed: still show which transaction it belongs to
  if (!url) {
    return (
      <div className="receipt-tile">
        <span className="shot-missing" />
        {caption}
      </div>
    )
  }

  return (
    <a className="receipt-tile" href={url} target="_blank" rel="noreferrer">
      {pdf ? <span className="receipt-pdf">PDF</span> : <img src={url} alt="" loading="lazy" />}
      {caption}
    </a>
  )
}
