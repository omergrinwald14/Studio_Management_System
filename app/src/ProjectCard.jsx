import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney, formatDate } from './lib/format'
import { STAGES, DONE } from './lib/stages'
import { paidOnProject, spentOnProject, projectProfit, overheadPerDay } from './lib/finance'
import TxForm from './TxForm'
import Materials from './Materials'

// One job, everything about it. The mockup settled the shape: a tabbed card, so
// the pipeline, the money and (later) the materials, lessons, journal and photos
// all live behind one project rather than scattered across screens.
export default function ProjectCard({ project: initial, client, onBack, onChanged, onDeleted }) {
  const [project, setProject] = useState(initial)
  const [tab, setTab] = useState('details')
  const [txs, setTxs] = useState([])
  const [settings, setSettings] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('txs')
        .select('id, date, description, category, amount, capital, adjust, project_id, project_share')
        .eq('project_id', initial.id)
        .order('date', { ascending: false }),
      supabase.from('settings').select('rent, days_per_month').eq('id', 1).single(),
    ]).then(([txsResult, settingsResult]) => {
      const failure = txsResult.error || settingsResult.error
      if (failure) setError(failure.message)
      else {
        setTxs(txsResult.data)
        setSettings(settingsResult.data)
      }
      setLoading(false)
    })
  }, [initial.id])

  // Every change to the project is written straight through, then handed up so
  // the list behind this card shows the same thing — one fetch, one source.
  async function patch(changes) {
    const next = { ...project, ...changes }
    setProject(next) // optimistic: the tap should feel instant on a phone
    const { error } = await supabase.from('projects').update(changes).eq('id', project.id)
    if (error) {
      setError(error.message)
      setProject(project) // put it back; the server is the authority
    } else onChanged(next)
  }

  if (loading) return <p>טוען…</p>

  const received = paidOnProject(txs, project.id)
  // the project's share of each outgoing row, not the whole bank movement
  const spent = spentOnProject(txs, project.id)

  // The calculation his spreadsheet cannot produce (D10): the price, less what
  // the job actually cost, less its share of the rent — a workshop day carries
  // overhead whether or not anything was bought that day.
  const overheadDay = overheadPerDay(settings)
  const overhead = Number(project.days) * overheadDay
  const price = project.price == null ? null : Number(project.price)
  const profit = projectProfit(project, txs, settings)

  // Deleting is the one action here with no undo — the free Supabase tier takes
  // no backups (D4) — so the confirmation names the two consequences rather than
  // asking "are you sure": the quote goes with the project, and its transactions
  // do not. They fall back to the כללי / סדנה bucket, because the money left the
  // account whatever happened to the job.
  async function handleDelete() {
    const consequences = [`הפרויקט "${project.name}" יימחק לצמיתות.`]
    if (txs.length) consequences.push(`${txs.length} תנועות יישארו בספר ויעברו לכללי / סדנה.`)
    consequences.push('הצעת המחיר שלו, אם קיימת, תימחק איתו.')
    if (!window.confirm(consequences.join('\n'))) return

    setBusy(true)
    const { error } = await supabase.from('projects').delete().eq('id', project.id)
    if (error) {
      setError(error.message)
      setBusy(false)
    } else onDeleted(project.id)
  }

  function handleSaved(saved) {
    setTxs([saved, ...txs.filter((tx) => tx.id !== saved.id)].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id,
    ))
    setEditingId(null)
  }

  return (
    <>
      <button type="button" className="back" onClick={onBack}>
        → כל הפרויקטים
      </button>
      <h2 className="card-title">{project.name}</h2>
      {error && <p className="error">{error}</p>}

      <div className="chips">
        <button
          type="button"
          className={`chip${tab === 'details' ? ' on' : ''}`}
          onClick={() => setTab('details')}
        >
          פרטים
        </button>
        <button
          type="button"
          className={`chip${tab === 'money' ? ' on' : ''}`}
          onClick={() => setTab('money')}
        >
          כספים
        </button>
        <button
          type="button"
          className={`chip${tab === 'materials' ? ' on' : ''}`}
          onClick={() => setTab('materials')}
        >
          חומרים
        </button>
      </div>

      {tab === 'materials' ? (
        <Materials projectId={project.id} />
      ) : tab === 'details' ? (
        <>
          <section className="card">
            <div className="section-title"><h2>שלב</h2></div>
            <p className="stage-now">{STAGES[project.stage]}</p>
            <div className="pipeline" aria-hidden="true">
              {STAGES.map((label, index) => (
                <span key={label} className={index <= project.stage ? 'seg on' : 'seg'} />
              ))}
            </div>
            <div className="row stepper">
              <button
                type="button"
                className="ghost"
                disabled={project.stage === 0}
                onClick={() => patch({ stage: project.stage - 1 })}
              >
                שלב אחורה
              </button>
              <button
                type="button"
                disabled={project.stage === DONE}
                onClick={() => patch({ stage: project.stage + 1 })}
              >
                שלב הבא
              </button>
            </div>
          </section>

          <section className="card">
            <div className="section-title"><h2>לקוח</h2></div>
            <p className="stage-now">{client ? client.name : '—'}</p>
            {client && client.phone && (
              <a className="contact" href={`tel:${client.phone}`} dir="ltr">
                {client.phone}
              </a>
            )}
            {client && client.address && <p className="muted small">{client.address}</p>}
          </section>

          <section className="card">
            <div className="section-title"><h2>ימי סדנה וזמן</h2></div>
            <dl className="breakdown">
              <div>
                <dt>ימי סדנה שהושקעו</dt>
                <dd className="num">{project.days}</dd>
              </div>
              {project.planned_days != null && (
                <div>
                  <dt>מתוכנן בהצעה</dt>
                  <dd className="num">{project.planned_days}</dd>
                </div>
              )}
              <div>
                <dt>נפתח</dt>
                <dd>{project.opened ? formatDate(project.opened) : '—'}</dd>
              </div>
              <div>
                <dt>תאריך מסירה</dt>
                <dd>{project.due ? formatDate(project.due) : '—'}</dd>
              </div>
            </dl>
            <div className="row stepper">
              <button
                type="button"
                className="ghost"
                disabled={Number(project.days) <= 0}
                onClick={() => patch({ days: Number(project.days) - 1 })}
              >
                − יום
              </button>
              <button type="button" onClick={() => patch({ days: Number(project.days) + 1 })}>
                + יום
              </button>
            </div>
            {project.planned_days != null && Number(project.days) > Number(project.planned_days) && (
              // an extra day is not free: it loads another day of rent on the job
              <p className="warn small">
                חריגה של {Number(project.days) - Number(project.planned_days)} ימים ·
                <span className="num">
                  {' '}
                  {formatMoney((Number(project.days) - Number(project.planned_days)) * overheadDay)}
                </span>{' '}
                תקורה נוספת
              </p>
            )}
          </section>

          <section>
            <button type="button" className="danger wide" onClick={handleDelete} disabled={busy}>
              {busy ? 'מוחק…' : 'מחיקת הפרויקט'}
            </button>
          </section>
        </>
      ) : (
        <>
          <section className="card">
            <div className="section-title"><h2>רווחיות</h2></div>
            <dl className="breakdown">
              <div>
                <dt>מחיר ללקוח</dt>
                <dd className="num">{price == null ? '—' : formatMoney(price)}</dd>
              </div>
              <div>
                <dt>התקבל בפועל</dt>
                <dd className="num">{formatMoney(received)}</dd>
              </div>
              <div>
                <dt>הוצאות הפרויקט</dt>
                <dd className="num">{formatMoney(spent)}</dd>
              </div>
              <div>
                <dt>
                  תקורת סדנה · {project.days} ימים ×{' '}
                  <span className="num">{formatMoney(overheadDay)}</span>
                </dt>
                <dd className="num">{formatMoney(-overhead)}</dd>
              </div>
            </dl>
            <div className="total">
              <span>רווח נקי</span>
              <span className={`num ${profit != null && profit < 0 ? 'neg' : 'pos'}`}>
                {profit == null ? 'אין מחיר סגור' : formatMoney(profit)}
              </span>
            </div>
          </section>

          {editingId === 'new' ? (
            <TxForm
              projects={[project]}
              defaultProjectId={project.id}
              onSaved={handleSaved}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <button type="button" className="add-toggle" onClick={() => setEditingId('new')}>
              + תנועה לפרויקט
            </button>
          )}

          {txs.length === 0 ? (
            <p className="muted">אין תנועות לפרויקט הזה</p>
          ) : (
            <ul className="rows">
              {txs.map((tx) =>
                editingId === tx.id ? (
                  <li key={tx.id} className="editing">
                    <TxForm
                      tx={tx}
                      projects={[project]}
                      defaultProjectId={project.id}
                      onSaved={handleSaved}
                      onDeleted={(id) => {
                        setTxs(txs.filter((row) => row.id !== id))
                        setEditingId(null)
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                ) : (
                  <li key={tx.id}>
                    <button
                      type="button"
                      className="row-btn"
                      onClick={() => setEditingId(tx.id)}
                    >
                      <span className="what">
                        <span className="desc">{tx.description}</span>
                        <span className="cat">
                          {[
                            tx.category,
                            formatDate(tx.date),
                            // the amount shown is the whole movement, so a part
                            // share has to be visible or the total looks wrong
                            Number(tx.project_share) < 100
                              ? `${tx.project_share}% לפרויקט`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className={`num ${tx.amount < 0 ? 'neg' : 'pos'}`}>
                        {formatMoney(tx.amount)}
                      </span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </>
      )}
    </>
  )
}
