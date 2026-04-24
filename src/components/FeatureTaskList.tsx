'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { Pencil, Trash2, X } from 'lucide-react'
import StatusChangeModal, { StatusTarget } from './StatusChangeModal'

interface TaskAssignee {
  user: { id: number; name: string }
}

interface Task {
  id: number
  title: string
  description?: string | null
  dev_category?: string | null
  dev_scope?: string | null
  dev_task?: string | null
  status: string
  order: number
  is_predefined: boolean
  assignees: TaskAssignee[]
  due_date: string | null
  actual_start: string | null
  actual_end: string | null
  actual_mandays: number | null
  est_mandays: number | null
  priority: string
  is_blocked: boolean
  blocked_reason: string | null
  _count?: { issues: number }
}

interface Developer {
  user: { id: number; name: string }
}

interface Props {
  featureId?: number
  deliverableId?: number
  deliverableTitle?: string | null
  deliverableMandays?: number | null
  deliverablePlannedStart?: string | null
  deliverablePlannedEnd?: string | null
  projectStart?: string | null
  projectDeadline?: string | null
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

function buildScopePlaceholder(taskCategory: string): string {
  const c = taskCategory.toLowerCase().trim()
  if (!c) return 'Describe exact scope and expected output for the selected task category.'
  if (c.includes('list') || c.includes('table')) return 'Table apa yang dibina? Nyatakan columns, filters, sorting, pagination, dan data source.'
  if (c.includes('api') || c.includes('endpoint')) return 'Endpoint apa? Nyatakan route, request/response, validation, auth, dan error handling.'
  if (c.includes('form')) return 'Form apa? Nyatakan fields, validation, submit flow, dan success/error behavior.'
  if (c.includes('dashboard') || c.includes('widget') || c.includes('chart')) return 'Widget/metric apa? Nyatakan data source, filter, aggregation, dan update behavior.'
  if (c.includes('report') || c.includes('export')) return 'Report/export apa? Nyatakan format, filter range, layout, dan expected output.'
  if (c.includes('test') || c.includes('qa') || c.includes('uat')) return 'Scenario test apa? Nyatakan scope, test data, expected result, dan pass criteria.'
  return `Nyatakan skop spesifik untuk "${taskCategory}" termasuk output dan acceptance criteria.`
}

// ── Assignee Chip ──────────────────────────────────────────────────
function AssigneeChip({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <span
      title={name}
      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-semibold shrink-0 border border-blue-200 dark:border-blue-700"
    >
      {initials}
    </span>
  )
}

// ── Multi-select Assignee Picker ───────────────────────────────────
function AssigneePicker({
  value,
  options,
  onChange,
}: {
  value: { id: number; name: string }[]
  options: { id: number; name: string }[]
  onChange: (ids: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    // Flip upward if too close to bottom of viewport
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < 220
      ? rect.top + window.scrollY - 4  // will use translateY(-100%) below
      : rect.bottom + window.scrollY + 4
    setPos({ top, left: rect.left + window.scrollX })
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleOpen() {
    updatePos()
    setOpen(o => !o)
  }

  function toggle(id: number) {
    const current = value.map(v => v.id)
    onChange(current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  }

  return (
    <div ref={triggerRef} className="relative">
      <div
        className="flex items-center gap-1 flex-wrap cursor-pointer min-h-[28px] group"
        onClick={handleOpen}
      >
        {value.length === 0 ? (
          <span className="text-xs text-slate-400 dark:text-slate-500 italic group-hover:text-slate-500">Unassigned</span>
        ) : (
          <div className="flex items-center gap-0.5 flex-wrap">
            {value.map(u => <AssigneeChip key={u.id} name={u.name} />)}
          </div>
        )}
        <span className="text-[10px] text-slate-300 dark:text-slate-600 group-hover:text-slate-400 ml-0.5">▾</span>
      </div>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, minWidth: 220, width: 'max-content', maxWidth: 320 }}
          className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg shadow-2xl py-1 max-h-60 overflow-y-auto"
        >
          {options.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-2">No users available</p>
          ) : (
            options.map(u => (
              <label
                key={u.id}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-navy-700 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={value.some(v => v.id === u.id)}
                  onChange={() => toggle(u.id)}
                  className="rounded accent-blue-600 shrink-0"
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">{u.name}</span>
              </label>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Assignee multi-checkbox for forms ─────────────────────────────
function AssigneeCheckList({
  value,
  options,
  onChange,
}: {
  value: number[]
  options: { id: number; name: string }[]
  onChange: (ids: number[]) => void
}) {
  function toggle(id: number) {
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(u => (
        <label
          key={u.id}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs cursor-pointer transition-colors ${value.includes(u.id)
            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
            : 'bg-white dark:bg-navy-900 border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'
            }`}
        >
          <input
            type="checkbox"
            checked={value.includes(u.id)}
            onChange={() => toggle(u.id)}
            className="sr-only"
          />
          <AssigneeChip name={u.name} />
          <span className="whitespace-nowrap">{u.name}</span>
        </label>
      ))}
    </div>
  )
}

export default function FeatureTaskList({ featureId, deliverableId, deliverableTitle, deliverableMandays, deliverablePlannedStart, deliverablePlannedEnd, projectStart, projectDeadline, userRole, developers }: Props) {
  const STANDALONE = ''
  const { data: session } = useSession()
  const currentUserId = Number((session?.user as any)?.id)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeIds: [] as number[],
    due_date: deliverablePlannedEnd ? deliverablePlannedEnd.slice(0, 10) : '',
    priority: 'medium',
    est_mandays: '',
  })
  const [addingTask, setAddingTask] = useState(false)
  const [addTaskError, setAddTaskError] = useState('')
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
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', assigneeIds: [] as number[], est_mandays: '', due_date: '', priority: 'medium', actual_start: '', actual_end: '' })
  const [editTaskError, setEditTaskError] = useState('')
  const [editTaskSaving, setEditTaskSaving] = useState(false)
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

  useEffect(() => {
    if (!showAddTask || !deliverableId) return
    fetch(`/api/deliverables/${deliverableId}/preset-tasks`)
      .then(r => r.json())
      .then(data => {
        setPresetCatalog(Array.isArray(data) ? data : [])
        setSelectedCategory('')
        setSelectedScope('')
        setSelectedSpecificTask('')
      })
      .catch(() => setPresetCatalog([]))
  }, [showAddTask, deliverableId])

  async function fetchTasks() {
    setLoading(true)
    const param = featureId ? `feature_id=${featureId}` : `deliverable_id=${deliverableId}`
    const res = await fetch(`/api/tasks?${param}`)
    const data = await res.json()
    setTasks(data)
    setLoading(false)
  }

  function isTaskAssignee(task: Task) {
    return task.assignees.some(a => a.user.id === currentUserId)
  }

  async function updateTaskStatus(taskId: number, newStatus: string) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (task.status === 'Blocked' && newStatus === 'InProgress') {
      setPendingStatus({ taskId, target: 'Unblock' })
      return
    }

    if (POPUP_STATUSES.has(newStatus)) {
      if (newStatus === 'Done' && userRole !== 'manager') return
      setPendingStatus({ taskId, target: newStatus as StatusTarget })
      return
    }

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

  async function updateTaskAssignees(taskId: number, assigneeIds: number[]) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_ids: assigneeIds }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignees: updated.assignees } : t))
    }
  }

  function openEditTask(task: Task) {
    setEditForm({
      title: task.title,
      description: (task as any).description ?? '',
      assigneeIds: task.assignees.map(a => a.user.id),
      est_mandays: task.est_mandays != null ? String(task.est_mandays) : '',
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      priority: task.priority ?? 'medium',
      actual_start: task.actual_start ? task.actual_start.slice(0, 10) : '',
      actual_end: task.actual_end ? task.actual_end.slice(0, 10) : '',
    })
    setEditTaskError('')
    setEditingTask(task)
  }

  async function saveEditTask() {
    if (!editingTask) return
    if (!editForm.title.trim()) { setEditTaskError('Task category is required.'); return }
    setEditTaskError('')
    setEditTaskSaving(true)
    const payload: Record<string, unknown> = {
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      assignee_ids: editForm.assigneeIds,
      est_mandays: editForm.est_mandays !== '' ? Number(editForm.est_mandays) : null,
      due_date: editForm.due_date || null,
      priority: editForm.priority,
    }
    if (userRole === 'manager') {
      payload.actual_start = editForm.actual_start || null
      payload.actual_end = editForm.actual_end || null
    }
    const res = await fetch(`/api/tasks/${editingTask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setEditTaskSaving(false)
    if (res.ok) {
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...updated } : t))
      setEditingTask(null)
    } else {
      const err = await res.json().catch(() => null)
      setEditTaskError(err?.error ?? 'Failed to save task.')
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
    const cleanedDetails = newTask.description.trim()
    if (!cleanedDetails) {
      setAddTaskError('Specific Tasks Details is required.')
      return
    }
    const resolvedTitle = cleanedDetails.split('\n').map(s => s.trim()).find(Boolean)?.slice(0, 120) || 'Task'
    const devCategoryRef = selectedCategory.trim() || null
    const devScopeRef = selectedScope.trim() || null
    const devTaskRef = selectedTaskLabel.trim() || null
    if (!newTask.est_mandays || Number(newTask.est_mandays) <= 0) {
      setAddTaskError('Est. mandays is required.')
      return
    }
    if (deliverableMandays != null && deliverableMandays > 0) {
      const usedMd = tasks.reduce((s, t) => s + (t.est_mandays != null ? Number(t.est_mandays) : 0), 0)
      const remaining = deliverableMandays - usedMd
      if (Number(newTask.est_mandays) > remaining) {
        setAddTaskError(`Est. mandays exceeds remaining budget (${remaining.toFixed(1)} md available).`)
        return
      }
    }
    setAddTaskError('')
    setAddingTask(true)

    // For members: always include themselves + any partners
    const resolvedIds = userRole === 'manager'
      ? newTask.assigneeIds
      : [currentUserId, ...newTask.assigneeIds.filter(id => id !== currentUserId)]

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(featureId ? { feature_id: featureId } : { deliverable_id: deliverableId }),
        title: resolvedTitle,
        description: newTask.description.trim(),
        dev_category: devCategoryRef,
        dev_scope: devScopeRef,
        dev_task: devTaskRef,
        assignee_ids: resolvedIds,
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
        description: '',
        assigneeIds: [],
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

  const totalTaskMd = tasks.reduce((s, t) => s + (t.est_mandays != null ? Number(t.est_mandays) : 0), 0)
  const showMdWarning = deliverableMandays != null && deliverableMandays > 0 && totalTaskMd > deliverableMandays

  const delivPlannedEndDate = deliverablePlannedEnd ? new Date(deliverablePlannedEnd) : null
  const newDueDateValue = newTask.due_date ? new Date(newTask.due_date) : null
  const newDueDateWarning = delivPlannedEndDate && newDueDateValue && newDueDateValue > delivPlannedEndDate
  const selectedCategoryNode = presetCatalog.find(c => c.category === selectedCategory)
  const scopeOptions = selectedCategoryNode?.scopes ?? []
  const selectedScopeNode = scopeOptions.find(s => s.scope === selectedScope)
  const specificTaskOptions = selectedScopeNode
    ? selectedScopeNode.tasks.map(task => ({
      key: task.name,
      label: task.name,
      scope: selectedScopeNode.scope,
      task: task.name,
      est_mandays: task.est_mandays,
    }))
    : []
  const selectedTaskLabel = specificTaskOptions.find(opt => opt.key === selectedSpecificTask)?.task ?? ''
  const canSubmitTaskSelection = newTask.description.trim().length > 0
  const progressPct = calcProgress(tasks)
  const doneTasks = tasks.filter(t => t.status === 'Done').length

  const pendingTask = pendingStatus ? tasks.find(t => t.id === pendingStatus.taskId) : null

  // Options for assignee picker: managers see all developers, members see all developers (for partners)
  const assigneeOptions = developers.map(d => d.user)

  return (
    <>
      {pendingStatus && pendingTask && (
        <StatusChangeModal
          taskId={pendingTask.id}
          taskTitle={pendingTask.title}
          targetStatus={pendingStatus.target}
          actualStartDate={pendingTask.actual_start}
          dueDate={pendingTask.due_date}
          isManager={userRole === 'manager'}
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
              <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">Assignees</th>
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
                      {(task._count?.issues ?? 0) > 0 && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" title="Open issues">
                          ⚠ {task._count!.issues}
                        </span>
                      )}
                    </div>
                    {(task.is_blocked || task.status === 'Blocked') && task.blocked_reason && (
                      <p className="text-[11px] text-red-500 dark:text-red-400 mt-0.5 italic">{task.blocked_reason}</p>
                    )}
                  </div>
                </td>

                {/* Assignee cell */}
                <td className="px-3 py-2">
                  {userRole === 'manager' ? (
                    <AssigneePicker
                      value={task.assignees.map(a => a.user)}
                      options={assigneeOptions}
                      onChange={(ids) => updateTaskAssignees(task.id, ids)}
                    />
                  ) : (
                    <div className="flex items-center gap-0.5 flex-wrap">
                      {task.assignees.length === 0 ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : (
                        task.assignees.map(a => (
                          <span key={a.user.id} title={a.user.name}>
                            <AssigneeChip name={a.user.name} />
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </td>

                <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs">
                  {task.est_mandays != null ? task.est_mandays : '—'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {task.due_date ? (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <span className={task.status === 'Done' ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-500 dark:text-slate-400'}>
                        {new Date(task.due_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                      {task.status !== 'Done' && dueDateBadge(task.due_date, task.status)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                  {task.status === 'Done' && task.actual_end && (
                    <div className="text-green-600 dark:text-green-400 font-medium mt-0.5 whitespace-nowrap">
                      ✓ {new Date(task.actual_end).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </div>
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
                  ) : isTaskAssignee(task) ? (
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
                    {(userRole === 'manager' || isTaskAssignee(task)) && (
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
                        <button
                          onClick={() => openEditTask(task)}
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
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add task button */}
        <div className="px-3 py-2 border-t border-slate-100 dark:border-navy-700">
          <button
            onClick={() => {
              setAddTaskError('')
              setSelectedCategory('')
              setSelectedScope('')
              setSelectedSpecificTask('')
              setShowAddTask(true)
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            + Add Task
          </button>
        </div>

        {showAddTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    {deliverableTitle ? `Add Task in ${deliverableTitle}` : 'Add Task'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddTask(false)
                      setPresetCatalog([])
                      setAddTaskError('')
                      setSelectedCategory('')
                      setSelectedScope('')
                      setSelectedSpecificTask('')
                      setNewTask({ title: '', description: '', assigneeIds: [], due_date: deliverablePlannedEnd ? deliverablePlannedEnd.slice(0, 10) : '', priority: 'medium', est_mandays: '' })
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  {(projectStart || projectDeadline || deliverablePlannedStart || deliverablePlannedEnd) && (
                    <div className="rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 px-3 py-2 space-y-1">
                      {(projectStart || projectDeadline) && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">Project</span>
                          <span>{projectStart ? new Date(projectStart).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                          <span className="text-slate-300 dark:text-slate-600">→</span>
                          <span>{projectDeadline ? new Date(projectDeadline).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                        </div>
                      )}
                      {(deliverablePlannedStart || deliverablePlannedEnd) && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">Deliverable</span>
                          <span>{deliverablePlannedStart ? new Date(deliverablePlannedStart).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                          <span className="text-slate-300 dark:text-slate-600">→</span>
                          <span>{deliverablePlannedEnd ? new Date(deliverablePlannedEnd).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                          {deliverableMandays != null && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">•</span>
                              <span>{deliverableMandays} md budget</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {tasks.length > 0 && (
                    <div className="rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                        Current tasks ({tasks.length})
                      </p>
                      <ul className="space-y-0.5 max-h-36 overflow-y-auto">
                        {tasks.map(t => (
                          <li key={t.id} className="flex items-center gap-2 text-xs">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${t.status === 'Done' ? 'bg-green-500' :
                                t.status === 'InProgress' ? 'bg-orange-400' :
                                  t.status === 'InReview' ? 'bg-yellow-400' :
                                    t.status === 'Blocked' ? 'bg-red-400' : 'bg-slate-300'
                              }`} />
                            <span className={`flex-1 ${t.status === 'Done' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                              {t.title}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 shrink-0">
                              {t.est_mandays != null ? `${t.est_mandays} md` : '—'}
                            </span>
                            {t.due_date && (
                              <span className="text-slate-400 dark:text-slate-500 shrink-0">
                                {new Date(t.due_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tasks Category (Dev)</label>
                      <select
                        className={`${inputClass} w-full`}
                        value={selectedCategory}
                        onChange={e => {
                          const category = e.target.value
                          setAddTaskError('')
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
                        <option value="">{'Standalone tasks'}</option>
                        {presetCatalog.map(c => (
                          <option key={c.category} value={c.category}>{c.category}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Scope (Dev)</label>
                      <select
                        className={`${inputClass} w-full`}
                        value={selectedScope}
                        onChange={e => {
                          const scope = e.target.value
                          setAddTaskError('')
                          setSelectedScope(scope)
                          setSelectedSpecificTask(scope === STANDALONE ? STANDALONE : '')
                        }}
                        disabled={!selectedCategory}
                      >
                        <option value="">{'Standalone tasks'}</option>
                        {scopeOptions.map(scope => (
                          <option key={scope.scope} value={scope.scope}>{scope.scope}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Task (Dev)</label>
                    <select
                      className={`${inputClass} w-full`}
                      value={selectedSpecificTask}
                      onChange={e => {
                        const next = e.target.value
                        setAddTaskError('')
                        setSelectedSpecificTask(next)
                        const selected = specificTaskOptions.find(opt => opt.key === next)
                        if (!selected) {
                          return
                        }
                        setNewTask(prev => ({
                          ...prev,
                          est_mandays: selected.est_mandays != null ? String(selected.est_mandays) : prev.est_mandays,
                        }))
                      }}
                      disabled={!selectedScope}
                    >
                      <option value="">{'Standalone tasks'}</option>
                      {specificTaskOptions.map(opt => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Specific Tasks Details</label>
                    <textarea
                      className={`${inputClass} w-full resize-none`}
                      rows={2}
                      value={newTask.description}
                      onChange={e => {
                        setAddTaskError('')
                        setNewTask(prev => ({ ...prev, description: e.target.value }))
                      }}
                      placeholder={selectedTaskLabel
                        ? `Specify details for ${selectedTaskLabel}...`
                        : 'Specify task details...'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {userRole === 'manager' ? 'Assignees' : 'Partners (you are auto-assigned)'}
                    </label>
                    {assigneeOptions.length > 0 ? (
                      <AssigneeCheckList
                        value={newTask.assigneeIds}
                        options={userRole === 'manager' ? assigneeOptions : assigneeOptions.filter(u => u.id !== currentUserId)}
                        onChange={(ids) => setNewTask(p => ({ ...p, assigneeIds: ids }))}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">No developers to assign</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Est. Mandays *</label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        className={`${inputClass} w-full`}
                        placeholder="e.g. 1.5"
                        value={newTask.est_mandays}
                        onChange={e => {
                          setAddTaskError('')
                          setNewTask(p => ({ ...p, est_mandays: e.target.value }))
                        }}
                      />
                      {deliverableMandays != null && deliverableMandays > 0 && (() => {
                        const usedMd = tasks.reduce((s, t) => s + (t.est_mandays != null ? Number(t.est_mandays) : 0), 0)
                        const remaining = deliverableMandays - usedMd
                        const newMd = Number(newTask.est_mandays) || 0
                        const afterAdd = remaining - newMd
                        const pctUsed = Math.min(100, Math.round((usedMd / deliverableMandays) * 100))
                        const pctNew = Math.min(100 - pctUsed, Math.round((newMd / deliverableMandays) * 100))
                        return (
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                              <span>Budget: {deliverableMandays} md total</span>
                              <span className={afterAdd < 0 ? 'text-red-500 dark:text-red-400' : ''}>{afterAdd.toFixed(1)} md left</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden flex">
                              <div className="bg-blue-500 h-full transition-all" style={{ width: `${pctUsed}%` }} />
                              <div className={`h-full transition-all ${afterAdd < 0 ? 'bg-red-400' : 'bg-blue-300'}`} style={{ width: `${pctNew}%` }} />
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                      <input
                        type="date"
                        className={`${inputClass} w-full`}
                        value={newTask.due_date}
                        onChange={e => {
                          setAddTaskError('')
                          setNewTask(p => ({ ...p, due_date: e.target.value }))
                        }}
                      />
                      {newDueDateWarning && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Exceeds deliverable end date</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                    <select
                      className={`${inputClass} w-full`}
                      value={newTask.priority}
                      onChange={e => {
                        setAddTaskError('')
                        setNewTask(p => ({ ...p, priority: e.target.value }))
                      }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  {addTaskError && <p className="text-sm text-red-500">{addTaskError}</p>}
                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-navy-700">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddTask(false)
                        setPresetCatalog([])
                        setAddTaskError('')
                        setSelectedCategory('')
                        setSelectedScope('')
                        setSelectedSpecificTask('')
                        setNewTask({ title: '', description: '', assigneeIds: [], due_date: deliverablePlannedEnd ? deliverablePlannedEnd.slice(0, 10) : '', priority: 'medium', est_mandays: '' })
                      }}
                      className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addCustomTask}
                      disabled={addingTask || !canSubmitTaskSelection}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                    >
                      {addingTask ? 'Adding...' : 'Add Task'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">Edit Task</h2>
                  <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  {(projectStart || projectDeadline || deliverablePlannedStart || deliverablePlannedEnd) && (
                    <div className="rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 px-3 py-2 space-y-1">
                      {(projectStart || projectDeadline) && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">Project</span>
                          <span>{projectStart ? new Date(projectStart).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                          <span className="text-slate-300 dark:text-slate-600">→</span>
                          <span>{projectDeadline ? new Date(projectDeadline).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                        </div>
                      )}
                      {(deliverablePlannedStart || deliverablePlannedEnd) && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">Deliverable</span>
                          <span>{deliverablePlannedStart ? new Date(deliverablePlannedStart).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                          <span className="text-slate-300 dark:text-slate-600">→</span>
                          <span>{deliverablePlannedEnd ? new Date(deliverablePlannedEnd).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Task *</label>
                    <input
                      className={`${inputClass} w-full`}
                      value={editForm.title}
                      onChange={e => { setEditTaskError(''); setEditForm(f => ({ ...f, title: e.target.value })) }}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Details</label>
                    <textarea
                      className={`${inputClass} w-full resize-none`}
                      rows={3}
                      placeholder={buildScopePlaceholder(editForm.title)}
                      value={editForm.description}
                      onChange={e => { setEditTaskError(''); setEditForm(f => ({ ...f, description: e.target.value })) }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {userRole === 'manager' ? 'Assignees' : 'Partners (you are auto-assigned)'}
                    </label>
                    {assigneeOptions.length > 0 ? (
                      <AssigneeCheckList
                        value={editForm.assigneeIds}
                        options={userRole === 'manager' ? assigneeOptions : assigneeOptions.filter(u => u.id !== currentUserId)}
                        onChange={(ids) => setEditForm(f => ({ ...f, assigneeIds: ids }))}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">No developers to assign</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Est. Mandays</label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        className={`${inputClass} w-full`}
                        placeholder="e.g. 1.5"
                        value={editForm.est_mandays}
                        onChange={e => { setEditTaskError(''); setEditForm(f => ({ ...f, est_mandays: e.target.value })) }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                      <input
                        type="date"
                        className={`${inputClass} w-full`}
                        value={editForm.due_date}
                        onChange={e => { setEditTaskError(''); setEditForm(f => ({ ...f, due_date: e.target.value })) }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                    <select
                      className={`${inputClass} w-full`}
                      value={editForm.priority}
                      onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  {userRole === 'manager' && (
                    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 space-y-3">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">PM Override — Actual Dates</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Started On</label>
                          <input
                            type="date"
                            className={`${inputClass} w-full`}
                            value={editForm.actual_start}
                            onChange={e => setEditForm(f => ({ ...f, actual_start: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Completed On</label>
                          <input
                            type="date"
                            className={`${inputClass} w-full`}
                            value={editForm.actual_end}
                            onChange={e => setEditForm(f => ({ ...f, actual_end: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {editTaskError && <p className="text-sm text-red-500">{editTaskError}</p>}
                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-navy-700">
                    <button type="button" onClick={() => setEditingTask(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Cancel</button>
                    <button
                      type="button"
                      onClick={saveEditTask}
                      disabled={editTaskSaving || !editForm.title.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                    >
                      {editTaskSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
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
