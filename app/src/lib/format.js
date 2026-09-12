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
