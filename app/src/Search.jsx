import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney, formatDate } from './lib/format'

// One box over the whole system. The spec asks for it by example — "לפי שם סוג
// עץ, שם לקוח, או מילת מפתח בלקחים" — and those are three different tables, so
// searching each screen separately is exactly the work this removes.
//
// The kinds are listed in the order he is most likely to be looking: a job or a
// person first, then the money, then what he wrote down.
const KINDS = [
  {
    table: 'projects',
    label: 'פרויקטים',
    columns: 'id, name, stage, price',
    match: (term) => `name.ilike.%${term}%`,
    screen: 'projects',
    title: (row) => row.name,
    detail: (row) => (row.price != null ? formatMoney(row.price) : ''),
  },
  {
    table: 'clients',
    label: 'לקוחות',
    columns: 'id, name, phone, address',
    match: (term) => `name.ilike.%${term}%,phone.ilike.%${term}%,address.ilike.%${term}%`,
    screen: 'clients',
    title: (row) => row.name,
    detail: (row) => [row.phone, row.address].filter(Boolean).join(' · '),
  },
  {
    table: 'txs',
    label: 'תנועות',
    columns: 'id, date, description, category, amount',
    match: (term) => `description.ilike.%${term}%,category.ilike.%${term}%`,
    screen: 'ledger',
    title: (row) => row.description,
    detail: (row) => [row.category, formatDate(row.date), formatMoney(row.amount)]
      .filter(Boolean)
      .join(' · '),
  },
  {
    table: 'lessons',
    label: 'לקחים',
    columns: 'id, date, text, tags',
    match: (term) => `text.ilike.%${term}%`,
    screen: 'lessons',
    title: (row) => row.text,
    detail: (row) => [formatDate(row.date), ...row.tags].join(' · '),
  },
  {
    table: 'suppliers',
    label: 'ספקים',
    columns: 'id, name, phone, note',
    match: (term) => `name.ilike.%${term}%,note.ilike.%${term}%`,
    screen: 'suppliers',
    title: (row) => row.name,
    detail: (row) => [row.phone, row.note].filter(Boolean).join(' · '),
  },
  {
    table: 'stock',
    label: 'שאריות בסדנה',
    columns: 'id, name, amount, source, note',
    match: (term) => `name.ilike.%${term}%,source.ilike.%${term}%,note.ilike.%${term}%`,
    screen: 'stock',
    title: (row) => row.name,
    detail: (row) => [row.amount, row.source].filter(Boolean).join(' · '),
  },
  {
    table: 'materials',
    label: 'חומרים בפרויקטים',
    columns: 'id, project_id, name, actual_cost, planned_cost',
    match: (term) => `name.ilike.%${term}%`,
    screen: 'projects',
    title: (row) => row.name,
    detail: (row) =>
      row.actual_cost != null
        ? formatMoney(row.actual_cost)
        : row.planned_cost != null
          ? `מתוכנן ${formatMoney(row.planned_cost)}`
          : '',
  },
]

// PostgREST separates the branches of an `or` filter with commas and wraps
// them in parentheses, so a term containing either would be read as syntax
// rather than as text. Stripping them costs nothing — nobody searches for "(".
function clean(term) {
  return term.replace(/[,()]/g, ' ').trim()
}

export default function Search({ go }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const term = clean(query)

  useEffect(() => {
    // one letter matches almost everything, which is noise rather than an answer.
    // Nothing is cleared here — what shows is derived below, so an effect that
    // simply does not run leaves nothing stale on screen.
    if (term.length < 2) return

    // Waits for him to stop typing: without this every keystroke is seven
    // requests, and the answers arrive out of order.
    let alive = true
    const timer = setTimeout(async () => {
      setSearching(true)
      setError('')
      const found = await Promise.all(
        KINDS.map(async (kind) => {
          const { data, error } = await supabase
            .from(kind.table)
            .select(kind.columns)
            .or(kind.match(term))
            .limit(8)
          return { kind, rows: data || [], error }
        }),
      )
      if (!alive) return
      const failure = found.find((result) => result.error)
      if (failure) setError(failure.error.message)
      setResults(found.filter((result) => result.rows.length))
      setSearching(false)
    }, 300)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [term])

  const visible = term.length < 2 ? [] : results
  const nothing = term.length >= 2 && !searching && visible.length === 0

  return (
    <>
      <label className="search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="שם לקוח, סוג עץ, מילה בלקחים…"
          autoFocus
        />
      </label>

      {error && <p className="error">{error}</p>}
      {term.length < 2 && <p className="muted">הקלד שתי אותיות לפחות.</p>}
      {nothing && <p className="muted">לא נמצא כלום עבור "{term}".</p>}

      {visible.map(({ kind, rows }) => (
        <section key={kind.table}>
          <div className="section-title">
            <h2>{kind.label}</h2>
          </div>
          <ul className="rows">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="row-btn"
                  onClick={() =>
                    // a material belongs to a job, so the useful destination is
                    // that job rather than a list of every material
                    go(kind.screen, kind.table === 'materials' ? row.project_id : undefined)
                  }
                >
                  <span className="what">
                    <span className="desc">{kind.title(row)}</span>
                    {kind.detail(row) && <span className="cat">{kind.detail(row)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
