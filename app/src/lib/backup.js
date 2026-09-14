import { supabase } from './supabase'

// Every table worth keeping. `ping` is excluded — it holds a heartbeat and
// nothing else — and so is anything Supabase manages itself, like the auth user.
export const TABLES = [
  'settings',
  'clients',
  'projects',
  'txs',
  'quotes',
  'quote_items',
  'materials',
  'suppliers',
  'stock',
  'workshop_days',
]

/** Fetch every table, or return the first error. */
export async function fetchEverything() {
  const results = await Promise.all(
    TABLES.map((table) =>
      // workshop_days is keyed by its date rather than an id, so ordering by id
      // would fail on that one table and take the whole backup with it
      supabase.from(table).select('*').order(table === 'workshop_days' ? 'date' : 'id'),
    ),
  )
  const failed = results.findIndex((result) => result.error)
  if (failed !== -1) return { error: `${TABLES[failed]}: ${results[failed].error.message}` }

  const data = {}
  TABLES.forEach((table, index) => {
    data[table] = results[index].data
  })
  return { data }
}
