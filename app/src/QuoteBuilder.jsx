import { useId, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney, todayISO } from './lib/format'
import { quoteCost, suggestedPrice, overheadPerDay } from './lib/finance'
import { QUOTE_STAGE } from './lib/stages'

const DEFAULT_CONSUMABLES = 150

// The quote builder costs the job before it prices it. That order is the whole
// point: his spreadsheet priced from feel, and the bench that started this
// project sold for less than the wood, the consumables and the rent it used.
//
// Costing used to be an open-ended list of material rows — flexible, and too
// slow for something he fills in standing in a lumber yard. It is now two fixed
// lines instead: מתכלים defaults to what he actually spends and rarely changes,
// and עץ is the one number that does — species, quantity in קוב, price per קוב.
export default function QuoteBuilder({
  clients,
  settings,
  woodSpecies = [],
  woodPriceRecall = {},
  onSaved,
  onClientAdded,
  onCancel,
}) {
  const listId = useId()

  const [name, setName] = useState('')
  const [clientId, setClientId] = useState(clients.length ? String(clients[0].id) : 'new')
  const [newClient, setNewClient] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')

  const [consumables, setConsumables] = useState(String(DEFAULT_CONSUMABLES))
  const [woodName, setWoodName] = useState('')
  const [woodQty, setWoodQty] = useState('')
  const [woodPrice, setWoodPrice] = useState('')
  // once he edits the price himself, stop overwriting it with the recalled one
  const [woodPriceTouched, setWoodPriceTouched] = useState(false)

  const [plannedDays, setPlannedDays] = useState('')
  const [dayRate, setDayRate] = useState(String(settings.day_rate ?? ''))
  const [markup, setMarkup] = useState('25')
  const [price, setPrice] = useState('')
  const [priceTouched, setPriceTouched] = useState(false)
  const [due, setDue] = useState('')
  const [decisionDue, setDecisionDue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const overheadDay = overheadPerDay(settings)
  const cost = quoteCost({
    items: [
      { qty: 1, unit_cost: consumables },
      { qty: woodQty, unit_cost: woodPrice },
    ],
    plannedDays,
    dayRate,
    overheadDay,
  })
  const suggestion = suggestedPrice(cost.total, markup)
  // Until he types a price of his own, the markup drives it — after that the
  // price is his and the markup stops overwriting it.
  const finalPrice = priceTouched && price !== '' ? Number(price) : suggestion
  const belowCost = finalPrice < cost.total

  // A species he has quoted before already carries an answer to "how much per
  // קוב?" — reuse it instead of asking the same question twice.
  function handleWoodName(value) {
    setWoodName(value)
    if (!woodPriceTouched && woodPriceRecall[value] != null) {
      setWoodPrice(String(woodPriceRecall[value]))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    let id = clientId
    if (clientId === 'new') {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: newClient.trim(),
          phone: newPhone.trim() || null,
          address: newAddress.trim() || null,
        })
        .select('id, name, phone, address')
        .single()
      if (error) return fail(error)
      onClientAdded(data)
      id = data.id
    }

    // A quote creates its project at once, parked at the quote stage — so the
    // same job is reachable from the quotes list, the projects list and the
    // dashboard instead of existing twice under two names.
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        client_id: Number(id),
        stage: QUOTE_STAGE,
        price: finalPrice,
        opened: todayISO(),
        due: due || null,
        days: 0,
        planned_days: Number(plannedDays) || 0,
        lost: false,
      })
      .select('id, name, client_id, stage, price, opened, due, days, planned_days, lost')
      .single()
    if (projectError) return fail(projectError)

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        project_id: project.id,
        planned_days: Number(plannedDays) || 0,
        day_rate: Number(dayRate) || 0,
        overhead_day: overheadDay,
        markup: Number(markup) || 0,
        price: finalPrice,
        sent: todayISO(),
        decision_due: decisionDue || null,
      })
      .select('*')
      .single()
    if (quoteError) return fail(quoteError)

    const lines = []
    if (Number(consumables) > 0) {
      lines.push({ quote_id: quote.id, name: 'מתכלים', qty: 1, unit_cost: Number(consumables) })
    }
    if (woodName.trim() && Number(woodQty) > 0) {
      lines.push({
        quote_id: quote.id,
        name: woodName.trim(),
        qty: Number(woodQty),
        unit_cost: Number(woodPrice) || 0,
      })
    }

    let savedItems = []
    if (lines.length) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('quote_items')
        .insert(lines)
        .select('*')
      if (itemsError) return fail(itemsError)
      savedItems = itemsData
    }

    setBusy(false)
    // only the wood line feeds next time's species suggestions — מתכלים is not
    // a species, and Quotes.jsx already excludes it from what it fetches
    onSaved({ ...quote, project, items: savedItems.filter((item) => item.name !== 'מתכלים') })

    function fail(failure) {
      setError(failure.message)
      setBusy(false)
    }
  }

  const needsClientName = clientId === 'new' && !newClient.trim()

  return (
    <form className="add" onSubmit={handleSubmit}>
      <label>
        שם הפרויקט
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <label>
        לקוח
        <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
          <option value="new">+ לקוח חדש</option>
        </select>
      </label>

      {clientId === 'new' && (
        <>
          <div className="row">
            <label>
              שם הלקוח
              <input value={newClient} onChange={(e) => setNewClient(e.target.value)} required />
            </label>
            <label>
              טלפון
              <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </label>
          </div>
          <label>
            כתובת להובלה / התקנה
            <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
          </label>
        </>
      )}

      <div className="items">
        <p className="menu-label">עלות החומרים</p>

        <label>
          חומרים מתכלים
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={consumables}
            onChange={(e) => setConsumables(e.target.value)}
          />
        </label>

        <label>
          סוג עץ
          <input
            value={woodName}
            onChange={(e) => handleWoodName(e.target.value)}
            list={`${listId}-species`}
          />
          <datalist id={`${listId}-species`}>
            {woodSpecies.map((species) => (
              <option key={species} value={species} />
            ))}
          </datalist>
        </label>

        <div className="row">
          <label>
            כמות (קו"ב)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={woodQty}
              onChange={(e) => setWoodQty(e.target.value)}
            />
          </label>
          <label>
            מחיר לקו"ב
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={woodPrice}
              onChange={(e) => {
                setWoodPriceTouched(true)
                setWoodPrice(e.target.value)
              }}
            />
          </label>
        </div>
      </div>

      <div className="row">
        <label>
          ימי עבודה מתוכננים
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={plannedDays}
            onChange={(e) => setPlannedDays(e.target.value)}
          />
        </label>
        <label>
          תעריף ליום
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={dayRate}
            onChange={(e) => setDayRate(e.target.value)}
          />
        </label>
      </div>

      <dl className="breakdown">
        <div>
          <dt>חומרים</dt>
          <dd className="num">{formatMoney(cost.materials)}</dd>
        </div>
        <div>
          <dt>עבודה</dt>
          <dd className="num">{formatMoney(cost.labour)}</dd>
        </div>
        <div>
          <dt>
            תקורת סדנה · <span className="num">{formatMoney(overheadDay)}</span> ליום
          </dt>
          <dd className="num">{formatMoney(cost.overhead)}</dd>
        </div>
      </dl>
      <div className="total">
        <span>עלות הפרויקט</span>
        <span className="num">{formatMoney(cost.total)}</span>
      </div>

      <div className="row">
        <label>
          רווח (%)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
          />
        </label>
        <label>
          מחיר ללקוח
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={priceTouched ? price : suggestion}
            onChange={(e) => {
              setPriceTouched(true)
              setPrice(e.target.value)
            }}
          />
        </label>
      </div>

      {belowCost && (
        <p className="warn small">
          המחיר נמוך מהעלות — הפסד של{' '}
          <span className="num">{formatMoney(cost.total - finalPrice)}</span>
        </p>
      )}

      <div className="row">
        <label>
          תאריך מסירה
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label>
          תשובה צפויה עד
          <input
            type="date"
            value={decisionDue}
            onChange={(e) => setDecisionDue(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy || !name.trim() || needsClientName}>
          {busy ? 'שומר…' : 'שמירת ההצעה'}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </form>
  )
}
