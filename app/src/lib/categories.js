// The category lists from the approved mockup, which in turn came from the
// spreadsheet he keeps today (שכירות, חומר גלם, מתכלים) and his spec. They are
// suggestions, not a closed set: the field accepts anything typed, and whatever
// he uses joins the list on its own, since the options are seeds plus what the
// ledger already holds.
export const EXPENSE_CATEGORIES = [
  'חומר גלם',
  'מתכלים',
  'פרזול',
  'גימורים',
  'הובלה',
  'שכירות',
  'ציוד',
  'אחר',
]

export const INCOME_CATEGORIES = [
  'מקדמה',
  'תשלום ביניים',
  'תשלום סופי',
  'תשלום לקוח',
  'הון עצמי',
  'אחר',
]

// Merge the seeds with everything already used, drop blanks and duplicates.
export function suggestFrom(seeds, used) {
  return [...new Set([...seeds, ...used.filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'he'))
}
