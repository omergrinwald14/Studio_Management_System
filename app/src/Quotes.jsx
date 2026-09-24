import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney, formatDate, todayISO } from './lib/format'
import { DEPOSIT_STAGE } from './lib/stages'
import QuoteBuilder from './QuoteBuilder'
import QuoteDocument from './QuoteDocument'

// Quotes out with clients. A quote is pending until he records an answer, and
// the answer is what moves the job: accepted pushes the project to מקדמה וסקיצה
// and keeps the agreed price; rejected keeps the project as history rather than
// deleting it, because a job he did not win is still something he quoted for.
export default function Quotes() {
  const [quotes, setQuotes] = useState([])
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [settings, setSettings] = useState(null)
  const [woodItems, setWoodItems] = useState([])
  const [extraItems, setExtraItems] = useState([])
  const [building, setBuilding] = useState(false)
  const [editing, setEditing] = useState(null) // the quote being edited, if any
  const [editingItems, setEditingItems] = useState([])
  const [editingExtras, setEditingExtras] = useState([])
  const [showing, setShowing] = useState(null) // the quote being shown as a document
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('quotes').select('*').order('id', { ascending: false }),
      supabase.from('projects').select('id, name, client_id, stage, price, lost'),
      supabase.from('clients').select('id, name, phone, address').order('name'),
      supabase
        .from('settings')
        .select(
          'rent, days_per_month, day_rate, rent_day, hourly_rate, business_name, business_phone, business_email, business_id, quote_terms',
        )
        .eq('id', 1)
        .single(),
      // newest first, so "the last price he quoted for this species" is a plain
      // first-match — the same recall trick TxForm uses for categories
      supabase
        .from('quote_items')
        .select('name, unit_cost')
        .neq('name', 'מתכלים')
        .order('id', { ascending: false }),
      supabase.from('quote_extras').select('name'),
    ]).then(
      ([quotesResult, projectsResult, clientsResult, settingsResult, itemsResult, extrasResult]) => {
        const failure =
          quotesResult.error ||
          projectsResult.error ||
          clientsResult.error ||
          settingsResult.error ||
          itemsResult.error ||
          extrasResult.error
        if (failure) setError(failure.message)
        else {
          setQuotes(quotesResult.data)
          setProjects(projectsResult.data)
          setClients(clientsResult.data)
          setSettings(settingsResult.data)
          setWoodItems(itemsResult.data)
          setExtraItems(extrasResult.data)
        }
        setLoading(false)
      },
    )
  }, [])

  // Every wood species he has ever priced becomes a suggestion; the price he
  // charged for it last time fills in automatically until he edits it himself.
  const woodSpecies = [...new Set(woodItems.map((item) => item.name))].sort((a, b) =>
    a.localeCompare(b, 'he'),
  )
  const woodPriceRecall = {}
  for (const item of woodItems) {
    if (!(item.name in woodPriceRecall)) woodPriceRecall[item.name] = item.unit_cost
  }

  // Names only, no recalled amount: what delivery costs depends on where the
  // client lives, so last time's figure would be a guess dressed up as a fact.
  const extraNames = [...new Set(extraItems.map((extra) => extra.name))].sort((a, b) =>
    a.localeCompare(b, 'he'),
  )

  function projectOf(quote) {
    return projects.find((project) => project.id === quote.project_id)
  }

  // Its saved lines have to be in hand before the form opens, or the fields
  // would appear empty and a save would wipe what is actually stored.
  async function editQuote(quote) {
    setError('')
    const [itemsResult, extrasResult] = await Promise.all([
      supabase
        .from('quote_items')
        .select('id, name, qty, unit_cost')
        .eq('quote_id', quote.id)
        .order('id'),
      supabase.from('quote_extras').select('id, name, amount').eq('quote_id', quote.id).order('id'),
    ])

    const failure = itemsResult.error || extrasResult.error
    if (failure) return setError(failure.message)
    setEditingItems(itemsResult.data)
    setEditingExtras(extrasResult.data)
    setEditing(quote)
    setBuilding(true)
  }

  function closeBuilder() {
    setBuilding(false)
    setEditing(null)
    setEditingItems([])
    setEditingExtras([])
  }

  function clientNameOf(project) {
    const client = project && clients.find((c) => c.id === project.client_id)
    return client ? client.name : ''
  }

  // Answering a quote changes two rows at once, and they have to agree: the
  // quote records the answer, the project moves or is marked lost.
  async function decide(quote, decision) {
    setBusyId(quote.id)
    setError('')

    const projectChanges =
      decision === 'accepted'
        ? { stage: DEPOSIT_STAGE, price: quote.price, lost: false }
        : { lost: true }

    const [quoteResult, projectResult] = await Promise.all([
      supabase
        .from('quotes')
        .update({ decision, decided_on: todayISO() })
        .eq('id', quote.id)
        .select('*')
        .single(),
      supabase
        .from('projects')
        .update(projectChanges)
        .eq('id', quote.project_id)
        .select('id, name, client_id, stage, price, lost')
        .single(),
    ])

    const failure = quoteResult.error || projectResult.error
    if (failure) setError(failure.message)
    else {
      setQuotes(quotes.map((q) => (q.id === quote.id ? quoteResult.data : q)))
      setProjects(projects.map((p) => (p.id === projectResult.data.id ? projectResult.data : p)))
    }
    setBusyId(null)
  }

  if (loading) return <p>טוען הצעות…</p>

  // The client-facing document takes over the whole screen: it is the one view
  // meant to be printed, so nothing else should be on the page around it.
  if (showing) {
    const project = projectOf(showing)
    return (
      <QuoteDocument
        quote={showing}
        project={project}
        client={clients.find((c) => project && c.id === project.client_id)}
        settings={settings}
        onBack={() => setShowing(null)}
      />
    )
  }

  const pending = quotes.filter((quote) => !quote.decision)
  const answered = quotes.filter((quote) => quote.decision)

  return (
    <>
      {error && <p className="error">{error}</p>}

      {building ? (
        <QuoteBuilder
          clients={clients}
          settings={settings}
          woodSpecies={woodSpecies}
          woodPriceRecall={woodPriceRecall}
          extraNames={extraNames}
          quote={editing}
          project={editing ? projectOf(editing) : null}
          editItems={editingItems}
          editExtras={editingExtras}
          onSaved={({ project, items, extras, ...quote }) => {
            // an edited quote replaces its old row; a new one goes on top
            setQuotes([quote, ...quotes.filter((q) => q.id !== quote.id)])
            setProjects([project, ...projects.filter((p) => p.id !== project.id)])
            setWoodItems([...items, ...woodItems])
            setExtraItems([...extras, ...extraItems])
            closeBuilder()
          }}
          onClientAdded={(client) => setClients([...clients, client])}
          onCancel={closeBuilder}
        />
      ) : (
        <button type="button" className="add-toggle" onClick={() => setBuilding(true)}>
          + הצעה חדשה
        </button>
      )}

      <section>
        <div className="section-title">
          <h2>ממתינות לתשובה</h2>
        </div>
        {pending.length === 0 ? (
          <p className="muted">אין הצעות פתוחות</p>
        ) : (
          <ul className="rows">
            {pending.map((quote) => {
              const project = projectOf(quote)
              return (
                <li key={quote.id} className="stacked">
                  <div className="quote-head">
                    <span className="what">
                      <span className="desc">{project ? project.name : '—'}</span>
                      <span className="cat">
                        {[
                          clientNameOf(project),
                          quote.decision_due ? `תשובה עד ${formatDate(quote.decision_due)}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="num">{formatMoney(quote.price)}</span>
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      disabled={busyId === quote.id}
                      onClick={() => decide(quote, 'accepted')}
                    >
                      ההצעה אושרה
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={busyId === quote.id}
                      onClick={() => decide(quote, 'rejected')}
                    >
                      נדחתה
                    </button>
                  </div>
                  <div className="row">
                    <button type="button" className="ghost" onClick={() => setShowing(quote)}>
                      מסמך ללקוח
                    </button>
                    <button type="button" className="ghost" onClick={() => editQuote(quote)}>
                      עריכה
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {answered.length > 0 && (
        <section>
          <div className="section-title">
            <h2>הוכרעו</h2>
          </div>
          <ul className="rows">
            {answered.map((quote) => {
              const project = projectOf(quote)
              return (
                <li key={quote.id} className="stacked">
                  <div className="quote-head">
                    <span className="what">
                      <span className="desc">{project ? project.name : '—'}</span>
                      <span className="cat">
                        {[
                          clientNameOf(project),
                          quote.decision === 'accepted' ? 'אושרה' : 'נדחתה',
                          quote.decided_on ? formatDate(quote.decided_on) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="num">{formatMoney(quote.price)}</span>
                  </div>
                  <div className="row">
                    <button type="button" className="ghost" onClick={() => setShowing(quote)}>
                      מסמך ללקוח
                    </button>
                    {/* editable after the decision too: correcting a figure on a
                        job he already won is the common case, and saving writes
                        the corrected price back onto the project */}
                    <button type="button" className="ghost" onClick={() => editQuote(quote)}>
                      עריכה
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </>
  )
}
