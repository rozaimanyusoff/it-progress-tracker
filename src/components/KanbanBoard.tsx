'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Trash2, X } from 'lucide-react'
import TaskUpdateModal from './TaskUpdateModal'
import StatusChangeModal, { StatusTarget } from './StatusChangeModal'

interface Task {
  id: number
  title: string
  description?: string | null
  dev_category?: string | null
  dev_scope?: string | null
  dev_task?: string | null
  status: string
  is_predefined: boolean
  time_started_at: string | null
  time_spent_seconds: number
  review_count: number
  due_date: string | null
  actual_start?: string | null
  actual_end?: string | null
  est_mandays: number | null
  actual_mandays: number | null
  priority: string
  created_by_name?: string | null
  deliverable_budget_mandays?: number | null
  deliverable_used_mandays?: number | null
  is_blocked: boolean
  blocked_reason: string | null
  assignees: { user: { id: number; name: string } }[]
  project: { id: number; title: string } | null
  module: { id: number; title: string } | null
  feature: { id: number; title: string } | null
  deliverable: { id: number; title: string } | null
  _count?: { issues: number }
}

type BoardState = Record<string, Task[]>

interface Project { id: number; title: string }
interface Deliverable { id: number; title: string; planned_end: string | null }

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

function dueDateDisplay(due: string | null, status: string, actualEnd?: string | null): React.ReactNode {
  if (!due) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(due); d.setHours(0, 0, 0, 0)
  const isDone = status === 'Done'
  const dateStr = d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
  if (status === 'InReview' && actualEnd) {
    const completed = new Date(actualEnd)
    completed.setHours(0, 0, 0, 0)
    if (completed > d)
      return <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">{dateStr} · Submitted late</span>
    return <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">{dateStr} · Submitted</span>
  }
  if (!isDone && d < today)
    return <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">{dateStr} · Overdue</span>
  if (!isDone && d.getTime() === today.getTime())
    return <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">{dateStr} · Due today</span>
  return <span className="text-[10px] text-slate-400">{dateStr}</span>
}

function startedDateDisplay(started: string | null | undefined, status: string): React.ReactNode {
  if (status !== 'InProgress' || !started) return null
  const d = new Date(started)
  if (isNaN(d.getTime())) return null
  const dateStr = d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
  return <span className="text-[10px] text-emerald-500 dark:text-emerald-400">Started: {dateStr}</span>
}

const COLUMNS: { id: string; label: string; color: string; description: string }[] = [
  { id: 'Todo', label: 'To Do', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200', description: 'Tasks queued and ready to be picked up. Drag a card to In Progress when work begins.' },
  { id: 'InProgress', label: 'In Progress', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300', description: 'Tasks actively being worked on and updated by assignees.' },
  { id: 'InReview', label: 'To Review', color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300', description: 'Tasks completed by the assignee and awaiting review or approval before closing.' },
  { id: 'Done', label: 'Done', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300', description: 'Tasks that have been reviewed and signed off. Contributes to project progress.' },
]

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
  for (const t of tasks) board[t.status] ? board[t.status].push(t) : board['Todo'].push(t)
  return board
}

function findTask(board: BoardState, id: number) {
  for (const col of COLUMNS) { const t = board[col.id].find(t => t.id === id); if (t) return t }
}

function cardHeaderScope(task: Task): string {
  return task.description?.trim() || task.title
}

// ── Add Task Modal ────────────────────────────────────────────────
function AddTaskModal({ onClose, onAdded }: { onClose: () => void; onAdded: (task: Task) => void }) {
  const STANDALONE = ''
  const { data: session } = useSession()
  const currentUserId = Number((session?.user as any)?.id)
  const [projects, setProjects] = useState<Project[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [allUsers, setAllUsers] = useState<{ id: number; name: string }[]>([])
  const [partnerIds, setPartnerIds] = useState<number[]>([])
  const [projectId, setProjectId] = useState('')
  const [deliverableId, setDeliverableId] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [estMandays, setEstMandays] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [presetCatalog, setPresetCatalog] = useState<Array<{
    category: string
    scopes: Array<{
      scope: string
      type: string
      tasks: { name: string; est_mandays: number | null }[]
    }>
  }>>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedScope, setSelectedScope] = useState('')
  const [selectedSpecificTask, setSelectedSpecificTask] = useState('')

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then((data: any[]) =>
      setProjects(data.map(p => ({ id: p.id, title: p.title })))
    )
    fetch('/api/users').then(r => r.json()).then((data: any[]) =>
      setAllUsers(data.map((u: any) => ({ id: u.id, name: u.name })))
    )
  }, [])

  useEffect(() => {
    if (!projectId) {
      setDeliverables([])
      setDeliverableId('')
      return
    }
    fetch(`/api/projects/${projectId}/deliverables`).then(r => r.json()).then((data: any[]) => {
      setDeliverables(data.map((d: any) => ({ id: d.id, title: d.title, planned_end: d.planned_end ?? null })))
      setDeliverableId('')
    })
  }, [projectId])

  useEffect(() => {
    if (!deliverableId) { setPresetCatalog([]); return }
    const deliv = deliverables.find(d => d.id === Number(deliverableId))
    if (deliv?.planned_end) setDueDate(deliv.planned_end.slice(0, 10))
    fetch(`/api/deliverables/${deliverableId}/preset-tasks`)
      .then(r => r.json())
      .then(data => {
        setPresetCatalog(Array.isArray(data) ? data : [])
        setSelectedCategory('')
        setSelectedScope('')
        setSelectedSpecificTask('')
      })
      .catch(() => setPresetCatalog([]))
  }, [deliverableId])

  const selectedDeliverable = deliverables.find(d => d.id === Number(deliverableId))
  const delivPlannedEnd = selectedDeliverable?.planned_end ? new Date(selectedDeliverable.planned_end) : null
  const dueDateVal = dueDate ? new Date(dueDate) : null
  const dueDateExceeds = delivPlannedEnd && dueDateVal && dueDateVal > delivPlannedEnd
  const selectedTaskLabel = (presetCatalog.find(c => c.category === selectedCategory)?.scopes ?? [])
    .filter(scope => scope.scope === selectedScope)
    .flatMap(scope => scope.tasks.map(task => ({
      key: `${scope.scope}|||${task.name}`,
      task: task.name,
    })))
    .find(item => item.key === selectedSpecificTask)?.task ?? ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!deliverableId) { setError('Please select a deliverable.'); return }
    const cleanedDetails = description.trim()
    if (!cleanedDetails) { setError('Specific Tasks Details is required.'); return }
    const taskTitle = cleanedDetails.split('\n').map(s => s.trim()).find(Boolean)?.slice(0, 120) || 'Task'
    const devCategoryRef = selectedCategory.trim() || null
    const devScopeRef = selectedScope.trim() || null
    const devTaskRef = selectedTaskLabel.trim() || null
    setSaving(true); setError('')

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliverable_id: Number(deliverableId),
        title: taskTitle,
        description: description.trim() || null,
        dev_category: devCategoryRef,
        dev_scope: devScopeRef,
        dev_task: devTaskRef,
        assignee_ids: partnerIds, // member's own ID is added server-side
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add Task to Board</h2>
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

          {/* 2. Deliverable */}
          {projectId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deliverable *</label>
              <select className={inputClass} value={deliverableId} onChange={e => setDeliverableId(e.target.value)}>
                <option value="">Select deliverable...</option>
                {deliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          )}

          {/* 4. Task category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tasks Category (Dev)</label>
              <select
                className={inputClass}
                value={selectedCategory}
                onChange={e => {
                  const category = e.target.value
                  setSelectedCategory(category)
                  if (category === STANDALONE) {
                    setSelectedScope(STANDALONE)
                    setSelectedSpecificTask(STANDALONE)
                  } else {
                    setSelectedScope('')
                    setSelectedSpecificTask('')
                  }
                }}
              >
                <option value="">Standalone tasks</option>
                {presetCatalog.map(c => (
                  <option key={c.category} value={c.category}>{c.category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scope (Dev)</label>
              <select
                className={inputClass}
                value={selectedScope}
                onChange={e => {
                  const scope = e.target.value
                  setSelectedScope(scope)
                  setSelectedSpecificTask(scope === STANDALONE ? STANDALONE : '')
                }}
                disabled={!selectedCategory}
              >
                <option value="">Standalone tasks</option>
                {(presetCatalog.find(c => c.category === selectedCategory)?.scopes ?? [])
                  .map(scope => (
                    <option key={scope.scope} value={scope.scope}>{scope.scope}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* 6. Specific task */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Task (Dev)</label>
            <select
              className={inputClass}
              value={selectedSpecificTask}
              onChange={e => {
                const key = e.target.value
                setSelectedSpecificTask(key)
                const selected = presetCatalog
                  .find(c => c.category === selectedCategory)
                  ?.scopes
                  .filter(scope => scope.scope === selectedScope)
                  .flatMap(scope => scope.tasks.map(task => ({
                    key: `${scope.scope}|||${task.name}`,
                    scope: scope.scope,
                    task: task.name,
                    est_mandays: task.est_mandays,
                  })))
                  .find(item => item.key === key)
                if (!selected) {
                  return
                }
                if (selected.est_mandays != null) setEstMandays(String(selected.est_mandays))
              }}
              disabled={!selectedScope}
            >
              <option value="">Standalone tasks</option>
              {(presetCatalog.find(c => c.category === selectedCategory)?.scopes ?? [])
                .filter(scope => scope.scope === selectedScope)
                .flatMap(scope => scope.tasks.map(task => ({
                  key: `${scope.scope}|||${task.name}`,
                  label: task.name,
                  est_mandays: task.est_mandays,
                })))
                .map(opt => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Specific Tasks Details</label>
            <textarea
              className={inputClass}
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={selectedTaskLabel
                ? `Specify details for ${selectedTaskLabel}...`
                : 'Specify task details...'}
            />
          </div>

          {/* 6. Partners */}
          {allUsers.filter(u => u.id !== currentUserId).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Partners <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <p className="text-xs text-slate-400 mb-1.5">You are auto-assigned. Add partners to collaborate on this task.</p>
              <div className="flex flex-wrap gap-1.5">
                {allUsers.filter(u => u.id !== currentUserId).map(u => (
                  <label
                    key={u.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${
                      partnerIds.includes(u.id)
                        ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-navy-900 border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={partnerIds.includes(u.id)}
                      onChange={() => setPartnerIds(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                      className="sr-only"
                    />
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 bg-slate-200 dark:bg-slate-700">
                      {u.name[0].toUpperCase()}
                    </span>
                    {u.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 7. Due date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due date</label>
            <input type="date" className={inputClass} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            {dueDateExceeds && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Due date exceeds deliverable end date</p>
            )}
          </div>

          {/* 7. Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
            <select className={inputClass} value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* 8. Est. Mandays */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Est. Mandays <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="number" min="0.5" step="0.5" className={inputClass} placeholder="e.g. 1.5" value={estMandays} onChange={e => setEstMandays(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors">
              {saving ? 'Adding...' : 'Add to Board'}
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

interface AssignedIssue {
  id: number
  title: string
  description: string | null
  severity: string
  project: { id: number; title: string }
}

// ── Main Board ────────────────────────────────────────────────────
export default function KanbanBoard() {
  const { data: session } = useSession()
  const isManager = (session?.user as any)?.role === 'manager'
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [assignedIssues, setAssignedIssues] = useState<AssignedIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<{ taskId: number; target: StatusTarget } | null>(null)

  // Filters
  const [filterProjectId, setFilterProjectId] = useState('')
  const [filterFeatureId, setFilterFeatureId] = useState('')
  const [columnSearch, setColumnSearch] = useState<Record<string, string>>({
    Todo: '',
    InProgress: '',
    InReview: '',
    Done: '',
  })
  const [showLegend, setShowLegend] = useState(false)

  useEffect(() => { loadMyTasks() }, [])

  function loadMyTasks() {
    setLoading(true)
    Promise.all([
      fetch('/api/tasks/my').then(r => r.json()),
      fetch('/api/issues/my').then(r => r.json()),
    ]).then(([tasks, issues]) => {
      setAllTasks(tasks)
      setAssignedIssues(issues)
      setLoading(false)
    })
  }

  // Derive filter options from loaded tasks
  const projectOptions = Array.from(
    new Map(allTasks.filter(t => t.project).map(t => [t.project!.id, t.project!])).values()
  )
  const featureOptions = Array.from(
    new Map(
      allTasks
        .filter(t => t.feature && (!filterProjectId || t.project?.id === Number(filterProjectId)))
        .map(t => [t.feature!.id, { id: t.feature!.id, title: t.feature!.title }])
    ).values()
  )

  // Derive visible board from filters
  const visibleTasks = allTasks.filter(t => {
    if (filterProjectId && t.project?.id !== Number(filterProjectId)) return false
    if (filterFeatureId && t.feature?.id !== Number(filterFeatureId)) return false
    return true
  })
  const board = buildBoard(visibleTasks)
  const getColumnTasks = (colId: string) => {
    const query = (columnSearch[colId] ?? '').trim().toLowerCase()
    if (!query) return board[colId]
    return board[colId].filter(t => {
      const searchable = [
        t.title,
        t.description ?? '',
        t.feature?.title ?? '',
        t.deliverable?.title ?? '',
        t.project?.title ?? '',
        t.module?.title ?? '',
        t.dev_category ?? '',
        t.dev_scope ?? '',
        t.dev_task ?? '',
      ].join(' ').toLowerCase()
      return searchable.includes(query)
    })
  }
  const todoSearchQuery = (columnSearch.Todo ?? '').trim().toLowerCase()
  const visibleAssignedIssues = assignedIssues.filter(issue => {
    if (!todoSearchQuery) return true
    const searchable = [issue.title, issue.description ?? '', issue.project.title].join(' ').toLowerCase()
    return searchable.includes(todoSearchQuery)
  })

  function handleTaskAdded(task: Task) {
    setAllTasks(prev => [...prev, task])
  }

  async function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const taskId = Number(draggableId)
    const newStatus = destination.droppableId

    // InReview cannot go back to Todo — only to InProgress
    if (source.droppableId === 'InReview' && newStatus === 'Todo') return
    // Members cannot skip directly to InReview from Todo (must pass through InProgress)
    if (!isManager && newStatus === 'InReview' && source.droppableId !== 'InProgress') return
    // Only managers can move to Done
    if (newStatus === 'Done' && !isManager) return

    const POPUP_STATUSES: StatusTarget[] = ['InProgress', 'InReview', 'Done', 'Blocked']
    if (POPUP_STATUSES.includes(newStatus as StatusTarget)) {
      setPendingStatus({ taskId, target: newStatus as StatusTarget })
      return
    }

    await doStatusUpdate(taskId, newStatus, {})
  }

  async function moveTask(taskId: number, currentStatus: string, direction: 'next' | 'prev') {
    const colIds = COLUMNS.map(c => c.id)
    const newIdx = colIds.indexOf(currentStatus) + (direction === 'next' ? 1 : -1)
    if (newIdx < 0 || newIdx >= colIds.length) return
    const newStatus = colIds[newIdx]

    // InReview cannot go back to Todo
    if (currentStatus === 'InReview' && newStatus === 'Todo') return
    // Members cannot skip directly to InReview from Todo (must pass through InProgress)
    if (!isManager && newStatus === 'InReview' && currentStatus !== 'InProgress') return
    // Only managers can move to Done
    if (newStatus === 'Done' && !isManager) return

    const POPUP_STATUSES: StatusTarget[] = ['InProgress', 'InReview', 'Done', 'Blocked']
    if (POPUP_STATUSES.includes(newStatus as StatusTarget)) {
      setPendingStatus({ taskId, target: newStatus as StatusTarget })
      return
    }

    await doStatusUpdate(taskId, newStatus, {})
  }

  function toggleBlock(task: Task) {
    if (task.is_blocked || task.status === 'Blocked') {
      setPendingStatus({ taskId: task.id, target: 'Unblock' })
    } else {
      setPendingStatus({ taskId: task.id, target: 'Blocked' })
    }
  }

  async function doStatusUpdate(taskId: number, newStatus: string, opts: { actual_date?: string; blocked_reason?: string }) {
    const payload: any = { status: newStatus }
    if (opts.actual_date) payload.actual_date = opts.actual_date
    if (opts.blocked_reason) payload.blocked_reason = opts.blocked_reason
    if (newStatus === 'Blocked') payload.is_blocked = true
    const prevTask = allTasks.find(t => t.id === taskId)
    if (newStatus === 'InProgress' && prevTask?.status === 'Blocked') payload.is_blocked = false

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated: Task = await res.json()
      setAllTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
    } else {
      loadMyTasks()
    }
  }

  function handleStatusChange(taskId: number, newStatus: string) {
    setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  function handlePopupConfirm(taskId: number, newStatus: string, opts: { actual_date?: string; blocked_reason?: string }) {
    setPendingStatus(null)
    doStatusUpdate(taskId, newStatus, opts)
  }

  async function confirmDeleteTask() {
    if (!deleteConfirm) return
    setDeleting(true)
    const res = await fetch(`/api/tasks/${deleteConfirm.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setAllTasks(prev => prev.filter(t => t.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">Loading your tasks...</div>
  }

  const activeTask = activeTaskId !== null ? findTask(board, activeTaskId) : null
  const totalVisible = visibleTasks.length
  const pendingTask = pendingStatus ? allTasks.find(t => t.id === pendingStatus.taskId) : null

  return (
    <>
      {pendingStatus && pendingTask && (
        <StatusChangeModal
          taskId={pendingTask.id}
          taskTitle={pendingTask.title}
          taskScope={pendingTask.description ?? null}
          targetStatus={pendingStatus.target}
          projectTitle={pendingTask.project?.title ?? null}
          linkedTitle={pendingTask.feature?.title ?? pendingTask.deliverable?.title ?? null}
          linkedType={pendingTask.deliverable ? 'deliverable' : pendingTask.feature ? 'feature' : 'standalone'}
          createdByName={pendingTask.created_by_name ?? null}
          estMandays={pendingTask.est_mandays}
          deliverableBudgetMandays={pendingTask.deliverable_budget_mandays ?? null}
          deliverableUsedMandays={pendingTask.deliverable_used_mandays ?? null}
          actualStartDate={(pendingTask as any).actual_start ?? null}
          dueDate={pendingTask.due_date}
          isManager={isManager}
          onConfirm={handlePopupConfirm}
          onCancel={() => setPendingStatus(null)}
        />
      )}
      <div>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <select
            value={filterProjectId}
            onChange={e => { setFilterProjectId(e.target.value); setFilterFeatureId('') }}
            className="text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Projects</option>
            {projectOptions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>

          <select
            value={filterFeatureId}
            onChange={e => setFilterFeatureId(e.target.value)}
            disabled={featureOptions.length === 0}
            className="text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
          >
            <option value="">All Features</option>
            {featureOptions.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
          </select>

          {(filterProjectId || filterFeatureId) && (
            <button
              onClick={() => { setFilterProjectId(''); setFilterFeatureId('') }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
            {totalVisible} task{totalVisible !== 1 ? 's' : ''}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowLegend(v => !v)}
              className={`w-6 h-6 rounded-full text-xs font-bold border transition-colors ${showLegend ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-navy-600 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
              title="Show legend"
            >?</button>

            {/* Legend popover */}
            {showLegend && (
              <>
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
                          <span>Review count shown in modal header</span>
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
                            <li>✗ Cannot skip directly from To Do to To Review</li>
                            <li>✗ Cannot update tasks in To Review</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-200 mb-0.5">Manager</p>
                          <ul className="space-y-0.5 text-slate-500 dark:text-slate-400">
                            <li>✓ Approve or reject tasks in To Review</li>
                            <li>✓ View update history on any task</li>
                            <li>✓ Attach evidence &amp; log findings on reject</li>
                            <li>✗ Cannot submit progress as developer</li>
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

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-4 gap-4 items-start">
            {COLUMNS.map(col => (
              <div key={col.id} className="flex flex-col">
                <div className={`rounded-lg px-3 py-2 mb-1 flex flex-col min-h-[102px] ${col.color}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm">{col.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium opacity-70">
                        {getColumnTasks(col.id).length + (col.id === 'Todo' ? visibleAssignedIssues.length : 0)}
                      </span>
                      {col.id === 'Todo' && (
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="w-5 h-5 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold leading-none"
                          title="Add task"
                        >+</button>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] opacity-60 mt-0.5 leading-snug min-h-[30px]">{col.description}</p>
                  <input
                    value={columnSearch[col.id] ?? ''}
                    onChange={e => setColumnSearch(prev => ({ ...prev, [col.id]: e.target.value }))}
                    placeholder="Search task/deliverable..."
                    className="mt-auto w-full bg-white/70 dark:bg-navy-900/80 border border-slate-300/60 dark:border-navy-600 rounded px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="mb-3" />

                {col.id === 'Todo' && board[col.id].length === 0 && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mb-2 w-full border-2 border-dashed border-slate-200 dark:border-navy-600 rounded-lg py-4 text-xs text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                  >
                    + Add your first task
                  </button>
                )}

                {/* Assigned issue cards — To Do column only */}
                {col.id === 'Todo' && visibleAssignedIssues.map(issue => {
                  const sevColor: Record<string, string> = {
                    high: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
                    medium: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300',
                    low: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
                  }
                  return (
                    <div key={`issue-${issue.id}`} className="bg-white dark:bg-navy-800 border border-red-200 dark:border-red-800/50 rounded-lg p-3 shadow-sm mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">Issue</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${sevColor[issue.severity]}`}>
                          {issue.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="font-medium text-sm text-slate-800 dark:text-white leading-snug">{issue.title}</p>
                      {issue.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{issue.description}</p>}
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 truncate">{issue.project.title}</p>
                    </div>
                  )
                })}

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col gap-2 min-h-32 rounded-lg p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                    >
                      {getColumnTasks(col.id).map((task, index) => (
                        <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`rounded-lg p-3 shadow-sm select-none transition-colors ${reviewCardStyle(task)} ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : 'hover:shadow-md'}`}
                            >
                              <div className="flex items-start justify-between gap-1 mb-0.5">
                                <p className="font-medium text-sm text-slate-800 dark:text-white leading-snug">{cardHeaderScope(task)}</p>
                                <div className="flex items-center gap-1 shrink-0">
                                  {(task._count?.issues ?? 0) > 0 && (
                                    <span
                                      title={`${task._count!.issues} open issue${task._count!.issues > 1 ? 's' : ''}`}
                                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap"
                                    >
                                      ⚠ {task._count!.issues}
                                    </span>
                                  )}
                                  {task.review_count > 0 && task.status !== 'Todo' && (
                                    <span
                                      title={`Reviewed ${task.review_count} time${task.review_count > 1 ? 's' : ''}`}
                                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 whitespace-nowrap"
                                    >
                                      ↩ {task.review_count}
                                    </span>
                                  )}
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium}`}>
                                    {task.priority}
                                  </span>
                                </div>
                              </div>
                              {task.description?.trim() && (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">Category: {task.title}</p>
                              )}
                              {task.is_blocked && (
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">🚫 Blocked</span>
                                  {task.blocked_reason && <span className="text-[10px] text-red-400 dark:text-red-500 italic truncate">{task.blocked_reason}</span>}
                                </div>
                              )}
                              {task.module && (
                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5 truncate font-medium">{task.module.title}</p>
                              )}
                              {(task.feature || task.deliverable) && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 truncate">{task.feature?.title ?? task.deliverable?.title}</p>
                              )}
                              {task.project && (
                                <p className="text-xs text-slate-400 truncate">{task.project.title}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {task.is_predefined && <span className="text-xs text-slate-400">SDLC</span>}
                              </div>
                              {task.status === 'InProgress' && task.actual_start && (
                                <div className="mt-1">{startedDateDisplay(task.actual_start, task.status)}</div>
                              )}
                              {task.due_date && (
                                <div className="mt-1">{dueDateDisplay(task.due_date, task.status, task.actual_end ?? null)}</div>
                              )}
                              <div className="flex items-center justify-between mt-2 gap-1">
                                <div className="flex gap-1">
                                  {col.id !== 'Todo' && (
                                    <button onClick={() => moveTask(task.id, col.id, 'prev')} className="text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-500 hover:bg-slate-50" title="Move back">←</button>
                                  )}
                                  {col.id !== 'Done' && (
                                    <button onClick={() => moveTask(task.id, col.id, 'next')} className="text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-500 hover:bg-slate-50" title="Move forward">→</button>
                                  )}                                  <button
                                    onClick={() => toggleBlock(task)}
                                    className={`p-1 rounded text-xs ${task.is_blocked || task.status === 'Blocked' ? 'text-green-500 hover:text-green-700' : 'text-red-400 hover:text-red-600'}`}
                                    title={task.is_blocked || task.status === 'Blocked' ? 'Unblock' : 'Block'}
                                  >
                                    {task.is_blocked || task.status === 'Blocked' ? '✓' : '🚫'}
                                  </button>                                  {col.id === 'Todo' && !task.is_predefined && (
                                    <button
                                      onClick={() => setDeleteConfirm({ id: task.id, title: task.title })}
                                      className="p-1 rounded border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                      title="Delete task"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => setActiveTaskId(task.id)}
                                  disabled={!isManager && task.status === 'InReview'}
                                  className="text-xs px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                >Update</button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>

        {showAddModal && <AddTaskModal onClose={() => setShowAddModal(false)} onAdded={handleTaskAdded} />}

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
            taskScope={activeTask.description ?? null}
            moduleTitle={activeTask.module?.title ?? null}
            featureTitle={activeTask.feature?.title ?? activeTask.deliverable?.title ?? null}
            projectTitle={activeTask.project?.title ?? null}
            createdByName={activeTask.created_by_name ?? null}
            dueDate={activeTask.due_date}
            actualStartDate={activeTask.actual_start ?? null}
            actualEndDate={activeTask.actual_end ?? null}
            currentStatus={activeTask.status}
            reviewCount={activeTask.review_count}
            estMandays={activeTask.est_mandays}
            deliverableBudgetMandays={activeTask.deliverable_budget_mandays ?? null}
            deliverableUsedMandays={activeTask.deliverable_used_mandays ?? null}
            initialActualMandays={activeTask.actual_mandays}
            onClose={() => { setActiveTaskId(null); loadMyTasks() }}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </>
  )
}
