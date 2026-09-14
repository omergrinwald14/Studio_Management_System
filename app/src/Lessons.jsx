import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatDate } from './lib/format'
import { useCached, isCached } from './lib/cache'
import LessonForm from './LessonForm'

// The lessons library: everything he has learned, across every job, in one
// place he can search. The spec asked for exactly this and for a reason worth
// keeping in mind — a lesson filed under the project it came from is a lesson
// he will never find again, because he does not remember which bench it was.
//
// `projectId` narrows it to one job, which is how the project card uses it.
export default function Lessons({ projectId = null }) {
  const scope = projectId ? `lessons:project:${projectId}` : 'lessons:all'
  const [lessons, setLessons] = useCached(scope, [])
  const [projects, setProjects] = useCached('lessons:projects', [])
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!isCached(scope))

  useEffect(() => {
    const lessonQuery = supabase
      .from('lessons')
      .select('id, project_id, date, text, tags')
      .order('date', { ascending: false })
      .order('id', { ascending: false })

    Promise.all([
      projectId ? lessonQuery.eq('project_id', projectId) : lessonQuery,
      supabase.from('projects').select('id, name').order('id', { ascending: false }),
    ]).then(([lessonsResult, projectsResult]) => {
      const failure = lessonsResult.error || projectsResult.error
      if (failure) setError(failure.message)
      else {
        setLessons(lessonsResult.data)
        setProjects(projectsResult.data)
      }
      setLoading(false)
    })
  }, [projectId, scope, setLessons, setProjects])

  if (loading) return <p>טוען לקחים…</p>

  const knownTags = [...new Set(lessons.flatMap((lesson) => lesson.tags))].sort((a, b) =>
    a.localeCompare(b, 'he'),
  )

  function projectName(id) {
    const project = projects.find((p) => p.id === id)
    return project ? project.name : null
  }

  const term = query.trim()
  const visible = lessons.filter((lesson) => {
    if (tag && !lesson.tags.includes(tag)) return false
    if (!term) return true
    // the project name is searched too: "what did I learn on the Maya bench"
    return [lesson.text, projectName(lesson.project_id), ...lesson.tags]
      .filter(Boolean)
      .join(' ')
      .includes(term)
  })

  function handleSaved(saved) {
    setLessons([saved, ...lessons.filter((item) => item.id !== saved.id)])
    setEditing(null)
  }

  return (
    <>
      {error && <p className="error">{error}</p>}

      {editing ? (
        <LessonForm
          lesson={editing}
          projectId={projectId}
          projects={projectId ? [] : projects}
          knownTags={knownTags}
          onSaved={handleSaved}
          onDeleted={(id) => {
            setLessons(lessons.filter((item) => item.id !== id))
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" className="add-toggle" onClick={() => setEditing({})}>
          + לקח חדש
        </button>
      )}

      {lessons.length > 0 && (
        <>
          <label className="search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש בלקחים"
            />
          </label>

          {knownTags.length > 0 && (
            <div className="chips wrap">
              <button
                type="button"
                className={`chip${tag === '' ? ' on' : ''}`}
                onClick={() => setTag('')}
              >
                הכל
              </button>
              {knownTags.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`chip${tag === name ? ' on' : ''}`}
                  onClick={() => setTag(tag === name ? '' : name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {visible.length === 0 ? (
        <p className="muted">{lessons.length ? 'אין התאמה לחיפוש' : 'עוד לא נרשמו לקחים'}</p>
      ) : (
        <ul className="rows">
          {visible.map((lesson) => (
            <li key={lesson.id} className="stacked">
              <button type="button" className="row-btn column" onClick={() => setEditing(lesson)}>
                <span className="what">
                  <span className="lesson-text">{lesson.text}</span>
                  <span className="cat">
                    {[formatDate(lesson.date), projectName(lesson.project_id)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {lesson.tags.length > 0 && (
                  <span className="lesson-tags">
                    {lesson.tags.map((name) => (
                      <span key={name} className="tag">
                        {name}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
