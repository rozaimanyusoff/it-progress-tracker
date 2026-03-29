'use client'

import { useState, useEffect } from 'react'
import TaskUpdateModal from './TaskUpdateModal'

interface Task {
  id: number
  title: string
  status: string
  time_started_at: string | null
  time_spent_seconds: number
  assignee: { id: number; name: string } | null
  feature: {
    id: number
    title: string
    module: { id: number; title: string } | null
    project: { id: number; title: string }
  }
}

interface Project { id: number; title: string }
interface Feature { id: number; title: string }
interface Module  { id: number; title: string; features: Feature[] }
interface Member  { id: number; name: string }

type BoardState = Record<string, Task[]>

// ── Add Task Modal ────────────────────────────────────────────────
function AddTaskModal({
  projects,
  onClose,
  onAdded,
}: {
  projects: Project[]
  onClose: () => void
  onAdded: (task: Task) => void
}) {
  const [modules, setModules]     = useState<Module[]>([])
  const [features, setFeatures]   = useState<Feature[]>([])
  const [members, setMembers]     = useState<Member[]>([])
  const [projectId, setProjectId] = useState('')
  const [moduleId, setModuleId]   = useState('')
  const [featureId, setFeatureId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [title, setTitle]         = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setMembers)
  }, [])

  useEffect(() => {
    setModules([]); setFeatures([]); setModuleId(''); setFeatureId('')
    if (!projectId) return
    Promise.all([
      fetch(`/api/modules?project_id=${projectId}`).then(r => r.json()),
      fetch(`/api/features?project_id=${projectId}`).then(r => r.json()),
    ]).then(([modData, featData]) => {
      setModules(modData.map((m: any) => ({
        id: m.id, title: m.title,
        features: (m.features ?? []).map((f: any) => ({ id: f.id, title: f.title })),
      })))
      setFeatures(featData.filter((f: any) => !f.module_id).map((f: any) => ({ id: f.id, title: f.title })))
    })
  }, [projectId])

  const visibleFeatures = modules.length > 0
    ? (moduleId ? (modules.find(m => m.id === Number(moduleId))?.features ?? []) : [])
    : features

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!featureId) { setError('Please select a feature.'); return }
    if (!title.trim()) { setError('Task title is required.'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feature_id: Number(featureId),
        title: title.trim(),
        description: description.trim() || null,
        assigned_to: assigneeId ? Number(assigneeId) : null,
      }),
    })
    if (!res.ok) {
      setError((await res.json()).error || 'Failed to create task')
      setSaving(false); return
    }
    const task = await res.json()
    onAdded(task)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project *</label>
            <select className={inputClass} value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          {projectId && modules.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Module *</label>
              <select className={inputClass} value={moduleId} onChange={e => { setModuleId(e.target.value); setFeatureId('') }}>
                <option value="">Select module...</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          )}

          {projectId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Feature *</label>
              <select className={inputClass} value={featureId} onChange={e => setFeatureId(e.target.value)}>
                <option value="">Select feature...</option>
                {visibleFeatures.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Task Title *</label>
            <input className={inputClass} placeholder="e.g. Implement login endpoint" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea className={`${inputClass} resize-none`} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assign to</label>
            <select className={inputClass} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors">
              {saving ? 'Adding...' : 'Add Task'}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 py-2 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: 'Todo',       label: 'To Do',       color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' },
  { id: 'InProgress', label: 'In Progress', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' },
  { id: 'InReview',   label: 'To Review',   color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' },
  { id: 'Done',       label: 'Done',        color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
]

function buildBoard(tasks: Task[]): BoardState {
  const board: BoardState = { Todo: [], InProgress: [], InReview: [], Done: [] }
  for (const t of tasks) {
    if (board[t.status]) board[t.status].push(t)
    else board['Todo'].push(t)
  }
  return board
}

function getElapsedSeconds(task: Task): number {
  let total = task.time_spent_seconds
  if (task.status === 'InProgress' && task.time_started_at) {
    total += Math.floor((Date.now() - new Date(task.time_started_at).getTime()) / 1000)
  }
  return total
}

function formatElapsed(seconds: number): string {
  if (seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${seconds % 60}s`
}

function AssigneeAvatar({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-semibold shrink-0">
      {name[0].toUpperCase()}
    </span>
  )
}

export default function TeamKanbanBoard() {
  const [board, setBoard]     = useState<BoardState>({ Todo: [], InProgress: [], InReview: [], Done: [] })
  const [loading, setLoading] = useState(true)
  const [, setTick]           = useState(0)

  // Filter state
  const [projects, setProjects]     = useState<Project[]>([])
  const [features, setFeatures]     = useState<Feature[]>([])
  const [projectId, setProjectId]   = useState('')
  const [featureId, setFeatureId]   = useState('')

  // Modal
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // Tick every second for InProgress timers
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Load projects for filter
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: any[]) => setProjects(data.map(p => ({ id: p.id, title: p.title }))))
  }, [])

  // Load features when project changes
  useEffect(() => {
    setFeatureId('')
    if (!projectId) { setFeatures([]); return }
    fetch(`/api/features?project_id=${projectId}`)
      .then(r => r.json())
      .then((data: any[]) => setFeatures(data.map(f => ({ id: f.id, title: f.title }))))
  }, [projectId])

  // Load tasks
  useEffect(() => {
    loadTasks()
  }, [projectId, featureId])

  function loadTasks() {
    setLoading(true)
    const params = new URLSearchParams()
    if (projectId) params.set('project_id', projectId)
    if (featureId) params.set('feature_id', featureId)
    fetch(`/api/tasks/team?${params}`)
      .then(r => r.json())
      .then((tasks: Task[]) => { setBoard(buildBoard(tasks)); setLoading(false) })
  }

  function handleTaskAdded(task: Task) {
    setBoard(prev => ({ ...prev, Todo: [...prev.Todo, task] }))
  }

  function handleStatusChange(taskId: number, newStatus: string) {
    setBoard(prev => {
      const next: BoardState = {}
      for (const col of COLUMNS) next[col.id] = [...prev[col.id]]
      for (const col of COLUMNS) {
        const task = next[col.id].find(t => t.id === taskId)
        if (task) {
          next[col.id] = next[col.id].filter(t => t.id !== taskId)
          next[newStatus] = [...next[newStatus], { ...task, status: newStatus }]
          break
        }
      }
      return next
    })
  }

  const activeTask = activeTaskId !== null
    ? COLUMNS.flatMap(c => board[c.id]).find(t => t.id === activeTaskId) ?? null
    : null

  const totalTasks = COLUMNS.reduce((s, c) => s + board[c.id].length, 0)

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          className="text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>

        <select
          value={featureId}
          onChange={e => setFeatureId(e.target.value)}
          disabled={!projectId}
          className="text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
        >
          <option value="">All Features</option>
          {features.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>

        {(projectId || featureId) && (
          <button
            onClick={() => { setProjectId(''); setFeatureId('') }}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-4 gap-4 items-start">
          {COLUMNS.map(col => (
            <div key={col.id} className="flex flex-col">
              {/* Column header */}
              <div className={`rounded-lg px-3 py-2 mb-3 flex items-center justify-between ${col.color}`}>
                <span className="font-semibold text-sm">{col.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium opacity-70">{board[col.id].length}</span>
                  {col.id === 'Todo' && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="w-5 h-5 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold leading-none"
                      title="Add task"
                    >+</button>
                  )}
                </div>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-32">
                {board[col.id].length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-slate-100 dark:border-navy-700 py-6 text-center text-xs text-slate-300 dark:text-slate-600">
                    No tasks
                  </div>
                )}
                {board[col.id].map(task => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <p className="font-medium text-sm text-slate-800 dark:text-white leading-snug">{task.title}</p>

                    {task.feature.module && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5 truncate font-medium">{task.feature.module.title}</p>
                    )}
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 truncate">{task.feature.title}</p>
                    <p className="text-xs text-slate-400 truncate">{task.feature.project.title}</p>

                    {/* Timer */}
                    {(() => {
                      const s = getElapsedSeconds(task)
                      const running = task.status === 'InProgress'
                      if (s <= 0 && !running) return null
                      return (
                        <span className="flex items-center gap-1 mt-1">
                          {running && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                            </span>
                          )}
                          <span className={`text-xs font-mono tabular-nums ${running ? 'text-orange-500 dark:text-orange-400' : 'text-slate-400'}`}>
                            {running ? formatElapsed(s) : `⏱ ${formatElapsed(s)}`}
                          </span>
                        </span>
                      )
                    })()}

                    {/* Assignee + Update */}
                    <div className="flex items-center justify-between mt-2 gap-1">
                      {task.assignee ? (
                        <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                          <AssigneeAvatar name={task.assignee.name} />
                          <span className="truncate">{task.assignee.name}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600 italic">Unassigned</span>
                      )}
                      <button
                        onClick={() => setActiveTaskId(task.id)}
                        className="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 shrink-0"
                      >
                        Update
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddTaskModal
          projects={projects}
          onClose={() => setShowAddModal(false)}
          onAdded={handleTaskAdded}
        />
      )}

      {activeTask && (
        <TaskUpdateModal
          taskId={activeTask.id}
          taskTitle={activeTask.title}
          moduleTitle={activeTask.feature.module?.title ?? null}
          featureTitle={activeTask.feature.title}
          projectTitle={activeTask.feature.project.title}
          currentStatus={activeTask.status}
          onClose={() => setActiveTaskId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
