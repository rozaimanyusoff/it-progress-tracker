'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import TaskUpdateModal from './TaskUpdateModal'
import { Pencil, X } from 'lucide-react'
import StatusChangeModal, { StatusTarget } from './StatusChangeModal'

interface Task {
  id: number
  title: string
  description?: string | null
  status: string
  review_count: number
  time_started_at: string | null
  time_spent_seconds: number
  assignees: { user: { id: number; name: string } }[]
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
  context: {
    type: 'feature' | 'deliverable' | 'standalone'
    id: number
    title: string
    module: { id: number; title: string } | null
    project: { id: number; title: string } | null
  }
}

interface Project {
  id: number
  title: string
  computedProgress?: number
  computedStatus?: string
}
interface Deliverable { id: number; title: string; planned_end: string | null; priority?: string; mandays?: number }
interface Member { id: number; name: string }

type BoardState = Record<string, Task[]>

const CATEGORY_TYPE_BADGE: Record<string, string> = {
  database: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  backend: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  frontend: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  testing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  documentation: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}

function buildScopePlaceholder(taskCategory: string): string {
  const c = taskCategory.toLowerCase().trim()
  if (!c) return 'Describe exact scope and expected output for the selected task category.'
  if (c.includes('list') || c.includes('table')) {
    return 'Table apa yang dibina? Nyatakan columns, filters, sorting, pagination, dan data source.'
  }
  if (c.includes('api') || c.includes('endpoint')) {
    return 'Endpoint apa? Nyatakan route, request/response, validation, auth, dan error handling.'
  }
  if (c.includes('form')) {
    return 'Form apa? Nyatakan fields, validation, submit flow, dan success/error behavior.'
  }
  if (c.includes('dashboard') || c.includes('widget') || c.includes('chart')) {
    return 'Widget/metric apa? Nyatakan data source, filter, aggregation, dan update behavior.'
  }
  if (c.includes('report') || c.includes('export')) {
    return 'Report/export apa? Nyatakan format, filter range, layout, dan expected output.'
  }
  if (c.includes('test') || c.includes('qa') || c.includes('uat')) {
    return 'Scenario test apa? Nyatakan scope, test data, expected result, dan pass criteria.'
  }
  return `Nyatakan skop spesifik untuk "${taskCategory}" termasuk output dan acceptance criteria.`
}

function suggestStartDateFromDue(dueDate: string, estMandays: string): string | null {
  const end = new Date(dueDate)
  if (isNaN(end.getTime())) return null
  const md = Number(estMandays)
  if (!Number.isFinite(md) || md <= 0) return null

  // Round effort to full working days for planning suggestion.
  let remaining = Math.max(1, Math.ceil(md)) - 1
  const cur = new Date(end)
  cur.setHours(0, 0, 0, 0)

  while (remaining > 0) {
    cur.setDate(cur.getDate() - 1)
    const day = cur.getDay()
    if (day !== 0 && day !== 6) remaining--
  }
  return cur.toISOString().slice(0, 10)
}

// ── Add Task Modal ────────────────────────────────────────────────
function AddTaskModal({
  projects,
  onClose,
  onAdded,
  initialTask,
}: {
  projects: Project[]
  onClose: () => void
  onAdded: (task: Task) => void
  initialTask?: Task | null
}) {
  const { data: session } = useSession()
  const isEditMode = Boolean(initialTask)
  const creatorName = (session?.user as any)?.name ?? 'Current User'
  const creatorRole = (session?.user as any)?.role === 'manager' ? 'Manager' : 'Team Member'
  const CREATE_NEW_DELIVERABLE = '__create_new__'
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [projectId, setProjectId] = useState('')
  const [deliverableId, setDeliverableId] = useState('')
  const [showCreateDeliverable, setShowCreateDeliverable] = useState(false)
  const [newDeliverableTitle, setNewDeliverableTitle] = useState('')
  const [newDeliverableStart, setNewDeliverableStart] = useState('')
  const [newDeliverableEnd, setNewDeliverableEnd] = useState('')
  const [newDeliverableMandays, setNewDeliverableMandays] = useState('1')
  const [newDeliverablePriority, setNewDeliverablePriority] = useState('medium')
  const [creatingDeliverable, setCreatingDeliverable] = useState(false)
  const [newDeliverableError, setNewDeliverableError] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<number[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [estMandays, setEstMandays] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [presetTasks, setPresetTasks] = useState<Array<{
    name: string
    est_mandays: number | null
    type?: string
    samples?: { name: string; est_mandays: number | null }[]
  }>>([])
  const [showTaskPresetPopover, setShowTaskPresetPopover] = useState(false)
  const [delivBudget, setDelivBudget] = useState<{ total: number; used: number } | null>(null)

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
  const scopePlaceholder = buildScopePlaceholder(title)
  const suggestedStartDate = dueDate && estMandays ? suggestStartDateFromDue(dueDate, estMandays) : null

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setMembers)
  }, [])

  useEffect(() => {
    if (!initialTask) return
    const initialProjectId = initialTask.context.project?.id ? String(initialTask.context.project.id) : ''
    const initialDeliverableId = initialTask.context.type === 'deliverable' ? String(initialTask.context.id) : ''
    setProjectId(initialProjectId)
    setDeliverableId(initialDeliverableId)
    setAssigneeIds(initialTask.assignees.map(a => a.user.id))
    setTitle(initialTask.title ?? '')
    setDescription(initialTask.description ?? '')
    setDueDate(initialTask.due_date ? initialTask.due_date.slice(0, 10) : '')
    setPriority(initialTask.priority ?? 'medium')
    setEstMandays(initialTask.est_mandays != null ? String(initialTask.est_mandays) : '')
    setError('')
    setShowCreateDeliverable(false)
    setShowTaskPresetPopover(false)
  }, [initialTask])

  useEffect(() => {
    setDeliverables([])
    setShowCreateDeliverable(false)
    setNewDeliverableTitle('')
    setNewDeliverableStart('')
    setNewDeliverableEnd('')
    setNewDeliverableMandays('1')
    setNewDeliverablePriority('medium')
    setNewDeliverableError('')
    if (!projectId) { setDeliverableId(''); return }
    fetch(`/api/projects/${projectId}/deliverables`).then(r => r.json()).then((data: any[]) => {
      const mapped = data.map((d: any) => ({
        id: d.id,
        title: d.title,
        planned_end: d.planned_end ?? null,
        priority: d.priority ?? 'medium',
      }))
      setDeliverables(mapped)
      if (initialTask?.context.type === 'deliverable') {
        const initDelivId = String(initialTask.context.id)
        if (mapped.some((d: Deliverable) => String(d.id) === initDelivId)) setDeliverableId(initDelivId)
      } else if (!isEditMode) {
        setDeliverableId('')
      }
    })
  }, [projectId, initialTask, isEditMode])

  // Auto-fill due date/priority from selected deliverable and fetch task category presets.
  useEffect(() => {
    const hasDeliverable = Boolean(deliverableId)
    if (hasDeliverable) {
      const deliv = deliverables.find(d => d.id === Number(deliverableId))
      if (deliv?.planned_end) setDueDate(deliv.planned_end.slice(0, 10))
      else setDueDate('')
      setPriority(deliv?.priority ?? 'medium')
    } else {
      setDelivBudget(null)
      setShowTaskPresetPopover(false)
    }

    // Route currently returns global preset categories (id ignored by endpoint),
    // so we can still offer "select from task preset" in standalone mode.
    fetch(`/api/deliverables/${hasDeliverable ? deliverableId : '0'}/preset-tasks`)
      .then(r => r.json())
      .then(data => {
        const presets = Array.isArray(data) ? data : []
        setPresetTasks(presets)
        setShowTaskPresetPopover(false)
      })
      .catch(() => setPresetTasks([]))

    if (hasDeliverable) {
      fetch(`/api/deliverables/${deliverableId}`)
        .then(r => r.json())
        .then(data => setDelivBudget({ total: data.mandays ?? 0, used: data.used_mandays ?? 0 }))
        .catch(() => setDelivBudget(null))
    }
  }, [deliverableId])

  async function handleCreateDeliverable() {
    if (!projectId) return
    const cleanTitle = newDeliverableTitle.trim()
    if (!cleanTitle) { setNewDeliverableError('Deliverable title is required.'); return }
    if (!newDeliverableStart || !newDeliverableEnd) { setNewDeliverableError('Planned Start and Planned End are required.'); return }
    if (newDeliverableStart > newDeliverableEnd) { setNewDeliverableError('Planned Start cannot be after Planned End.'); return }

    setCreatingDeliverable(true)
    setNewDeliverableError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/deliverables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          mandays: Number(newDeliverableMandays) || 1,
          priority: newDeliverablePriority,
          planned_start: newDeliverableStart,
          planned_end: newDeliverableEnd,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create deliverable')

      const created = {
        id: data.id,
        title: data.title,
        planned_end: data.planned_end ?? null,
        priority: data.priority ?? newDeliverablePriority,
      }
      setDeliverables(prev => [...prev, created])
      setDeliverableId(String(created.id))
      setShowCreateDeliverable(false)
      setDueDate(created.planned_end ? created.planned_end.slice(0, 10) : '')
      setPriority(created.priority ?? 'medium')
      setNewDeliverableTitle('')
      setNewDeliverableStart('')
      setNewDeliverableEnd('')
      setNewDeliverableMandays('1')
      setNewDeliverablePriority('medium')
    } catch (e: any) {
      setNewDeliverableError(e.message || 'Failed to create deliverable')
    } finally {
      setCreatingDeliverable(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isEditMode && projectId && !deliverableId) { setError('Please select a deliverable.'); return }
    if (!title.trim()) { setError('Task category is required.'); return }
    if (!description.trim()) { setError('Task description is required.'); return }
    if (deliverableId && (!estMandays || Number(estMandays) <= 0)) {
      setError('Est. mandays is required when linked to a deliverable.'); return
    }
    if (delivBudget && delivBudget.total > 0) {
      const remaining = delivBudget.total - delivBudget.used
      if (Number(estMandays) > remaining) {
        setError(`Est. mandays exceeds remaining budget (${remaining.toFixed(1)} md available).`); return
      }
    }
    setSaving(true); setError('')
    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      assignee_ids: assigneeIds,
      est_mandays: estMandays ? Number(estMandays) : null,
    }
    if (deliverableId) {
      payload.deliverable_id = Number(deliverableId)
    } else {
      payload.due_date = dueDate || null
      payload.priority = priority
    }

    const res = await fetch(isEditMode && initialTask ? `/api/tasks/${initialTask.id}` : '/api/tasks', {
      method: isEditMode ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      setError((await res.json()).error || (isEditMode ? 'Failed to update task' : 'Failed to create task'))
      setSaving(false); return
    }
    const task = await res.json()
    onAdded(task)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditMode ? 'Edit Task by ' : 'Add Task by '}<span className="text-blue-600 dark:text-blue-400">{creatorName}</span>{' '}
            <span className="text-sm font-medium text-slate-400 dark:text-slate-500">({creatorRole})</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 leading-none"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Two-column section ─────────────────────────────────── */}
          <div className="flex gap-5 items-start">

            {/* LEFT — scope: project / deliverable */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project</label>
                <select className={inputClass} value={projectId} onChange={e => setProjectId(e.target.value)} disabled={isEditMode}>
                  <option value="">No Project Link (Standalone)</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Guide: Link project if this task contributes to a tracked deliverable budget and timeline.</p>
              </div>

              {projectId && (
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deliverable *</label>
                  <select
                    className={inputClass}
                    value={deliverableId}
                    disabled={isEditMode}
                    onChange={e => {
                      const next = e.target.value
                      if (isEditMode) return
                      if (next === CREATE_NEW_DELIVERABLE) {
                        setDeliverableId('')
                        setShowCreateDeliverable(true)
                        setPresetTasks([])
                        setDelivBudget(null)
                        return
                      }
                      setShowCreateDeliverable(false)
                      setDeliverableId(next)
                    }}
                  >
                    <option value="">Select deliverable...</option>
                    {deliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                    {!isEditMode && <option value={CREATE_NEW_DELIVERABLE}>+ Create new...</option>}
                  </select>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Question: Which deliverable outcome will this task move forward?</p>
                  {showCreateDeliverable && (
                    <div className="absolute left-0 right-0 mt-2 z-30 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Create New Deliverable</p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateDeliverable(false)
                            setNewDeliverableError('')
                            setNewDeliverablePriority('medium')
                          }}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs"
                        >
                          Close
                        </button>
                      </div>
                      <input
                        className={inputClass}
                        placeholder="Deliverable title"
                        value={newDeliverableTitle}
                        onChange={e => setNewDeliverableTitle(e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          className={inputClass}
                          value={newDeliverableStart}
                          onChange={e => setNewDeliverableStart(e.target.value)}
                        />
                        <input
                          type="date"
                          className={inputClass}
                          value={newDeliverableEnd}
                          onChange={e => setNewDeliverableEnd(e.target.value)}
                        />
                      </div>
                      <input
                        type="number"
                        min="1"
                        className={inputClass}
                        placeholder="Est. mandays"
                        value={newDeliverableMandays}
                        onChange={e => setNewDeliverableMandays(e.target.value)}
                      />
                      <select
                        className={inputClass}
                        value={newDeliverablePriority}
                        onChange={e => setNewDeliverablePriority(e.target.value)}
                      >
                        <option value="low">Low priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="high">High priority</option>
                        <option value="critical">Critical priority</option>
                      </select>
                      {newDeliverableError && <p className="text-xs text-red-500">{newDeliverableError}</p>}
                      <button
                        type="button"
                        onClick={handleCreateDeliverable}
                        disabled={creatingDeliverable}
                        className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                      >
                        {creatingDeliverable ? 'Creating...' : 'Create & Select'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!projectId && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due date</label>
                    <input type="date" className={inputClass} value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                    <select className={inputClass} value={priority} onChange={e => setPriority(e.target.value)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
              )}

              {deliverableId && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deliverable due date</label>
                      <input type="date" className={`${inputClass} opacity-80`} value={dueDate} readOnly disabled />
                      <p className="text-xs text-slate-400 mt-1">Predefined from selected deliverable</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                      <select className={`${inputClass} opacity-80`} value={priority} disabled>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                      <p className="text-xs text-slate-400 mt-1">Predefined for linked deliverable task</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* RIGHT — task properties: assignees / dates / priority / effort */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Add Partners</label>
                <p className="mb-1 text-xs text-slate-400 dark:text-slate-500">Question: Who should collaborate or co-own this task with you?</p>
                {members.length === 0 ? (
                  <p className="text-xs text-slate-400">No members available</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {members.map(m => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${assigneeIds.includes(m.id)
                            ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                            : 'bg-white dark:bg-navy-900 border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={assigneeIds.includes(m.id)}
                          onChange={() => setAssigneeIds(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                          className="sr-only"
                        />
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-current/10 text-[10px] font-bold shrink-0">
                          {m.name[0].toUpperCase()}
                        </span>
                        {m.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {deliverableId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Est. Mandays <span className="text-red-500">*</span>
                  </label>
                  <p className="mb-1 text-xs text-slate-400 dark:text-slate-500">Guide: Estimate effort for this scope only, not the full deliverable.</p>

                  {/* Budget indicator — only when deliverable has a budget */}
                  {delivBudget && delivBudget.total > 0 && (() => {
                    const remaining = delivBudget.total - delivBudget.used
                    const pending = Number(estMandays) || 0
                    const afterAdd = delivBudget.used + pending
                    const pct = Math.min(100, Math.round((afterAdd / delivBudget.total) * 100))
                    const over = afterAdd > delivBudget.total
                    return (
                      <div className="mb-2 rounded-lg border border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 px-3 py-2 text-xs space-y-1.5">
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>Deliverable budget</span>
                          <span className={over ? 'text-red-500 font-semibold' : remaining <= 0 ? 'text-red-400' : 'text-slate-600 dark:text-slate-300'}>
                            {afterAdd.toFixed(1)} / {delivBudget.total} md
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className={over ? 'text-red-500 font-medium' : 'text-slate-400 dark:text-slate-500'}>
                          {over
                            ? `Exceeds budget by ${(afterAdd - delivBudget.total).toFixed(1)} md`
                            : `${remaining.toFixed(1)} md remaining after existing tasks`}
                        </p>
                      </div>
                    )
                  })()}

                  {delivBudget && delivBudget.total === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">No budget defined for this deliverable — enter for tracking only.</p>
                  )}

                  <input
                    type="number" min="0.5" step="0.5"
                    className={`${inputClass} ${!estMandays ? 'border-amber-400 dark:border-amber-600 focus:ring-amber-500' : ''}`}
                    placeholder="e.g. 1.5"
                    value={estMandays}
                    onChange={e => setEstMandays(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Guide: `1 md` = 1 working day effort. Use `0.5 md` (~half day), `1 md` (full day), `2 md` (about 2 working days).
                  </p>
                  {suggestedStartDate && (
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                      Suggested start date (based on due date): {new Date(suggestedStartDate).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )}

              {!projectId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Est. Mandays
                  </label>
                  <input
                    type="number" min="0.5" step="0.5"
                    className={inputClass}
                    placeholder="e.g. 1.5"
                    value={estMandays}
                    onChange={e => setEstMandays(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Guide: `1 md` = 1 working day effort. Use `0.5 md` (~half day), `1 md` (full day), `2 md` (about 2 working days).
                  </p>
                  {suggestedStartDate && (
                    <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                      Suggested start date (based on due date): {new Date(suggestedStartDate).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Full-width: title + description ───────────────────── */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Task Category *{' '}
              {presetTasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTaskPresetPopover(v => !v)}
                  className="text-blue-600 dark:text-blue-300 hover:underline font-normal"
                >
                  or task preset
                </button>
              )}
            </label>
            {presetTasks.length > 0 && showTaskPresetPopover && (
              <div className="mb-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-3 max-h-64 overflow-y-auto">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Task preset catalog (click category to use):</p>
                <div className="space-y-2">
                  {presetTasks.map((p, i) => (
                    <div
                      key={i}
                      className="w-full text-left rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {p.type && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_TYPE_BADGE[p.type] ?? CATEGORY_TYPE_BADGE.frontend}`}>
                            {p.type}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setTitle(p.name)
                            setShowTaskPresetPopover(false)
                          }}
                          className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-300"
                        >
                          {p.name}
                        </button>
                      </div>
                      {p.samples && p.samples.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {p.samples.map((s, si) => (
                            <button
                              key={si}
                              type="button"
                              onClick={() => {
                                setTitle(`${s.name} (${p.name})`)
                                if (s.est_mandays != null) setEstMandays(String(s.est_mandays))
                                setShowTaskPresetPopover(false)
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[11px] text-slate-500 dark:text-slate-400 transition-colors"
                            >
                              <span>{s.name}</span>
                              <span>{s.est_mandays != null ? `${s.est_mandays} md` : '—'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <input className={inputClass} placeholder="e.g. Backend API - User Authentication" value={title} onChange={e => setTitle(e.target.value)} />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Questionnaire: What exactly will be built? Use “Category - Specific Scope”.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Specific Task/scope *</label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={scopePlaceholder}
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Guide based on selected category: {scopePlaceholder}
            </p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1 border-t border-slate-100 dark:border-navy-700">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors mt-3">
              {saving ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Task')}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 py-2 rounded-lg text-sm mt-3">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const COLUMNS: { id: string; label: string; color: string; description: string }[] = [
  { id: 'Todo', label: 'To Do', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200', description: 'Tasks queued and ready to be picked up. Drag a card to In Progress when work begins.' },
  { id: 'InProgress', label: 'In Progress', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300', description: 'Tasks actively being worked on and updated by assignees.' },
  { id: 'InReview', label: 'To Review', color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300', description: 'Tasks completed by the assignee and awaiting review or approval before closing.' },
  { id: 'Done', label: 'Done', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300', description: 'Tasks that have been reviewed and signed off. Contributes to project progress.' },
]

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
}

const STATUS_DOT: Record<string, string> = {
  Done: 'bg-green-500',
  InProgress: 'bg-orange-400',
  OnHold: 'bg-red-400',
  Pending: 'bg-slate-300 dark:bg-slate-500',
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
    if (completed > d) {
      return <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">{dateStr} · Submitted late</span>
    }
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

function cardHeaderScope(task: Task): string {
  return task.description?.trim() || task.title
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

  // Filter state
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  // Modal
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [pendingStatus, setPendingStatus] = useState<{ taskId: number; target: StatusTarget } | null>(null)

  // Load projects for chips
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: any[]) => setProjects(data.map(p => ({
        id: p.id,
        title: p.title,
        computedProgress: p.computedProgress ?? 0,
        computedStatus: p.computedStatus ?? 'Pending',
      }))))
  }, [])

  // Load tasks
  useEffect(() => {
    loadTasks()
  }, [])

  function loadTasks() {
    setLoading(true)
    fetch('/api/tasks/team')
      .then(r => r.json())
      .then((tasks: Task[]) => { setBoard(buildBoard(tasks)); setLoading(false) })
  }

  function getFilteredBoard(): BoardState {
    const next: BoardState = {}
    for (const col of COLUMNS) {
      next[col.id] = board[col.id].filter(t => {
        const matchPriority = !filterPriority || t.priority === filterPriority
        const matchProject = !selectedProjectId || String(t.context.project?.id ?? '') === selectedProjectId
        return matchPriority && matchProject
      })
    }
    return next
  }

  function handleTaskAdded(_task: Task) {
    loadTasks()
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
  const editingTask = editingTaskId !== null
    ? COLUMNS.flatMap(c => board[c.id]).find(t => t.id === editingTaskId) ?? null
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
      setBoard(prev => {
        const next: BoardState = {}
        for (const col of COLUMNS) next[col.id] = [...prev[col.id]]
        for (const col of COLUMNS) {
          const idx = next[col.id].findIndex(t => t.id === updated.id)
          if (idx !== -1) {
            const existing = next[col.id][idx]
            next[col.id] = next[col.id].filter(t => t.id !== updated.id)
            const targetCol = next[updated.status] ? updated.status : 'Todo'
            next[targetCol] = [...next[targetCol], { ...existing, ...updated }]
            break
          }
        }
        return next
      })
    }
  }

  function handlePopupConfirm(taskId: number, newStatus: string, opts: { actual_date?: string; blocked_reason?: string }) {
    setPendingStatus(null)
    doStatusUpdate(taskId, newStatus, opts)
  }

  async function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const taskId = Number(draggableId)
    const newStatus = destination.droppableId

    // Find the task to check permissions
    const task = COLUMNS.flatMap(c => board[c.id]).find(t => t.id === taskId)
    if (!task) return

    // Non-managers can only drag their own assigned tasks
    if (!isManager && !task.assignees.some(a => a.user.id === currentUserId)) return

    // InReview cannot be dragged back to Todo
    if (source.droppableId === 'InReview' && newStatus === 'Todo') return
    // Non-managers cannot skip to InReview from Todo or move to Done
    if (!isManager && newStatus === 'InReview' && source.droppableId !== 'InProgress') return
    if (!isManager && newStatus === 'Done') return

    const POPUP_STATUSES: StatusTarget[] = ['InProgress', 'InReview', 'Done', 'Blocked']
    if (POPUP_STATUSES.includes(newStatus as StatusTarget)) {
      setPendingStatus({ taskId, target: newStatus as StatusTarget })
    } else {
      doStatusUpdate(taskId, newStatus, {})
    }
  }

  async function moveTask(taskId: number, currentStatus: string, direction: 'next' | 'prev') {
    const colIds = COLUMNS.map(c => c.id)
    const newIdx = colIds.indexOf(currentStatus) + (direction === 'next' ? 1 : -1)
    if (newIdx < 0 || newIdx >= colIds.length) return
    const newStatus = colIds[newIdx]

    // InReview cannot go back to Todo
    if (currentStatus === 'InReview' && newStatus === 'Todo') return
    // Members cannot skip directly to InReview from Todo
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

  return (
    <>
      {pendingStatus && pendingTask && (
        <StatusChangeModal
          taskId={pendingTask.id}
          taskTitle={pendingTask.title}
          taskScope={pendingTask.description ?? null}
          targetStatus={pendingStatus.target}
          projectTitle={pendingTask.context.project?.title ?? null}
          linkedTitle={pendingTask.context.title}
          linkedType={pendingTask.context.type}
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
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 min-w-0 scrollbar-none">
            <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 mr-1">Projects:</span>
            <button
              onClick={() => setSelectedProjectId('')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${selectedProjectId === ''
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              title="Show all projects"
            >
              All
            </button>
            {projects.map(p => {
              const dotClass = STATUS_DOT[p.computedStatus ?? 'Pending'] ?? STATUS_DOT.Pending
              const progress = p.computedProgress ?? 0
              const isActive = String(p.id) === selectedProjectId
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(String(p.id))}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${isActive
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
                    }`}
                  title={p.title}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-white/70' : dotClass}`} />
                  <span className="max-w-[120px] truncate">{p.title}</span>
                  <span className={`font-bold tabular-nums ${isActive ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>{progress}%</span>
                </button>
              )
            })}
          </div>

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

          {(selectedProjectId || filterPriority) && (
            <button
              onClick={() => { setSelectedProjectId(''); setFilterPriority('') }}
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
                            <li>✓ Edit any To Do task (custom only)</li>
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
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-4 gap-4 items-start">
              {COLUMNS.map(col => (
                <div key={col.id} className="flex flex-col">
                  {/* Column header */}
                  <div className={`rounded-lg px-3 py-2 mb-1 ${col.color}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm">{col.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium opacity-70">{filteredBoard[col.id].length}</span>
                        {col.id === 'Todo' && (
                          <button
                            onClick={() => { setEditingTaskId(null); setShowAddModal(true) }}
                            className="w-5 h-5 flex items-center justify-center rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold leading-none"
                            title="Add task"
                          >+</button>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] opacity-60 mt-0.5 leading-snug">{col.description}</p>
                  </div>
                  <div className="mb-3" />

                  {/* Cards */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex flex-col gap-2 min-h-32 rounded-lg p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                      >
                        {filteredBoard[col.id].length === 0 && !snapshot.isDraggingOver && (
                          <div className="rounded-lg border-2 border-dashed border-slate-100 dark:border-navy-700 py-6 text-center text-xs text-slate-300 dark:text-slate-600">
                            No tasks
                          </div>
                        )}
                        {filteredBoard[col.id].map((task, index) => (
                          <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`rounded-lg p-3 shadow-sm transition-all select-none ${reviewCardStyle(task)} ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400 rotate-1' : 'hover:shadow-md'}`}
                              >
                                <div className="flex items-start justify-between gap-1 mb-0.5">
                                  <p className="font-medium text-sm text-slate-800 dark:text-white leading-snug">{cardHeaderScope(task)}</p>
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
                                {task.description?.trim() && (
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">Category: {task.title}</p>
                                )}
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
                                  <span
                                    className={`text-[10px] px-1 py-px rounded font-semibold uppercase ${task.context.type === 'deliverable'
                                        ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300'
                                        : task.context.type === 'feature'
                                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                                      }`}
                                  >
                                    {task.context.type === 'deliverable' ? 'Deliv' : task.context.type === 'feature' ? 'Feat' : 'Task'}
                                  </span>
                                  <p className="text-xs text-blue-600 dark:text-blue-400 truncate">{task.context.title}</p>
                                </div>
                                <p className="text-xs text-slate-400 truncate">{task.context.project?.title ?? 'No Project Link'}</p>

                                {/* Due date */}
                                {task.status === 'InProgress' && task.actual_start && (
                                  <div className="mt-1">{startedDateDisplay(task.actual_start, task.status)}</div>
                                )}
                                {task.due_date && (
                                  <div className="mt-1">{dueDateDisplay(task.due_date, task.status, task.actual_end ?? null)}</div>
                                )}

                                {/* Assignees + Update */}
                                <div className="flex items-center justify-between mt-2 gap-1">
                                  {task.assignees.length > 0 ? (
                                    <span className="flex items-center gap-0.5 min-w-0 flex-wrap">
                                      {task.assignees.map(a => (
                                        <span key={a.user.id} title={a.user.name}>
                                          <AssigneeAvatar name={a.user.name} />
                                        </span>
                                      ))}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-300 dark:text-slate-600 italic">Unassigned</span>
                                  )}
                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* ← → move buttons */}
                                    {(() => {
                                      const canInteract = isManager || task.assignees.some(a => a.user.id === currentUserId)
                                      const showPrev = canInteract && col.id !== 'Todo' && (isManager || col.id !== 'Done')
                                      const showNext = canInteract && col.id !== 'Done' && (isManager || col.id !== 'InReview')
                                      return (
                                        <>
                                          {showPrev && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); moveTask(task.id, col.id, 'prev') }}
                                              className="text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700"
                                              title="Move back"
                                            >←</button>
                                          )}
                                          {showNext && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); moveTask(task.id, col.id, 'next') }}
                                              className="text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700"
                                              title="Move forward"
                                            >→</button>
                                          )}
                                        </>
                                      )
                                    })()}
                                    {task.status === 'InReview' && (
                                      <button
                                        onClick={() => setActiveTaskId(task.id)}
                                        className="text-xs px-2 py-0.5 rounded border border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 font-medium"
                                      >
                                        Review
                                      </button>
                                    )}
                                    {isManager && task.status !== 'InReview' && (
                                      task.status === 'Todo' ? (
                                        <button
                                          onClick={() => { setEditingTaskId(task.id); setShowAddModal(true) }}
                                          className="p-1 rounded border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                          title="Edit task"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => setActiveTaskId(task.id)}
                                          className={`text-xs px-2 py-0.5 rounded border ${task.status === 'InProgress'
                                            ? 'border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium'
                                            : 'border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700'
                                            }`}
                                        >
                                          {task.status === 'InProgress' ? 'Update' : 'View'}
                                        </button>
                                      )
                                    )}
                                  </div>
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
        )}

        {showAddModal && (
          <AddTaskModal
            projects={projects}
            initialTask={editingTask}
            onClose={() => { setShowAddModal(false); setEditingTaskId(null) }}
            onAdded={handleTaskAdded}
          />
        )}

        {activeTask && (
          <TaskUpdateModal
            taskId={activeTask.id}
            taskTitle={activeTask.title}
            taskScope={activeTask.description ?? null}
            moduleTitle={activeTask.context.module?.title ?? null}
            featureTitle={activeTask.context.title}
            projectTitle={activeTask.context.project?.title ?? 'No Project Link'}
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
            onClose={() => { setActiveTaskId(null); loadTasks() }}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </>
  )
}
