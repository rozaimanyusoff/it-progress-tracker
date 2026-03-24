'use client'

import { useState, useEffect, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import TaskUpdateModal from './TaskUpdateModal'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Project { id: number; title: string; status: string }
interface Feature { id: number; title: string }

interface Task {
  id: number
  title: string
  status: string
  is_predefined: boolean
  feature: { id: number; title: string; project: { id: number; title: string } }
}

interface Issue {
  id: number
  title: string
  description: string | null
  response: string | null
  severity: string
  resolved: boolean
  created_at: string
  user: { name: string }
}

type BoardState = Record<string, Task[]>

// ─── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS: { id: string; label: string; headerClass: string; dotColor: string }[] = [
  { id: 'Todo',       label: 'To Do',       headerClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',       dotColor: 'bg-slate-400' },
  { id: 'InProgress', label: 'In Progress', headerClass: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300', dotColor: 'bg-orange-400' },
  { id: 'InReview',   label: 'In Review',   headerClass: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300', dotColor: 'bg-yellow-400' },
  { id: 'Done',       label: 'Done',        headerClass: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',     dotColor: 'bg-green-400' },
]

const SEVERITY_COLOR: Record<string, string> = {
  high:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  low:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildBoard(tasks: Task[]): BoardState {
  const board: BoardState = { Todo: [], InProgress: [], InReview: [], Done: [] }
  for (const task of tasks) {
    if (board[task.status]) board[task.status].push(task)
    else board['Todo'].push(task)
  }
  return board
}

function findTask(board: BoardState, taskId: number): Task | undefined {
  for (const col of COLUMNS) {
    const found = board[col.id].find((t) => t.id === taskId)
    if (found) return found
  }
}

// ─── Project Selector ──────────────────────────────────────────────────────────

function ProjectSelector({
  projects, selectedId, onChange,
}: { projects: Project[]; selectedId: number | null; onChange: (id: number | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        onClick={() => onChange(null)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
          selectedId === null
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500'
        }`}
      >
        All Tasks
      </button>
      {projects.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          title={p.title}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors max-w-[180px] truncate ${
            selectedId === p.id
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500'
          }`}
        >
          {p.title}
        </button>
      ))}
    </div>
  )
}

// ─── Add Task Card ─────────────────────────────────────────────────────────────

function AddTaskCard({ features, userId, onAdded }: {
  features: Feature[]; userId: number; onAdded: (task: Task) => void
}) {
  const [open, setOpen] = useState(false)
  const [featureId, setFeatureId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const ic = 'w-full bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  async function handleAdd() {
    if (!title.trim()) { setError('Task title is required.'); return }
    if (!featureId) { setError('Select a module / feature.'); return }
    setAdding(true); setError('')
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_id: Number(featureId), title: title.trim(), description: description.trim() || null, assigned_to: userId }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
      const task = await res.json()
      onAdded(task)
      setTitle(''); setDescription(''); setFeatureId(''); setOpen(false)
    } catch (e: any) { setError(e.message) }
    finally { setAdding(false) }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full mt-2 py-2.5 border-2 border-dashed border-slate-200 dark:border-navy-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-lg text-xs text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
      >
        + Add Task
      </button>
    )
  }

  return (
    <div className="mt-2 bg-white dark:bg-navy-800 border border-blue-300 dark:border-blue-700 rounded-xl p-3 space-y-2.5">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">New Task</p>
      <select className={ic} value={featureId} onChange={(e) => setFeatureId(e.target.value)}>
        <option value="">Select module / feature...</option>
        {features.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
      </select>
      <input className={ic} placeholder="Task title *" value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAdd()} />
      <textarea className={`${ic} resize-none`} rows={2} placeholder="Description (optional)"
        value={description} onChange={(e) => setDescription(e.target.value)} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleAdd} disabled={adding}
          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
          {adding ? 'Adding...' : 'Add Task'}
        </button>
        <button onClick={() => { setOpen(false); setError('') }}
          className="px-3 py-1.5 border border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 text-xs rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Issues Panel ──────────────────────────────────────────────────────────────

function IssuesPanel({ issues, onIssueResolved }: {
  issues: Issue[]; onIssueResolved: (id: number) => void
}) {
  const [show, setShow] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [responses, setResponses] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState<number | null>(null)

  if (issues.length === 0) return null

  async function handleRespond(issueId: number, markResolved: boolean) {
    setSubmitting(issueId)
    const response = (responses[issueId] || '').trim()
    try {
      await fetch(`/api/issues/${issueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(markResolved ? { resolved: true } : {}), ...(response ? { response } : {}) }),
      })
      if (markResolved) onIssueResolved(issueId)
      setResponses((prev) => ({ ...prev, [issueId]: '' }))
      if (!markResolved) setExpanded(null)
    } finally { setSubmitting(null) }
  }

  return (
    <div className="mt-6 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
      <button onClick={() => setShow((s) => !s)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Open Issues</span>
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold rounded-full">{issues.length}</span>
        </div>
        <span className="text-slate-400 text-xs">{show ? '▲' : '▼'}</span>
      </button>

      {show && (
        <div className="divide-y divide-slate-100 dark:divide-navy-700 bg-white dark:bg-navy-800">
          {issues.map((issue) => (
            <div key={issue.id}>
              <button
                onClick={() => setExpanded(expanded === issue.id ? null : issue.id)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-700 text-left transition-colors"
              >
                <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLOR[issue.severity] || SEVERITY_COLOR.medium}`}>
                  {issue.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{issue.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    by {issue.user.name} · {new Date(issue.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-slate-400 text-xs shrink-0 mt-0.5">{expanded === issue.id ? '▲' : '▼'}</span>
              </button>

              {expanded === issue.id && (
                <div className="px-4 pb-4 space-y-3 bg-slate-50 dark:bg-navy-900/30">
                  {issue.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg p-3">
                      {issue.description}
                    </p>
                  )}
                  {issue.response && (
                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">Previous Response</p>
                      <p className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap">{issue.response}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Your Response</label>
                    <textarea
                      className="w-full bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                      placeholder="Describe what you have done, the fix applied, or any blocker..."
                      value={responses[issue.id] || ''}
                      onChange={(e) => setResponses((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => handleRespond(issue.id, true)} disabled={submitting === issue.id}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                      {submitting === issue.id ? 'Saving...' : '✓ Respond & Resolve'}
                    </button>
                    <button onClick={() => handleRespond(issue.id, false)}
                      disabled={submitting === issue.id || !(responses[issue.id]?.trim())}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                      Save Response Only
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main KanbanBoard ──────────────────────────────────────────────────────────

export default function KanbanBoard({
  projects = [],
  userId,
}: {
  projects?: Project[]
  userId?: number
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [board, setBoard] = useState<BoardState>({ Todo: [], InProgress: [], InReview: [], Done: [] })
  const [features, setFeatures] = useState<Feature[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)

  const loadTasks = useCallback(async (projectId: number | null) => {
    setLoading(true)
    const url = projectId ? `/api/tasks/my?project_id=${projectId}` : '/api/tasks/my'
    const tasks: Task[] = await fetch(url).then((r) => r.json())
    setBoard(buildBoard(tasks))
    setLoading(false)
  }, [])

  useEffect(() => { loadTasks(selectedProjectId) }, [selectedProjectId, loadTasks])

  useEffect(() => {
    if (selectedProjectId) {
      fetch(`/api/features?project_id=${selectedProjectId}`).then((r) => r.json()).then(setFeatures)
      fetch(`/api/issues?project_id=${selectedProjectId}&resolved=false`)
        .then((r) => r.json()).then((d) => setIssues(Array.isArray(d) ? d : []))
    } else {
      setFeatures([]); setIssues([])
    }
  }, [selectedProjectId])

  async function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    const taskId = Number(draggableId)
    const newStatus = destination.droppableId
    setBoard((prev) => {
      const next: BoardState = {}
      for (const col of COLUMNS) next[col.id] = [...prev[col.id]]
      const task = next[source.droppableId].find((t) => t.id === taskId)!
      next[source.droppableId] = next[source.droppableId].filter((t) => t.id !== taskId)
      next[destination.droppableId].splice(destination.index, 0, { ...task, status: newStatus })
      return next
    })
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function moveTask(taskId: number, currentStatus: string, direction: 'next' | 'prev') {
    const colIds = COLUMNS.map((c) => c.id)
    const idx = colIds.indexOf(currentStatus)
    const newIdx = direction === 'next' ? idx + 1 : idx - 1
    if (newIdx < 0 || newIdx >= colIds.length) return
    const newStatus = colIds[newIdx]
    setBoard((prev) => {
      const next: BoardState = {}
      for (const col of COLUMNS) next[col.id] = [...prev[col.id]]
      const task = next[currentStatus].find((t) => t.id === taskId)!
      next[currentStatus] = next[currentStatus].filter((t) => t.id !== taskId)
      next[newStatus] = [...next[newStatus], { ...task, status: newStatus }]
      return next
    })
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  function handleStatusChange(taskId: number, newStatus: string) {
    setBoard((prev) => {
      const next: BoardState = {}
      for (const col of COLUMNS) next[col.id] = [...prev[col.id]]
      for (const col of COLUMNS) {
        const task = next[col.id].find((t) => t.id === taskId)
        if (task) {
          next[col.id] = next[col.id].filter((t) => t.id !== taskId)
          next[newStatus] = [...next[newStatus], { ...task, status: newStatus }]
          break
        }
      }
      return next
    })
  }

  function handleTaskAdded(task: Task) {
    setBoard((prev) => ({ ...prev, Todo: [task, ...prev.Todo] }))
  }

  const totalTasks = COLUMNS.reduce((sum, col) => sum + board[col.id].length, 0)
  const activeTask = activeTaskId !== null ? findTask(board, activeTaskId) : null

  return (
    <div>
      {/* Project selector */}
      {projects.length > 0 && (
        <ProjectSelector projects={projects} selectedId={selectedProjectId} onChange={setSelectedProjectId} />
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-500 dark:text-slate-400">
          <span className="animate-pulse">Loading tasks...</span>
        </div>
      ) : totalTasks === 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 dark:text-slate-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium text-center">
              {selectedProjectId ? 'No tasks assigned to you in this project.' : 'No tasks assigned to you yet.'}
            </p>
            <p className="text-sm mt-1 text-center">
              {selectedProjectId && features.length > 0 ? 'Add a task below.' : 'Select a project to add tasks.'}
            </p>
          </div>
          {selectedProjectId && features.length > 0 && userId && (
            <div className="max-w-xs mx-auto">
              <AddTaskCard features={features} userId={userId} onAdded={handleTaskAdded} />
            </div>
          )}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto pb-4">
            <div className="grid grid-cols-4 gap-4 items-start min-w-[640px]">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex flex-col">
                  <div className={`rounded-lg px-3 py-2 mb-3 flex items-center justify-between ${col.headerClass}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${col.dotColor}`} />
                      <span className="font-semibold text-sm">{col.label}</span>
                    </div>
                    <span className="text-xs font-medium opacity-70">{board[col.id].length}</span>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex flex-col gap-2 min-h-[80px] rounded-lg p-1 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-transparent'
                        }`}
                      >
                        {board[col.id].map((task, index) => (
                          <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg p-3 shadow-sm select-none transition-shadow ${
                                  snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : 'hover:shadow-md'
                                }`}
                              >
                                <p className="font-medium text-sm text-slate-800 dark:text-white leading-snug">{task.title}</p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 truncate">{task.feature.title}</p>
                                <p className="text-xs text-slate-400 truncate">{task.feature.project.title}</p>
                                {task.is_predefined && (
                                  <span className="inline-block mt-1.5 px-1.5 py-0.5 text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-navy-700 rounded">SDLC</span>
                                )}
                                <div className="flex items-center justify-between mt-2 gap-1">
                                  <div className="flex gap-1">
                                    {col.id !== 'Todo' && (
                                      <button onClick={() => moveTask(task.id, col.id, 'prev')}
                                        className="text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700" title="Back">←</button>
                                    )}
                                    {col.id !== 'Done' && (
                                      <button onClick={() => moveTask(task.id, col.id, 'next')}
                                        className="text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700" title="Forward">→</button>
                                    )}
                                  </div>
                                  <button onClick={() => setActiveTaskId(task.id)}
                                    className="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">Update</button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  {/* Add Task — only in Todo column when project selected */}
                  {col.id === 'Todo' && selectedProjectId && features.length > 0 && userId && (
                    <AddTaskCard features={features} userId={userId} onAdded={handleTaskAdded} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Open Issues panel */}
      <IssuesPanel issues={issues} onIssueResolved={(id) => setIssues((prev) => prev.filter((i) => i.id !== id))} />

      {activeTask && (
        <TaskUpdateModal
          taskId={activeTask.id}
          taskTitle={activeTask.title}
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
