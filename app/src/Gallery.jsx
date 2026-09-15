import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { upload, signedUrls, remove } from './lib/storage'
import Toast from './Toast'
import { useFlash } from './lib/useFlash'

const BUCKET = 'media'

const PHASES = [
  { id: 'raw', label: 'חומר גלם' },
  { id: 'wip', label: 'בתהליך' },
  { id: 'final', label: 'מוצר סופי' },
]

// The process gallery for one job. The phases are the spec's, and they are what
// make the pictures worth keeping in order: the same bench as a stack of boards,
// as a half-built frame, and finished is the story he tells a client.
export default function Gallery({ projectId }) {
  const [items, setItems] = useState([])
  const [urls, setUrls] = useState({})
  const [phase, setPhase] = useState('wip') // what the next upload is filed under
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(null) // { done, total } while uploading
  const [justAdded, setJustAdded] = useState(new Set())
  const [flash, showFlash] = useFlash()

  useEffect(() => {
    supabase
      .from('media')
      .select('id, path, phase, portfolio, caption')
      .eq('project_id', projectId)
      .order('id')
      .then(async ({ data, error }) => {
        if (error) setError(error.message)
        else {
          setItems(data)
          // one request for every thumbnail rather than one per tile
          const { urls, error: urlError } = await signedUrls(
            BUCKET,
            data.map((item) => item.path),
          )
          if (urlError) setError(urlError)
          else setUrls(urls)
        }
        setLoading(false)
      })
  }, [projectId])

  async function addPhotos(files) {
    if (!files.length) return
    setBusy(true)
    setError('')
    let done = 0
    const fresh = new Set()

    for (const file of files) {
      setProgress({ done, total: files.length })
      const { path, error } = await upload(BUCKET, file, `project-${projectId}`)
      if (error) {
        setError(error)
        break
      }
      const { data, error: rowError } = await supabase
        .from('media')
        .insert({ project_id: projectId, path, phase })
        .select('id, path, phase, portfolio, caption')
        .single()
      if (rowError) {
        // the row failed, so the file it points at is not wanted either
        await remove(BUCKET, path)
        setError(rowError.message)
        break
      }
      const { urls: signed } = await signedUrls(BUCKET, [path])
      setItems((current) => [...current, data])
      setUrls((current) => ({ ...current, ...signed }))
      fresh.add(data.id)
      done += 1
    }
    setBusy(false)
    setProgress(null)

    if (done) {
      const phaseLabel = PHASES.find((p) => p.id === phase).label
      showFlash(done === 1 ? `✓ התמונה הועלתה · ${phaseLabel}` : `✓ ${done} תמונות הועלו · ${phaseLabel}`)
      // the new tiles are marked for a moment, so he can see which ones landed
      setJustAdded(fresh)
      setTimeout(() => setJustAdded(new Set()), 2500)
    }
  }

  async function togglePortfolio(item) {
    const next = !item.portfolio
    setItems(items.map((row) => (row.id === item.id ? { ...row, portfolio: next } : row)))
    const { error } = await supabase
      .from('media')
      .update({ portfolio: next })
      .eq('id', item.id)
    if (error) setError(error.message)
  }

  async function removePhoto(item) {
    if (!window.confirm('למחוק את התמונה?')) return
    const { error } = await supabase.from('media').delete().eq('id', item.id)
    if (error) return setError(error.message)
    await remove(BUCKET, item.path)
    setItems(items.filter((row) => row.id !== item.id))
    showFlash('התמונה נמחקה')
  }

  if (loading) return <p>טוען גלריה…</p>

  return (
    <>
      {error && <p className="error">{error}</p>}

      <div className="chips">
        {PHASES.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip${phase === option.id ? ' on' : ''}`}
            onClick={() => setPhase(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className={`file${busy ? ' busy' : ''}`}>
        {busy
          ? progress && progress.total > 1
            ? `מעלה ${progress.done + 1} מתוך ${progress.total}…`
            : 'מעלה…'
          : `📷 הוספת תמונות · ${PHASES.find((p) => p.id === phase).label}`}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(e) => {
            addPhotos([...e.target.files])
            e.target.value = '' // so picking the same photos again still fires
          }}
        />
      </label>
      <Toast message={flash} />

      {items.length === 0 ? (
        <p className="muted">אין תמונות לפרויקט הזה</p>
      ) : (
        PHASES.filter((option) => items.some((item) => item.phase === option.id)).map((option) => (
          <section key={option.id}>
            <div className="section-title">
              <h2>{option.label}</h2>
            </div>
            <div className="gallery">
              {items
                .filter((item) => item.phase === option.id)
                .map((item) => (
                  <figure key={item.id} className={`shot${justAdded.has(item.id) ? ' new' : ''}`}>
                    {urls[item.path] ? (
                      <a href={urls[item.path]} target="_blank" rel="noopener noreferrer">
                        <img src={urls[item.path]} alt={item.caption || ''} loading="lazy" />
                      </a>
                    ) : (
                      <div className="shot-missing" />
                    )}
                    <figcaption>
                      <button
                        type="button"
                        className={`star${item.portfolio ? ' on' : ''}`}
                        onClick={() => togglePortfolio(item)}
                        aria-label={item.portfolio ? 'הסרה מהפורטפוליו' : 'סימון לפורטפוליו'}
                      >
                        {item.portfolio ? '★' : '☆'}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => removePhoto(item)}
                        aria-label="מחיקה"
                      >
                        ✕
                      </button>
                    </figcaption>
                  </figure>
                ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
