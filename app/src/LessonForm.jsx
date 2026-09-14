import { useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO } from './lib/format'
import { parseTags } from './lib/tags'

const COLUMNS = 'id, project_id, date, text, tags'

// Writing down what went wrong, while it is still annoying enough to remember.
export default function LessonForm({
  lesson,
  projectId = null,
  projects = [],
  knownTags = [],
  onSaved,
  onDeleted,
  onCancel,
}) {
  const editing = Boolean(lesson && lesson.id)
  const [date, setDate] = useState(lesson?.date || todayISO())
  const [text, setText] = useState(lesson?.text || '')
  // held as one string while typing, because splitting on every keystroke makes
  // a half-typed tag vanish the moment he reaches for the comma
  const [tags, setTags] = useState((lesson?.tags || []).join(', '))
  const [project, setProject] = useState(
    String(lesson?.project_id ?? projectId ?? ''),
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const values = {
      date,
      text: text.trim(),
      project_id: project ? Number(project) : null,
      tags: parseTags(tags),
    }
    const query = editing
      ? supabase.from('lessons').update(values).eq('id', lesson.id)
      : supabase.from('lessons').insert(values)

    const { data, error } = await query.select(COLUMNS).single()
    if (error) setError(error.message)
    else onSaved(data)
    setBusy(false)
  }

  async function handleDelete() {
    if (!window.confirm('למחוק את הלקח?')) return
    setBusy(true)
    const { error } = await supabase.from('lessons').delete().eq('id', lesson.id)
    if (error) {
      setError(error.message)
      setBusy(false)
    } else onDeleted(lesson.id)
  }

  return (
    <form className="add" onSubmit={handleSubmit}>
      <label>
        מה קרה ומה למדת
        <textarea
          rows="4"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="המחסן דיווח על עובי 50 מ״מ, בפועל הגיע 42 אחרי הקצעה — נדרש תכנון מחדש של החיבורים"
          required
        />
      </label>

      <label>
        תגיות
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="מחסן עצים, גימור שמן, חיבורים"
          list="known-tags"
        />
        <datalist id="known-tags">
          {knownTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </label>
      <p className="muted small">מפרידים בפסיק. תגית שכבר השתמשת בה תוצע להשלמה.</p>

      <div className="row">
        <label>
          תאריך
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        {projects.length > 0 && (
          <label>
            פרויקט
            <select value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">ללא פרויקט</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="submit" disabled={busy || !text.trim()}>
          {busy ? 'שומר…' : 'שמירה'}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          ביטול
        </button>
        {editing && (
          <button type="button" className="danger" onClick={handleDelete} disabled={busy}>
            מחיקה
          </button>
        )}
      </div>
    </form>
  )
}
