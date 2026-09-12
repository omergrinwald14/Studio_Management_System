// Seed categories, taken from the spreadsheet he keeps today (שכירות, חומר גלם,
// מתכלים) and the expense types his spec lists. They are suggestions, not a
// closed set: the field accepts anything typed, and whatever he uses joins the
// list on its own, since the options are seeds plus what the ledger already holds.
export const EXPENSE_CATEGORIES = [
  'חומר גלם',
  'מתכלים',
  'פרזול',
  'גימור',
  'שכירות',
  'הובלות',
  'כלים וציוד',
  'ביטוח',
  'שיווק',
  'אחזקה',
]

export const INCOME_CATEGORIES = [
  'תשלום מלקוח',
  'מקדמה',
  'יתרת תשלום',
  'הון עצמי',
]

// Merge the seeds with everything already used, drop blanks and duplicates.
export function suggestFrom(seeds, used) {
  return [...new Set([...seeds, ...used.filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'he'))
}
