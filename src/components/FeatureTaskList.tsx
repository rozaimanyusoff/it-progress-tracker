'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import StatusChangeModal, { StatusTarget } from './StatusChangeModal'

interface Task {
  id: number
  title: string
  status: string
  order: number
  is_predefined: boolean
  assigned_to: number | null
  assignee: { id: number; name: string } | null
  due_date: string | null
  actual_start: string | null
  est_mandays: number | null
  priority: string
  is_blocked: boolean
  blocked_reason: string | null
}

interface Developer {
  user: { id: number; name: string }
}

interface Props {
  featureId?: number
  deliverableId?: number
  deliverableMandays?: number | null
  deliverablePlannedEnd?: string | null
  userRole: string
  developers: Developer[]
}

const STATUS_OPTIONS = ['Todo', 'InProgress', 'InReview', 'Done', 'Blocked']
const POPUP_STATUSES = new Set(['InProgress', 'InReview', 'Done', 'Blocked'])
const STATUS_LABELS: Record<string, string> = {
  Todo: 'To Do',
  InProgress: 'In Progress',
  InReview: 'In Review',
  Done: 'Done',
  Blocked: 'Blocked',
}
const STATUS_COLORS: Record<string, string> = {
  Todo: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  InReview: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Blocked: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

const PROGRESS_WEIGHT: Record<string, number> = {
  Todo: 0, InProgress: 50, InReview: 80, Done: 100, Blocked: 0,
}

function calcProgress(tasks: Task[]) {
  if (tasks.length === 0) return 0
  const sum = tasks.reduce((s, t) => s + (PROGRESS_WEIGHT[t.status] ?? 0), 0)
  return Math.round(sum / tasks.length)
}

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

function dueDateBadge(due: string | null, status: string): React.ReactNode {
  if (!due) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(due)
  d.setHours(0, 0, 0, 0)
  const isDone = status === 'Done'
  const dateStr = d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
  const diffDays = Math.floor((d.getTime() - today.getTime()) / 86400000)
  if (isDone) {
    return <span className="text-[10px] text-green-500 line-through ml-1">{dateStr}</span>
  }
  if (d < today) {
    return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 ml-1">Overdue</span>
  }
  if (diffDays <= 3) {
    return <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 ml-1">Due soon</span>
  }
  return <span className="text-[10px] text-slate-400 ml-1">{dateStr}</span>
}

export default function FeatureTaskList({ featureId, deliverableId, deliverableMandays, deliverablePlannedEnd, userRole, developers }: Props) {
  const { data: session } = useSession()
  const currentUserId = Number((session?.user as any)?.id)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    assignee: '',
    due_date: deliverablePlannedEnd ? deliverablePlannedEnd.slice(0, 10) : '',
    priority: 'medium',
    est_mandays: '',
  })
  const [addingTask, setAddingTask] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingEstMandays, setEditingEstMandays] = useState<string>('')
  const [editingDueDate, setEditingDueDate] = useState<string>('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Status change popup state
  const [pendingStatus, setPendingStatus] = useState<{ taskId: number; target: StatusTarget } | null>(null)

  useEffect(() => {
    fetchTasks()
  }, [featureId, deliverableId])

  useEffect(() => {
    setNewTask(prev => ({
      ...prev,
      due_date: deliverablePlannedEnd ? deliverablePlannedEnd.slice(0, 10) : '',
    }))
  }, [deliverablePlannedEnd])

  async function fetchTasks() {
    setLoading(true)
    const param = featureId ? `feature_id=${featureId}` : `deliverable_id=${deliverableId}`
    const res = await fetch(`/api/tasks?${param}`)
    const data = await res.json()
    setTasks(data)
    setLoading(false)
  }

  async function updateTaskStatus(taskId: number, newStatus: string) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // Blocked → InProgress = unblock flow
    if (task.status === 'Blocked' && newStatus === 'InProgress') {
      setPendingStatus({ taskId, target: 'Unblock' })
      return
    }

    // Statuses that require a popup
    if (POPUP_STATUSES.has(newStatus)) {
      // PM-only: InReview → Done
      if (newStatus === 'Done' && userRole !== 'manager') return
      setPendingStatus({ taskId, target: newStatus as StatusTarget })
      return
    }

    // Todo: direct (no popup)
    await doStatusUpdate(taskId, newStatus, {})
  }

  async function doStatusUpdate(taskId: number, newStatus: string, opts: { actual_date?: string; blocked_reason?: string }) {
    const payload: any = { status: newStatus }
    if (opts.actual_date) payload.actual_date = opts.actual_date
    if (opts.blocked_reason) payload.blocked_reason = opts.blocked_reason
    if (newStatus === 'Blocked') payload.is_blocked = true
    if (newStatus === 'InProgress' && tasks.find(t => t.id === taskId)?.status === 'Blocked') {
      payload.is_blocked = false
      payload.blocked_reason = null
    }

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t))
    }
  }

  function handleStatusConfirm(taskId: number, newStatus: string, opts: { actual_date?: string; blocked_reason?: string }) {
    setPendingStatus(null)
    doStatusUpdate(taskId, newStatus, opts)
  }

  async function updateTaskAssignee(taskId: number, assigneeId: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: assigneeId ? Number(assigneeId) : null }),
    })
    if (res.ok) {
      const dev = developers.find((d) => d.user.id === Number(assigneeId))
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, assigned_to: assigneeId ? Number(assigneeId) : null, assignee: dev ? dev.user : null }
            : t
        )
      )
    }
  }

  async function saveTaskTitle(taskId: number) {
    if (!editingTitle.trim()) return
    const estMd = editingEstMandays !== '' ? Number(editingEstMandays) : null
    const dueDate = editingDueDate || null
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editingTitle.trim(), est_mandays: estMd, due_date: dueDate }),
    })
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: editingTitle.trim(), est_mandays: estMd, due_date: dueDate } : t))
      setEditingTaskId(null)
    }
  }

  async function toggleBlock(task: Task) {
    if (task.is_blocked || task.status === 'Blocked') {
      setPendingStatus({ taskId: task.id, target: 'Unblock' })
    } else {
      setPendingStatus({ taskId: task.id, target: 'Blocked' })
    }
  }

  async function deleteTask(taskId: number, taskTitle: string) {
    setDeleteConfirm({ id: taskId, title: taskTitle })
  }

  async function confirmDeleteTask() {
    if (!deleteConfirm) return
    setDeleting(true)
    const res = await fetch(`/api/tasks/${deleteConfirm.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    }
  }

  async function addCustomTask() {
    if (!newTask.title.trim()) return
    setAddingTask(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(featureId ? { feature_id: featureId } : { deliverable_id: deliverableId }),
        title: newTask.title,
        assigned_to: newTask.assignee ? Number(newTask.assignee) : null,
        due_date: newTask.due_date || null,
        priority: newTask.priority,
        est_mandays: newTask.est_mandays ? Number(newTask.est_mandays) : null,
      }),
    })
    if (res.ok) {
      const task = await res.json()
      setTasks((prev) => [...prev, task])
      setNewTask({
        title: '',
        assignee: '',
        due_date: deliverablePlannedEnd ? deliverablePlannedEnd.slice(0, 10) : '',
        priority: 'medium',
        est_mandays: '',
      })
      setShowAddTask(false)
    }
    setAddingTask(false)
  }

  if (loading) return <div className="py-4 text-center text-sm text-slate-500">Loading tasks...</div>

  const inputClass = 'bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded px-2 py-1 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500'

  // Mandays warning
  const totalTaskMd = tasks.reduce((s, t) => s + (t.est_mandays != null ? Number(t.est_mandays) : 0), 0)
  const showMdWarning = deliverableMandays != null && deliverableMandays > 0 && totalTaskMd > deliverableMandays

  // Due date warning for new task
  const delivPlannedEndDate = deliverablePlannedEnd ? new Date(deliverablePlannedEnd) : null
  const newDueDateValue = newTask.due_date ? new Date(newTask.due_date) : null
  const newDueDateWarning = delivPlannedEndDate && newDueDateValue && newDueDateValue > delivPlannedEndDate
  const progressPct = calcProgress(tasks)
  const doneTasks = tasks.filter(t => t.status === 'Done').length

  const pendingTask = pendingStatus ? tasks.find(t => t.id === pendingStatus.taskId) : null

  return (
    <>
      {pendingStatus && pendingTask && (
        <StatusChangeModal
          taskId={pendingTask.id}
          taskTitle={pendingTask.title}
          targetStatus={pendingStatus.target}
          actualStartDate={pendingTask.actual_start}
          dueDate={pendingTask.due_date}
          onConfirm={handleStatusConfirm}
          onCancel={() => setPendingStatus(null)}
        />
      )}
      <div className="mt-3 border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden">
        {showMdWarning && (
          <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 font-medium">
            ⚠ Tasks total ({totalTaskMd} md) exceeds deliverable estimate ({deliverableMandays} md)
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-navy-900 text-left">
              <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 w-8">#</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                Task
                <span className="ml-2 font-normal text-slate-400">{doneTasks}/{tasks.length} · {progressPct}%</span>
              </th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Assignee</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Est. md</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Due Date</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Status</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
            {tasks.map((task) => (
              <tr
                key={task.id}
                className={`${task.is_blocked || task.status === 'Blocked'
                  ? 'border-l-2 border-l-red-400 bg-red-50/30 dark:bg-red-900/10'
                  : task.status === 'Done'
                    ? 'bg-green-50 dark:bg-green-900/10'
                    : 'hover:bg-slate-50 dark:hover:bg-navy-700/30'
                  }`}
              >
                <td className="px-3 py-2 text-slate-400">{task.order}</td>
                <td className={`px-3 py-2 ${task.status === 'Done'
                  ? 'text-green-700 dark:text-green-400 line-through decoration-green-400/60'
                  : 'text-slate-800 dark:text-slate-200'
                  }`}>
                  {editingTaskId === task.id ? (
                    <input
                      className={`${inputClass} w-full`}
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveTaskTitle(task.id); if (e.key === 'Escape') setEditingTaskId(null) }}
                      autoFocus
                    />
                  ) : (
                    <div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium}`}>
                          {task.priority}
                        </span>
                        {(task.is_blocked || task.status === 'Blocked') && (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 cursor-help"
                            title={task.blocked_reason ?? 'Blocked'}
                          >
                            🚫 Blocked
                          </span>
                        )}
                        {task.title}
                        {task.is_predefined && (
                          <span className="text-xs text-slate-400 dark:text-slate-500">SDLC</span>
                        )}
                      </div>
                      {(task.is_blocked || task.status === 'Blocked') && task.blocked_reason && (
                        <p className="text-[11px] text-red-500 dark:text-red-400 mt-0.5 italic">{task.blocked_reason}</p>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {userRole === 'manager' ? (
                    <select
                      className={inputClass}
                      value={task.assigned_to?.toString() ?? ''}
                      onChange={(e) => updateTaskAssignee(task.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {developers.map((d) => (
                        <option key={d.user.id} value={d.user.id}>{d.user.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-300">{task.assignee?.name ?? '—'}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs">
                  {editingTaskId === task.id ? (
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      className={`${inputClass} w-16`}
                      placeholder="—"
                      value={editingEstMandays}
                      onChange={e => setEditingEstMandays(e.target.value)}
                    />
                  ) : (
                    task.est_mandays != null ? task.est_mandays : '—'
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {editingTaskId === task.id ? (
                    <input
                      type="date"
                      className={`${inputClass} w-32`}
                      value={editingDueDate}
                      onChange={e => setEditingDueDate(e.target.value)}
                    />
                  ) : task.due_date ? (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <span className="text-slate-500 dark:text-slate-400">
                        {new Date(task.due_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                      {dueDateBadge(task.due_date, task.status)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {userRole === 'manager' ? (
                    <select
                      className={`${inputClass} text-xs`}
                      value={task.status}
                      onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  ) : task.assigned_to === currentUserId ? (
                    // Members can only advance their own tasks (except Done which needs PM)
                    <select
                      className={`${inputClass} text-xs`}
                      value={task.status}
                      onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.filter(s => s !== 'Done').map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? STATUS_COLORS.Todo}`}>
                      {STATUS_LABELS[task.status] ?? task.status}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {/* Block/Unblock button — integrates with popup */}
                    {(userRole === 'manager' || task.assigned_to === currentUserId) && (
                      <button
                        onClick={() => toggleBlock(task)}
                        className={`p-1 rounded text-xs ${task.is_blocked || task.status === 'Blocked' ? 'text-green-500 hover:text-green-700' : 'text-red-400 hover:text-red-600'}`}
                        title={task.is_blocked || task.status === 'Blocked' ? 'Unblock' : 'Block'}
                      >
                        {task.is_blocked || task.status === 'Blocked' ? '✓' : '🚫'}
                      </button>
                    )}
                    {userRole === 'manager' ? (
                      <>
                        {editingTaskId === task.id ? (
                          <>
                            <button onClick={() => saveTaskTitle(task.id)} className="p-1 rounded text-green-500 hover:text-green-700" title="Save"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingTaskId(null)} className="p-1 rounded text-slate-400 hover:text-slate-600" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingTaskId(task.id); setEditingTitle(task.title); setEditingEstMandays(task.est_mandays != null ? String(task.est_mandays) : ''); setEditingDueDate(task.due_date ? task.due_date.slice(0, 10) : '') }}
                              className="p-1 rounded text-yellow-500 dark:text-yellow-400 hover:text-yellow-600"
                              title="Edit task"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {!task.is_predefined && (
                              <button
                                onClick={() => deleteTask(task.id, task.title)}
                                className="p-1 rounded text-red-400 hover:text-red-600"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {!task.is_predefined && task.status === 'Todo' && task.assigned_to === currentUserId && (
                          <button
                            onClick={() => deleteTask(task.id, task.title)}
                            className="p-1 rounded text-red-400 hover:text-red-600"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {userRole === 'manager' && (
          <div className="px-3 py-2 border-t border-slate-100 dark:border-navy-700">
            {!showAddTask ? (
              <button
                onClick={() => setShowAddTask(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Add Custom Task
              </button>
            ) : (
              <div className="space-y-2 py-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    className={`${inputClass} flex-1 min-w-40`}
                    placeholder="Task title *"
                    value={newTask.title}
                    onChange={(e) => setNewTask(p => ({ ...p, title: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomTask()}
                    autoFocus
                  />
                  <select
                    className={inputClass}
                    value={newTask.assignee}
                    onChange={(e) => setNewTask(p => ({ ...p, assignee: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {developers.map((d) => (
                      <option key={d.user.id} value={d.user.id}>{d.user.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div>
                    <label className="text-xs text-slate-500 mr-1">Due date</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={newTask.due_date}
                      onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
                    />
                    {newDueDateWarning && (
                      <span className="text-xs text-amber-600 ml-1">Due date exceeds deliverable end date</span>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mr-1">Priority</label>
                    <select
                      className={inputClass}
                      value={newTask.priority}
                      onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mr-1">Est. md</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      className={`${inputClass} w-20`}
                      placeholder="—"
                      value={newTask.est_mandays}
                      onChange={e => setNewTask(p => ({ ...p, est_mandays: e.target.value }))}
                    />
                  </div>
                  <button
                    onClick={addCustomTask}
                    disabled={addingTask}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
                  >
                    {addingTask ? 'Adding...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setShowAddTask(false); setNewTask({ title: '', assignee: '', due_date: deliverablePlannedEnd ? deliverablePlannedEnd.slice(0, 10) : '', priority: 'medium', est_mandays: '' }) }}
                    className="text-slate-400 hover:text-slate-600 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
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

      </div>
    </>
  )
}
