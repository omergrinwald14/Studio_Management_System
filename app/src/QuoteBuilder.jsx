import { useState } from 'react'
import Suggest from './Suggest'
import { supabase } from './lib/supabase'
import { formatMoney, todayISO } from './lib/format'
import { quoteCost, componentPrice, overheadPerDay, quoteDeposit } from './lib/finance'
import { QUOTE_STAGE } from './lib/stages'

const DEFAULT_CONSUMABLES = 150

// React needs a key that survives a row being removed from the middle; the
// index would hand one row's half-typed name to its neighbour.
let extraKey = 0
const extraRow = (name = '', amount = '') => ({ key: extraKey++, name, amount })

// The quote builder costs the job before it prices it. That order is the whole
// point: his spreadsheet priced from feel, and the bench that started this
// project sold for less than the wood, the consumables and the rent it used.
//
// Costing used to be an open-ended list of material rows — flexible, and too
// slow for something he fills in standing in a lumber yard. It is now two fixed
// lines instead: מתכלים defaults to what he actually spends and rarely changes,
// and עץ is the one number that does — species, quantity in קוב, price per קוב.
//
// Labour prices one of two ways. `plannedDays` always feeds overhead — the
// workshop is occupied that many days regardless — but the labour figure
// itself is either days × his own day rate, or an employee's hours × an
// hourly rate, chosen by a toggle rather than mixed into one field.
export default function QuoteBuilder({
  clients,
  settings,
  woodSpecies = [],
  woodPriceRecall = {},
  extraNames = [], // every extra he has charged before, as suggestions
  quote = null, // the quote being edited, if any
  project = null, // its project, so the name and dates can be edited too
  editItems = [], // its saved lines
  editExtras = [], // its saved extras
  onSaved,
  onClientAdded,
  onCancel,
}) {
  // Editing an existing quote reuses this whole form — same fields, same
  // arithmetic — and differs only in what the save writes.
  const editing = Boolean(quote)
  const wood = editItems.find((item) => item.name !== 'מתכלים')
  const consumablesItem = editItems.find((item) => item.name === 'מתכלים')

  const [name, setName] = useState(project ? project.name : '')
  const [clientId, setClientId] = useState(
    project ? String(project.client_id) : clients.length ? String(clients[0].id) : 'new',
  )
  const [newClient, setNewClient] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')

  const [consumables, setConsumables] = useState(
    consumablesItem ? String(consumablesItem.unit_cost) : String(DEFAULT_CONSUMABLES),
  )
  const [woodName, setWoodName] = useState(wood ? wood.name : '')
  const [woodQty, setWoodQty] = useState(wood ? String(wood.qty) : '')
  const [woodPrice, setWoodPrice] = useState(wood ? String(wood.unit_cost) : '')
  // once he edits the price himself, stop overwriting it with the recalled one
  const [woodPriceTouched, setWoodPriceTouched] = useState(editing)

  const [plannedDays, setPlannedDays] = useState(quote ? String(quote.planned_days) : '')
  const [labourMode, setLabourMode] = useState(quote ? quote.labour_mode : 'days') // 'days' | 'hours'
  const [dayRate, setDayRate] = useState(
    String((quote ? quote.day_rate : settings.day_rate) ?? ''),
  )
  const [hours, setHours] = useState(quote ? String(quote.hours) : '')
  const [hourlyRate, setHourlyRate] = useState(
    String((quote ? quote.hourly_rate : settings.hourly_rate) ?? ''),
  )

  const [markup, setMarkup] = useState(quote ? String(quote.markup) : '25')
  const [materialsDiscount, setMaterialsDiscount] = useState(
    quote ? String(quote.materials_discount) : '0',
  )
  const [labourDiscount, setLabourDiscount] = useState(quote ? String(quote.labour_discount) : '0')
  const [overheadDiscount, setOverheadDiscount] = useState(
    quote ? String(quote.overhead_discount) : '0',
  )
  const [depositMode, setDepositMode] = useState(quote ? quote.deposit_mode : 'percent') // 'percent' | 'amount'
  const [depositPercent, setDepositPercent] = useState(
    quote ? String(quote.deposit_percent) : '0',
  )
  const [depositAmount, setDepositAmount] = useState(quote ? String(quote.deposit_amount) : '0')
  const [extras, setExtras] = useState(() =>
    editExtras.map((extra) => extraRow(extra.name, String(extra.amount))),
  )

  const [due, setDue] = useState(project && project.due ? project.due : '')
  const [decisionDue, setDecisionDue] = useState(quote && quote.decision_due ? quote.decision_due : '')
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
    hours: labourMode === 'hours' ? hours : 0,
    hourlyRate,
  })

  // Each component is marked up and then discounted on its own — the lever for
  // shaving one line, usually labour, without touching what the rest actually
  // costs him. The sum is the suggestion; the rounding below moves it.
  const priced = {
    materials: componentPrice(cost.materials, markup, materialsDiscount),
    labour: componentPrice(cost.labour, markup, labourDiscount),
    overhead: componentPrice(cost.overhead, markup, overheadDiscount),
  }
  // Extras (הובלה, התקנה) go on at the figure he types, with no markup and no
  // discount: he prices them to the client directly rather than costing them.
  const extrasTotal = extras.reduce((total, extra) => total + (Number(extra.amount) || 0), 0)
  const suggestion = priced.materials + priced.labour + priced.overhead + extrasTotal

  // The price is always the calculation plus a rounding he types. It used to be
  // a figure typed over the calculation, which froze the price the moment he
  // touched it, so discounts stopped moving it. A saved quote's rounding is
  // recovered as whatever separated its price from the calculation, so reopening
  // it shows the price he sent. Declared here, not with the other state, because
  // its first value needs the suggestion; hooks only need a stable order.
  const [rounding, setRounding] = useState(() =>
    quote ? String(Number(quote.price) - suggestion) : '0',
  )
  const finalPrice = suggestion + (Number(rounding) || 0)
  // judged on the job without its extras, so a delivery charge cannot hide an
  // underpriced piece
  const loss = cost.total - (finalPrice - extrasTotal)
  const belowCost = loss > 0

  const deposit = quoteDeposit({
    price: finalPrice,
    mode: depositMode,
    percent: depositPercent,
    amount: depositAmount,
  })

  function setExtra(key, field, value) {
    setExtras((current) =>
      current.map((extra) => (extra.key === key ? { ...extra, [field]: value } : extra)),
    )
  }

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
    // dashboard instead of existing twice under two names. Editing a quote
    // edits that same project rather than making a second one.
    const projectValues = {
      name: name.trim(),
      client_id: Number(id),
      price: finalPrice,
      due: due || null,
      planned_days: Number(plannedDays) || 0,
    }
    const { data: savedProject, error: projectError } = await (editing
      ? supabase.from('projects').update(projectValues).eq('id', project.id)
      : supabase.from('projects').insert({
          ...projectValues,
          stage: QUOTE_STAGE,
          opened: todayISO(),
          days: 0,
          lost: false,
        })
    )
      .select('id, name, client_id, stage, price, opened, due, days, planned_days, lost')
      .single()
    if (projectError) return fail(projectError)

    const quoteValues = {
      planned_days: Number(plannedDays) || 0,
      day_rate: Number(dayRate) || 0,
      overhead_day: overheadDay,
      labour_mode: labourMode,
      hours: labourMode === 'hours' ? Number(hours) || 0 : 0,
      hourly_rate: Number(hourlyRate) || 0,
      markup: Number(markup) || 0,
      materials_discount: Number(materialsDiscount) || 0,
      labour_discount: Number(labourDiscount) || 0,
      overhead_discount: Number(overheadDiscount) || 0,
      // like labour: only the chosen mode's figure is kept, so a stale number
      // in the other field cannot resurface later
      deposit_mode: depositMode,
      deposit_percent: depositMode === 'percent' ? Number(depositPercent) || 0 : 0,
      deposit_amount: depositMode === 'amount' ? Number(depositAmount) || 0 : 0,
      price: finalPrice,
      decision_due: decisionDue || null,
    }
    const { data: savedQuote, error: quoteError } = await (editing
      ? supabase.from('quotes').update(quoteValues).eq('id', quote.id)
      : supabase
          .from('quotes')
          .insert({ ...quoteValues, project_id: savedProject.id, sent: todayISO() })
    )
      .select('*')
      .single()
    if (quoteError) return fail(quoteError)

    // There are only ever two lines, so replacing them wholesale is simpler and
    // harder to get wrong than working out which of them changed.
    if (editing) {
      const { error: clearError } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', savedQuote.id)
      if (clearError) return fail(clearError)
    }

    const lines = []
    if (Number(consumables) > 0) {
      lines.push({ quote_id: savedQuote.id, name: 'מתכלים', qty: 1, unit_cost: Number(consumables) })
    }
    if (woodName.trim() && Number(woodQty) > 0) {
      lines.push({
        quote_id: savedQuote.id,
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

    // Replaced wholesale for the same reason as the lines above.
    if (editing) {
      const { error: clearError } = await supabase
        .from('quote_extras')
        .delete()
        .eq('quote_id', savedQuote.id)
      if (clearError) return fail(clearError)
    }

    const extraLines = extras
      .filter((extra) => extra.name.trim())
      .map((extra) => ({
        quote_id: savedQuote.id,
        name: extra.name.trim(),
        amount: Number(extra.amount) || 0,
      }))

    let savedExtras = []
    if (extraLines.length) {
      const { data: extrasData, error: extrasError } = await supabase
        .from('quote_extras')
        .insert(extraLines)
        .select('*')
      if (extrasError) return fail(extrasError)
      savedExtras = extrasData
    }

    setBusy(false)
    // only the wood line feeds next time's species suggestions — מתכלים is not
    // a species, and Quotes.jsx already excludes it from what it fetches
    onSaved({
      ...savedQuote,
      project: savedProject,
      items: savedItems.filter((item) => item.name !== 'מתכלים'),
      extras: savedExtras,
    })

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
          <Suggest value={woodName} onChange={handleWoodName} options={woodSpecies} />
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

      <div className="items">
        <p className="menu-label">זמן עבודה</p>

        <label>
          ימי סדנה מתוכננים
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={plannedDays}
            onChange={(e) => setPlannedDays(e.target.value)}
          />
        </label>
        <p className="muted small">קובע את תקורת השכירות, בכל אופן חישוב</p>

        <div className="chips">
          <button
            type="button"
            className={`chip${labourMode === 'days' ? ' on' : ''}`}
            onClick={() => setLabourMode('days')}
          >
            לפי ימי עבודה
          </button>
          <button
            type="button"
            className={`chip${labourMode === 'hours' ? ' on' : ''}`}
            onClick={() => setLabourMode('hours')}
          >
            לפי שעות עבודה
          </button>
        </div>

        {labourMode === 'days' ? (
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
        ) : (
          <div className="row">
            <label>
              שעות עבודה
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </label>
            <label>
              תעריף לשעה
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </label>
          </div>
        )}
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

      <label>
        רווח (%) — על כל הרכיבים
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={markup}
          onChange={(e) => setMarkup(e.target.value)}
        />
      </label>

      <div className="items">
        <p className="menu-label">הנחה לפי רכיב (%)</p>
        <div className="row">
          <label>
            חומרים
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              value={materialsDiscount}
              onChange={(e) => setMaterialsDiscount(e.target.value)}
            />
          </label>
          <label>
            עבודה
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              value={labourDiscount}
              onChange={(e) => setLabourDiscount(e.target.value)}
            />
          </label>
          <label>
            תקורה
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              value={overheadDiscount}
              onChange={(e) => setOverheadDiscount(e.target.value)}
            />
          </label>
        </div>
        <dl className="breakdown">
          <div>
            <dt>חומרים לאחר רווח והנחה</dt>
            <dd className="num">{formatMoney(priced.materials)}</dd>
          </div>
          <div>
            <dt>עבודה לאחר רווח והנחה</dt>
            <dd className="num">{formatMoney(priced.labour)}</dd>
          </div>
          <div>
            <dt>תקורה לאחר רווח והנחה</dt>
            <dd className="num">{formatMoney(priced.overhead)}</dd>
          </div>
        </dl>
      </div>

      <div className="items">
        <p className="menu-label">תוספות ללקוח — הובלה, התקנה ועוד</p>
        {extras.map((extra) => (
          <div className="row extra-row" key={extra.key}>
            <label>
              שם
              <Suggest
                value={extra.name}
                onChange={(value) => setExtra(extra.key, 'name', value)}
                options={extraNames}
                required
              />
            </label>
            <label>
              סכום (₪)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={extra.amount}
                onChange={(e) => setExtra(extra.key, 'amount', e.target.value)}
              />
            </label>
            <button
              type="button"
              className="danger"
              aria-label="הסרת התוספת"
              onClick={() => setExtras(extras.filter((other) => other.key !== extra.key))}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => setExtras([...extras, extraRow()])}>
          + הוספת תוספת
        </button>
      </div>

      <label>
        עיגול (₪) — פלוס או מינוס על המחיר המחושב
        {/* no inputMode: the iPhone's decimal pad has no minus key, and
            rounding down is the usual direction */}
        <input type="number" value={rounding} onChange={(e) => setRounding(e.target.value)} />
      </label>

      {belowCost && (
        <p className="warn small">
          המחיר נמוך מהעלות — הפסד של{' '}
          <span className="num">{formatMoney(loss)}</span>
        </p>
      )}

      <div className="items">
        <p className="menu-label">מקדמה</p>
        <div className="chips">
          <button
            type="button"
            className={`chip${depositMode === 'percent' ? ' on' : ''}`}
            onClick={() => setDepositMode('percent')}
          >
            באחוזים מהמחיר
          </button>
          <button
            type="button"
            className={`chip${depositMode === 'amount' ? ' on' : ''}`}
            onClick={() => setDepositMode('amount')}
          >
            סכום בשקלים
          </button>
        </div>

        {depositMode === 'percent' ? (
          <label>
            מקדמה (% מהמחיר)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              value={depositPercent}
              onChange={(e) => setDepositPercent(e.target.value)}
            />
          </label>
        ) : (
          <label>
            מקדמה (₪)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
          </label>
        )}

        {deposit > finalPrice ? (
          <p className="warn small">המקדמה גבוהה מהמחיר ללקוח</p>
        ) : (
          deposit > 0 && (
            // either way he is quoting shekels to a client, so show the figures
            <p className="note">
              מקדמה: <span className="num">{formatMoney(deposit)}</span>
              <span className="muted">
                {' · '}היתרה במסירה: <span className="num">{formatMoney(finalPrice - deposit)}</span>
              </span>
            </p>
          )
        )}
      </div>

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

      {/* pinned above the tab bar, so the price stays in sight while he
          scrolls the levers above that move it */}
      <div className={`price-bar${belowCost ? ' loss' : ''}`}>
        <span>מחיר ללקוח</span>
        <span className="num">{formatMoney(finalPrice)}</span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy || !name.trim() || needsClientName}>
          {busy ? 'שומר…' : editing ? 'שמירת השינויים' : 'שמירת ההצעה'}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </form>
  )
}
