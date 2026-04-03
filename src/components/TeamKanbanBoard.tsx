'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import TaskUpdateModal from './TaskUpdateModal'
import { Trash2, X } from 'lucide-react'
import StatusChangeModal, { StatusTarget } from './StatusChangeModal'

interface Task {
  id: number
  title: string
  status: string
  review_count: number
  time_started_at: string | null
  time_spent_seconds: number
  assignee: { id: number; name: string } | null
  due_date: string | null
  est_mandays: number | null
  priority: string
  is_blocked: boolean
  blocked_reason: string | null
  context: {
    type: 'feature' | 'deliverable'
    id: number
    title: string
    module: { id: number; title: string } | null
    project: { id: number; title: string }
  }
}

interface Project { id: number; title: string }
interface Feature { id: number; title: string }
interface Deliverable { id: number; title: string; planned_end: string | null }
interface Module { id: number; title: string; features: Feature[] }
interface Member { id: number; name: string }

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
  const [modules, setModules] = useState<Module[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [projectId, setProjectId] = useState('')
  const [moduleId, setModuleId] = useState('') // '' = no module selected, '__none__' = project-level
  const [deliverableId, setDeliverableId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [estMandays, setEstMandays] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  const hasModules = modules.length > 0

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setMembers)
  }, [])

  useEffect(() => {
    setModules([]); setDeliverables([]); setModuleId(''); setDeliverableId('')
    if (!projectId) return
    fetch(`/api/modules?project_id=${projectId}`).then(r => r.json()).then((modData: any[]) => {
      setModules(modData)
    })
  }, [projectId])

  useEffect(() => {
    setDeliverableId('')
    if (!projectId) return
    const params = new URLSearchParams()
    // filter deliverables by module or project-level
    fetch(`/api/projects/${projectId}/deliverables`).then(r => r.json()).then((data: any[]) => {
      if (moduleId === '__none__') {
        setDeliverables(data.filter((d: any) => !d.module_id).map((d: any) => ({ id: d.id, title: d.title, planned_end: d.planned_end ?? null })))
      } else if (moduleId) {
        setDeliverables(data.filter((d: any) => d.module_id === Number(moduleId)).map((d: any) => ({ id: d.id, title: d.title, planned_end: d.planned_end ?? null })))
      } else {
        setDeliverables(data.map((d: any) => ({ id: d.id, title: d.title, planned_end: d.planned_end ?? null })))
      }
    })
  }, [projectId, moduleId])

  // Auto-fill due date from deliverable.planned_end
  useEffect(() => {
    if (!deliverableId) return
    const deliv = deliverables.find(d => d.id === Number(deliverableId))
    if (deliv?.planned_end) setDueDate(deliv.planned_end.slice(0, 10))
  }, [deliverableId])

  const selectedDeliverable = deliverables.find(d => d.id === Number(deliverableId))
  const delivPlannedEnd = selectedDeliverable?.planned_end ? new Date(selectedDeliverable.planned_end) : null
  const dueDateVal = dueDate ? new Date(dueDate) : null
  const dueDateExceeds = delivPlannedEnd && dueDateVal && dueDateVal > delivPlannedEnd

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!deliverableId) { setError('Please select a deliverable.'); return }
    if (!title.trim()) { setError('Task title is required.'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliverable_id: Number(deliverableId),
        title: title.trim(),
        description: description.trim() || null,
        assigned_to: assigneeId ? Number(assigneeId) : null,
        due_date: dueDate || null,
        priority,
        est_mandays: estMandays ? Number(estMandays) : null,
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 leading-none"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Project */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project *</label>
            <select className={inputClass} value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          {/* 2. Module — conditional */}
          {projectId && hasModules && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Module</label>
              <select className={inputClass} value={moduleId} onChange={e => { setModuleId(e.target.value); setDeliverableId('') }}>
                <option value="">Select module...</option>
                <option value="__none__">— No module (project level) —</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              {moduleId === '__none__' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Best practice: assign deliverable to a module. Only select this if deliverable is project-level.
                </p>
              )}
            </div>
          )}

          {/* 3. Deliverable */}
          {projectId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deliverable *</label>
              <select className={inputClass} value={deliverableId} onChange={e => setDeliverableId(e.target.value)}>
                <option value="">Select deliverable...</option>
                {deliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          )}

          {/* 4. Task Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Task Title *</label>
            <input className={inputClass} placeholder="e.g. Implement login endpoint" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* 5. Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea className={`${inputClass} resize-none`} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* 6. Assign to */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assign to *</label>
            <select className={inputClass} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* 7. Due date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due date</label>
            <input type="date" className={inputClass} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            {dueDateExceeds && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Due date exceeds deliverable end date</p>
            )}
          </div>

          {/* 8. Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
            <select className={inputClass} value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* 9. Est. Mandays */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Est. Mandays <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="number" min="0.5" step="0.5" className={inputClass} placeholder="e.g. 1.5" value={estMandays} onChange={e => setEstMandays(e.target.value)} />
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
  { id: 'Todo', label: 'To Do', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' },
  { id: 'InProgress', label: 'In Progress', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' },
  { id: 'InReview', label: 'To Review', color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' },
  { id: 'Done', label: 'Done', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
]

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

function dueDateDisplay(due: string | null, status: string): React.ReactNode {
  if (!due) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(due); d.setHours(0, 0, 0, 0)
  const isDone = status === 'Done'
  const dateStr = d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
  if (!isDone && d < today)
    return <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">{dateStr} · Overdue</span>
  if (!isDone && d.getTime() === today.getTime())
    return <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{dateStr} · Due today</span>
  return <span className="text-[10px] text-slate-400">{dateStr}</span>
}

function reviewCardStyle(task: { status: string; review_count: number; is_blocked?: boolean }): string {
  if (task.is_blocked)
    return 'bg-red-50/50 dark:bg-red-950/10 border border-red-200 dark:border-red-800/40 border-l-[3px] border-l-red-500'
  if (task.status === 'Done')
    return 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 border-l-[3px] border-l-green-400'
  if (task.status === 'InReview' && task.review_count > 0)
    return 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-700/60 border-l-[3px] border-l-yellow-400'
  if (task.status !== 'Todo' && task.status !== 'InReview' && task.review_count > 0)
    return 'bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/50 border-l-[3px] border-l-orange-400'
  return 'bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700'
}

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
  const { data: session } = useSession()
  const isManager = (session?.user as any)?.role === 'manager'
  const currentUserId = Number((session?.user as any)?.id)
  const [board, setBoard] = useState<BoardState>({ Todo: [], InProgress: [], InReview: [], Done: [] })
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

  // Filter state
  const [projects, setProjects] = useState<Project[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [projectId, setProjectId] = useState('')
  const [featureId, setFeatureId] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  // Modal
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<{ taskId: number; target: StatusTarget } | null>(null)

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

  function getFilteredBoard(): BoardState {
    if (!filterPriority) return board
    const next: BoardState = {}
    for (const col of COLUMNS) {
      next[col.id] = board[col.id].filter(t => t.priority === filterPriority)
    }
    return next
  }

  function handleTaskAdded(task: Task) {
    setBoard(prev => ({ ...prev, Todo: [...prev.Todo, task] }))
  }

  async function handleDeleteTask(taskId: number, taskTitle: string) {
    setDeleteConfirm({ id: taskId, title: taskTitle })
  }

  async function confirmDeleteTask() {
    if (!deleteConfirm) return
    setDeleting(true)
    const res = await fetch(`/api/tasks/${deleteConfirm.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setBoard(prev => {
        const next: BoardState = {}
        for (const col of COLUMNS) next[col.id] = prev[col.id].filter(t => t.id !== deleteConfirm.id)
        return next
      })
      setDeleteConfirm(null)
    }
  }

  function handleStatusChange(taskId: number, newStatus: string) {
    setBoard(prev => {
      const next: BoardState = {}
      for (const col of COLUMNS) next[col.id] = [...prev[col.id]]
      for (const col of COLUMNS) {
        const task = next[col.id].find(t => t.id === taskId)
        if (task) {
          next[col.id] = next[col.id].filter(t => t.id !== taskId)
          const targetCol = next[newStatus] ? newStatus : 'Todo'
          next[targetCol] = [...next[targetCol], { ...task, status: newStatus }]
          break
        }
      }
      return next
    })
  }

  const activeTask = activeTaskId !== null
    ? COLUMNS.flatMap(c => board[c.id]).find(t => t.id === activeTaskId) ?? null
    : null

  const filteredBoard = getFilteredBoard()
  const totalTasks = COLUMNS.reduce((s, c) => s + filteredBoard[c.id].length, 0)
  const [showLegend, setShowLegend] = useState(false)

  const pendingTask = pendingStatus
    ? COLUMNS.flatMap(c => board[c.id]).find(t => t.id === pendingStatus.taskId) ?? null
    : null

  async function doStatusUpdate(taskId: number, newStatus: string, opts: { actual_date?: string; blocked_reason?: string }) {
    const payload: any = { status: newStatus }
    if (opts.actual_date) payload.actual_date = opts.actual_date
    if (opts.blocked_reason) payload.blocked_reason = opts.blocked_reason

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated = await res.json()
      handleStatusChange(updated.id, updated.status)
    }
  }

  function handlePopupConfirm(taskId: number, newStatus: string, opts: { actual_date?: string; blocked_reason?: string }) {
    setPendingStatus(null)
    doStatusUpdate(taskId, newStatus, opts)
  }

  return (
    <>
      {pendingStatus && pendingTask && (
        <StatusChangeModal
          taskId={pendingTask.id}
          taskTitle={pendingTask.title}
          targetStatus={pendingStatus.target}
          actualStartDate={(pendingTask as any).actual_start ?? null}
          dueDate={pendingTask.due_date}
          onConfirm={handlePopupConfirm}
          onCancel={() => setPendingStatus(null)}
        />
      )}
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

          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {(projectId || featureId || filterPriority) && (
            <button
              onClick={() => { setProjectId(''); setFeatureId(''); setFilterPriority('') }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
          <div className="relative">
            <button
              onClick={() => setShowLegend(v => !v)}
              className={`w-6 h-6 rounded-full text-xs font-bold border transition-colors ${showLegend ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-navy-600 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
              title="Show legend"
            >?</button>

            {/* Legend popover */}
            {showLegend && (
              <>
                {/* Backdrop to close on outside click */}
                <div className="fixed inset-0 z-40" onClick={() => setShowLegend(false)} />
                <div className="absolute right-0 top-8 z-50 w-[620px] max-w-[90vw] rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl p-4 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-white mb-3 text-sm">Board Legend</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                    {/* Card colours */}
                    <div>
                      <p className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px] mb-2">Card Colours</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-8 rounded border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shrink-0" />
                          <span>Normal — not yet reviewed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-8 rounded border border-orange-200 bg-orange-50 border-l-[3px] border-l-orange-400 shrink-0" />
                          <span>Reviewed &amp; sent back — fixes required</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-8 rounded border border-yellow-300 bg-yellow-50 border-l-[3px] border-l-yellow-400 shrink-0" />
                          <span>Re-submitted after rejection — awaiting re-review</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-8 rounded border border-green-200 bg-green-50 border-l-[3px] border-l-green-400 shrink-0" />
                          <span>Approved &amp; done</span>
                        </div>
                      </div>
                    </div>

                    {/* Badges */}
                    <div>
                      <p className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px] mb-2">Badges</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-600 whitespace-nowrap">↩ 2</span>
                          <span>Reviewed N times (rejected back)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-600 border border-orange-200 whitespace-nowrap">↩ 1×</span>
                          <span>Review count in modal header</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-600 uppercase whitespace-nowrap">REVIEW</span>
                          <span>Manager review entry in history</span>
                        </div>
                      </div>
                    </div>

                    {/* Role permissions */}
                    <div>
                      <p className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px] mb-2">Permissions</p>
                      <div className="space-y-2">
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-200 mb-0.5">Developer</p>
                          <ul className="space-y-0.5 text-slate-500 dark:text-slate-400">
                            <li>✓ Submit progress notes &amp; attachments</li>
                            <li>✓ Submit for Review (note + attachment required)</li>
                            <li>✓ Move tasks with ← → arrows</li>
                            <li>✓ Delete own To Do tasks (custom only)</li>
                            <li>✗ Cannot skip directly from To Do to To Review</li>
                            <li>✗ Cannot update tasks in To Review</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-200 mb-0.5">Manager</p>
                          <ul className="space-y-0.5 text-slate-500 dark:text-slate-400">
                            <li>✓ Add notes to To Do &amp; In Progress tasks</li>
                            <li>✓ Delete any To Do task (custom only)</li>
                            <li>✓ Approve or reject tasks in To Review</li>
                            <li>✓ View update history on any task</li>
                            <li>✓ Attach evidence &amp; log findings on reject</li>
                            <li>✗ Cannot submit progress as developer</li>
                            <li>✗ Cannot submit task for review</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </>
            )}
          </div>
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
                    <span className="text-xs font-medium opacity-70">{filteredBoard[col.id].length}</span>
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
                  {filteredBoard[col.id].length === 0 && (
                    <div className="rounded-lg border-2 border-dashed border-slate-100 dark:border-navy-700 py-6 text-center text-xs text-slate-300 dark:text-slate-600">
                      No tasks
                    </div>
                  )}
                  {filteredBoard[col.id].map(task => (
                    <div
                      key={task.id}
                      className={`rounded-lg p-3 shadow-sm hover:shadow-md transition-all ${reviewCardStyle(task)}`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-0.5">
                        <p className="font-medium text-sm text-slate-800 dark:text-white leading-snug">{task.title}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          {task.review_count > 0 && task.status !== 'Todo' && (
                            <span
                              title={`Reviewed ${task.review_count} time${task.review_count > 1 ? 's' : ''}`}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 whitespace-nowrap"
                            >
                              ↩ {task.review_count}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium}`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                      {task.is_blocked && (
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">🚫 Blocked</span>
                          {task.blocked_reason && <span className="text-[10px] text-red-400 dark:text-red-500 italic truncate">{task.blocked_reason}</span>}
                        </div>
                      )}

                      {task.context.module && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5 truncate font-medium">{task.context.module.title}</p>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[10px] px-1 py-px rounded font-semibold uppercase ${task.context.type === 'deliverable' ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                          {task.context.type === 'deliverable' ? 'Deliv' : 'Feat'}
                        </span>
                        <p className="text-xs text-blue-600 dark:text-blue-400 truncate">{task.context.title}</p>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{task.context.project.title}</p>

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

                      {/* Due date */}
                      {task.due_date && (
                        <div className="mt-1">{dueDateDisplay(task.due_date, task.status)}</div>
                      )}

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
                        <div className="flex items-center gap-1 shrink-0">
                          {task.status === 'Todo' && (isManager || task.assignee?.id === currentUserId) && (
                            <button
                              onClick={() => handleDeleteTask(task.id, task.title)}
                              className="p-1 rounded border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {task.status === 'InReview' && (
                            <button
                              onClick={() => setActiveTaskId(task.id)}
                              className="text-xs px-2 py-0.5 rounded border border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 font-medium"
                            >
                              Review
                            </button>
                          )}
                          {isManager && task.status !== 'InReview' && (
                            <button
                              onClick={() => setActiveTaskId(task.id)}
                              className={`text-xs px-2 py-0.5 rounded border ${task.status === 'Todo' || task.status === 'InProgress'
                                ? 'border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium'
                                : 'border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700'
                                }`}
                            >
                              {task.status === 'Todo' || task.status === 'InProgress' ? 'Update' : 'View'}
                            </button>
                          )}
                        </div>
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

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-sm rounded-2xl p-6 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Delete Task</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Delete <span className="font-medium text-slate-700 dark:text-slate-300">"{deleteConfirm.title}"</span>? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={confirmDeleteTask}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 py-2 rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTask && (
          <TaskUpdateModal
            taskId={activeTask.id}
            taskTitle={activeTask.title}
            moduleTitle={activeTask.context.module?.title ?? null}
            featureTitle={activeTask.context.title}
            projectTitle={activeTask.context.project.title}
            currentStatus={activeTask.status}
            reviewCount={activeTask.review_count}
            onClose={() => { setActiveTaskId(null); loadTasks() }}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </>
  )
}
