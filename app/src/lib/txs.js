// The columns every screen reads a transaction with. One list, because each
// screen used to spell out its own copy, and when receipt_path was added only
// the form's copy got it: the ledger and the project card loaded rows without
// it, so every receipt looked lost after a reload while the photo sat safely
// in storage.
export const TX_COLUMNS =
  'id, date, description, category, amount, capital, adjust, project_id, project_share, receipt_path'
