import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { STAGES, DONE } from './lib/stages'
import ProjectForm from './ProjectForm'
import ProjectCard from './ProjectCard'

const FILTERS = [
  { id: 'live', label: 'פעילים' },
  { id: 'done', label: 'הושלמו' },
  { id: 'all', label: 'הכל' },
]

// The projects screen: every job, its client, and where it sits in the pipeline.
// Tapping one opens its card in place.
export default function Projects() {
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [openId, setOpenId] = useState(null)
  const [filter, setFilter] = useState('live')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Both lists are needed before the screen means anything, so fetch them
    // together rather than in sequence. A join would also work; kept separate
    // because the form needs the full client list anyway.
    Promise.all([
      supabase
        .from('projects')
        .select('id, name, client_id, stage, price, opened, due, days, planned_days, lost')
        .order('id', { ascending: false }),
      supabase.from('clients').select('id, name, phone, address').order('name'),
    ]).then(([projectsResult, clientsResult]) => {
      const failure = projectsResult.error || clientsResult.error
      if (failure) setError(failure.message)
      else {
        setProjects(projectsResult.data)
        setClients(clientsResult.data)
      }
      setLoading(false)
    })
  }, [])

  function findClient(id) {
    return clients.find((client) => client.id === id)
  }

  function handleChanged(updated) {
    setProjects(projects.map((project) => (project.id === updated.id ? updated : project)))
  }

  if (loading) return <p>טוען פרויקטים…</p>

  const open = projects.find((project) => project.id === openId)
  if (open) {
    return (
      <ProjectCard
        project={open}
        client={findClient(open.client_id)}
        onBack={() => setOpenId(null)}
        onChanged={handleChanged}
      />
    )
  }

  const visible = projects.filter((project) => {
    if (filter === 'live') return !project.lost && project.stage < DONE
    if (filter === 'done') return project.stage === DONE
    return true
  })

  return (
    <>
      {error && <p className="error">{error}</p>}

      <div className="chips">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip${filter === option.id ? ' on' : ''}`}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {adding ? (
        <ProjectForm
          clients={clients}
          onSaved={(project) => {
            setProjects([project, ...projects])
            setAdding(false)
          }}
          onClientAdded={(client) => setClients([...clients, client])}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button type="button" className="add-toggle" onClick={() => setAdding(true)}>
          + פרויקט חדש
        </button>
      )}

      {visible.length === 0 ? (
        <p className="muted">אין פרויקטים להצגה</p>
      ) : (
        <ul className="projects">
          {visible.map((project) => {
            const client = findClient(project.client_id)
            return (
              <li key={project.id}>
                <button type="button" className="row-btn" onClick={() => setOpenId(project.id)}>
                  <span className="what">
                    <span className="head">
                      <span className="name">{project.name}</span>
                      {project.price != null && (
                        <span className="num">{formatMoney(project.price)}</span>
                      )}
                    </span>
                    <span className="cat">
                      {client ? client.name : ''}
                      {project.lost && <span className="tag">הצעה נדחתה</span>}
                    </span>
                    {/* nine segments, filled up to the current stage: progress is
                        read at a glance instead of parsed from a label */}
                    <span className="pipeline" aria-hidden="true">
                      {STAGES.map((label, index) => (
                        <span key={label} className={index <= project.stage ? 'seg on' : 'seg'} />
                      ))}
                    </span>
                    <span className="cat">{STAGES[project.stage]}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
