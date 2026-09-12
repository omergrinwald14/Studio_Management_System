// Shared formatting. One place, so a shekel never looks different on two screens.

const money = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
})

export function formatMoney(amount) {
  return money.format(amount)
}

const monthName = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' })

// '2026-09-12' -> 'ספטמבר 2026'. Built from the parts rather than new Date(string),
// which reads a bare date as UTC and can slip a day backwards in our timezone.
export function formatMonth(key) {
  const [year, month] = key.split('-').map(Number)
  return monthName.format(new Date(year, month - 1, 1))
}

// '2026-09-12' -> '12.9'
export function formatDay(date) {
  const [, month, day] = date.split('-').map(Number)
  return `${day}.${month}`
}

export function todayISO() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// '2026-09-12' -> '12/09/2026', the way he writes a date
export function formatDate(iso) {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

// The 1st of every month strictly after `from` and up to `until`, as ISO dates.
// Used to place a recurring cost like rent on the forecast timeline.
export function monthStartsBetween(from, until) {
  const dates = []
  const [year, month] = from.split('-').map(Number)
  let cursor = new Date(year, month - 1, 1)
  cursor.setMonth(cursor.getMonth() + 1)
  while (true) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`
    if (iso > until) break
    if (iso > from) dates.push(iso)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return dates
}

// Last day of the current month, the default horizon for the forecast.
export function endOfMonth() {
  const now = new Date()
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`
}

// The Sunday that opens the current week — the Israeli week starts on Sunday,
// which is also how he counts his own workshop days.
export function startOfWeek() {
  const now = new Date()
  now.setDate(now.getDate() - now.getDay())
  return isoOf(now)
}

export function startOfMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function isoOf(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
