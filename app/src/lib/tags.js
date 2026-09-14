/**
 * "מחסן עצים, גימור , מחסן עצים" -> ['מחסן עצים', 'גימור']
 *
 * Typed as one comma-separated string rather than as chips, because he is
 * writing this on a phone with one hand: trimming and de-duplicating here is
 * cheaper than making him tap a tag widget in the workshop.
 */
export function parseTags(input) {
  return [...new Set(input.split(',').map((tag) => tag.trim()).filter(Boolean))]
}
