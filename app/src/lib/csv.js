// Turning rows into a file, and handing that file to the browser. No imports on
// purpose: this is the part of a backup that has to be provably correct, and a
// module that reaches for the database cannot be tested without one.

/**
 * One CSV from a list of rows.
 *
 * Columns are collected across every row rather than taken from the first,
 * since a row that happened to have a null column would otherwise silently
 * decide the shape of the whole file.
 */
export function toCsv(rows) {
  if (!rows.length) return ''
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]

  // A description like `מחסן עצים, אגוז` would otherwise split into two columns
  // and shift every later value — the classic way a CSV export quietly lies.
  const escape = (value) => {
    if (value == null) return ''
    const text = String(value)
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }

  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(',')),
  ].join('\r\n')
}

/**
 * Hand the browser a file to save.
 *
 * The BOM is not decoration: without it Excel reads a UTF-8 CSV as the local
 * codepage and every Hebrew column comes out as mojibake, which is exactly the
 * moment a backup stops being trusted.
 */
export function download(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([type.startsWith('text/csv') ? '\ufeff' + text : text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** `2026-09-14` — what a file saved today should be called. */
export function stamp() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
