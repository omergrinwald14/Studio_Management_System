// The 9-stage pipeline from his spec, in order. A project stores an index into
// this array rather than the label, so progress is a number the system can
// compare and chart — and renaming a stage never has to touch the data.
export const STAGES = [
  'ליד חדש',
  'פגישה / מדידה',
  'הצעת מחיר',
  'מקדמה וסקיצה',
  'רכש חומרים',
  'ייצור בסדנה',
  'גימור',
  'אספקה / התקנה',
  'הושלם',
]

export const DONE = STAGES.length - 1

// Named so the quote flow reads as intent rather than as magic numbers: a saved
// quote parks its project here, and accepting it moves the project on by one.
export const QUOTE_STAGE = STAGES.indexOf('הצעת מחיר')
export const DEPOSIT_STAGE = STAGES.indexOf('מקדמה וסקיצה')
