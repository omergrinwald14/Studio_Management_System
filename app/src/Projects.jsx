import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { STAGES, DONE } from './lib/stages'
import ProjectForm from './ProjectForm'

// The projects screen: every job, its client, and where it sits in the pipeline.
export default function Projects() {
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Both lists are needed before the screen means anything, so fetch them
    // together rather than in sequence — two round trips at once, not one after
    // the other. A join would also work; kept separate because the form needs
    // the full client list anyway.
    Promise.all([
      supabase
        .from('projects')
        .select('id, name, client_id, stage, price, opened, due, days, planned_days, lost')
        .order('id', { ascending: false }),
      supabase.from('clients').select('id, name, phone').order('name'),
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

  function clientName(id) {
    const client = clients.find((c) => c.id === id)
    return client ? client.name : ''
  }

  if (loading) return <p>טוען פרויקטים…</p>

  return (
    <>
      {error && <p className="error">{error}</p>}

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

      {projects.length === 0 ? (
        <p className="muted">אין פרויקטים עדיין</p>
      ) : (
        <ul className="projects">
          {projects.map((project) => (
            <li key={project.id}>
              <div className="head">
                <span className="name">{project.name}</span>
                {project.price != null && (
                  <span className="num">{formatMoney(project.price)}</span>
                )}
              </div>
              <div className="sub muted">
                {clientName(project.client_id)}
                {project.lost && <span className="tag">הצעה נדחתה</span>}
              </div>
              {/* nine segments, filled up to the current stage: progress is read
                  at a glance instead of parsed from a label */}
              <div className="pipeline" aria-hidden="true">
                {STAGES.map((label, index) => (
                  <span
                    key={label}
                    className={index <= project.stage ? 'seg on' : 'seg'}
                  />
                ))}
              </div>
              <div className="sub muted">
                {project.stage === DONE ? 'הושלם' : STAGES[project.stage]}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
