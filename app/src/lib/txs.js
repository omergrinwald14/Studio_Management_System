// The columns every screen reads a transaction with. One list, because each
// screen used to spell out its own copy, and when receipt_path was added only
// the form's copy got it: the ledger and the project card loaded rows without
// it, so every receipt looked lost after a reload while the photo sat safely
// in storage.
export const TX_COLUMNS =
  'id, date, description, category, amount, capital, adjust, project_id, project_share, receipt_path'

// [['2026-09', [...]], ['2026-08', [...]]] — already in date order, since the
// rows arrive sorted and a Map keeps insertion order.
export function groupByMonth(rows) {
  const months = new Map()
  for (const tx of rows) {
    const key = tx.date.slice(0, 7)
    if (!months.has(key)) months.set(key, [])
    months.get(key).push(tx)
  }
  return [...months]
}
