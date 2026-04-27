'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import FeatureTaskList from './FeatureTaskList'
import { Pencil, Trash2, X } from 'lucide-react'

interface Task {
  status: string
  est_mandays?: number | null
  _count?: { issues: number }
}

interface Deliverable {
  id: number
  title: string
  description?: string | null
  mandays: number
  priority?: string
  status: string
  order: number
  planned_start?: string | null
  planned_end?: string | null
  actual_start?: string | null
  actual_end?: string | null
  is_actual_override?: boolean
  module_id?: number | null
  tasks: Task[]
  _count?: { issues: number }
}

interface Member {
  id: number
  name: string
}

interface Props {
  projectId: number
  projectTitle: string
  userRole: string
  canManage?: boolean
  projectStartDate: string
  projectDeadline: string
}

const TASK_PROGRESS_WEIGHT: Record<string, number> = {
  Todo: 0,
  InProgress: 50,
  InReview: 80,
  Done: 100,
  Blocked: 0,
}

const STATUS_BADGE: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OnHold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

const STATUS_LABELS: Record<string, string> = {
  Pending: 'Pending',
  InProgress: 'In Progress',
  Done: 'Done',
  OnHold: 'On Hold',
}

const BLANK_DELIVERABLE_FORM = {
  title: '',
  description: '',
  mandays: '1',
  priority: 'medium',
  status: 'Pending',
  planned_start: '',
  planned_end: '',
  actual_start: '',
  actual_end: '',
  is_actual_override: false,
}

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

function fmt(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

function toInputDate(iso?: string | null) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function notifyProjectDetailChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('project-detail-data-changed'))
  }
}

function countWorkdays(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 1

  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return Math.max(1, count)
}

function taskProgress(tasks: Task[]) {
  const done = tasks.filter(t => t.status === 'Done').length
  const pct = tasks.length > 0
    ? Math.round(tasks.reduce((s, t) => s + (TASK_PROGRESS_WEIGHT[t.status] ?? 0), 0) / tasks.length)
    : 0
  return { done, total: tasks.length, pct }
}

function DeliverableCard({
  deliverable,
  userRole,
  canManage = false,
  members,
  expandedId,
  setExpandedId,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  projectStartDate,
  projectDeadline,
}: {
  deliverable: Deliverable
  userRole: string
  canManage?: boolean
  members: Member[]
  expandedId: number | null
  setExpandedId: (id: number | null) => void
  onEdit: (d: Deliverable) => void
  onDelete: (id: number, title: string) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  projectStartDate?: string
  projectDeadline?: string
}) {
  const { done, total, pct } = taskProgress(deliverable.tasks)
  const isExpanded = expandedId === deliverable.id
  const openIssueCount = (deliverable._count?.issues ?? 0) + deliverable.tasks.reduce((s, t) => s + (t._count?.issues ?? 0), 0)
  const allocatedMd = deliverable.tasks.reduce((s, t) => s + Number(t.est_mandays ?? 0), 0)

  return (
    <div className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 uppercase tracking-wide">Deliverable</span>
              <h4 className="font-medium text-slate-900 dark:text-white text-xs">{deliverable.title}</h4>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[deliverable.status]}`}>
                {STATUS_LABELS[deliverable.status]}
              </span>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${PRIORITY_BADGE[deliverable.priority ?? 'medium']}`}>
                {deliverable.priority ?? 'medium'}
              </span>
              <span className="text-xs font-medium text-amber-500 dark:text-amber-400">
                {allocatedMd}/{deliverable.mandays} md
              </span>
              {openIssueCount > 0 && (
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" title="Open issues">
                  ⚠ {openIssueCount} issue{openIssueCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {deliverable.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{deliverable.description}</p>
            )}

            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
              <span>
                Planned:{' '}
                {deliverable.planned_start
                  ? <span className="text-slate-600 dark:text-slate-300">{fmt(deliverable.planned_start)} → {deliverable.planned_end ? fmt(deliverable.planned_end) : '—'}</span>
                  : <span className="italic">Not set</span>}
              </span>
              <span>
                Actual:{' '}
                {deliverable.actual_start
                  ? <span className="text-slate-600 dark:text-slate-300">
                    {deliverable.is_actual_override && <span title="Manually set by PM" className="mr-1">📌</span>}
                    {fmt(deliverable.actual_start)} → {deliverable.actual_end ? fmt(deliverable.actual_end) : 'ongoing'}
                  </span>
                  : <span className="italic">Not started</span>}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">{done}/{total} tasks</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canManage && (
              <>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={onMoveUp}
                    disabled={!canMoveUp}
                    className="p-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed leading-none text-[10px]"
                    title="Move up"
                  >▲</button>
                  <button
                    onClick={onMoveDown}
                    disabled={!canMoveDown}
                    className="p-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed leading-none text-[10px]"
                    title="Move down"
                  >▼</button>
                </div>
                <button onClick={() => onEdit(deliverable)} className="p-1 border border-yellow-200 dark:border-yellow-700 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/30 text-yellow-500 dark:text-yellow-400" title="Edit deliverable">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(deliverable.id, deliverable.title)} className="p-1 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400" title="Delete deliverable">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={() => setExpandedId(isExpanded ? null : deliverable.id)}
              className="text-xs px-2 py-1 border border-slate-200 dark:border-navy-600 rounded hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300"
            >
              {isExpanded ? 'Hide Tasks' : `Tasks (${total}) · ${pct}%`}
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-navy-700 pt-3">
          <FeatureTaskList
            deliverableId={deliverable.id}
            deliverableTitle={deliverable.title}
            deliverableMandays={deliverable.mandays}
            deliverablePlannedStart={deliverable.planned_start ?? null}
            deliverablePlannedEnd={deliverable.planned_end ?? null}
            projectStart={projectStartDate ?? null}
            projectDeadline={projectDeadline ?? null}
            userRole={userRole}
            canManage={canManage}
            developers={members.map(m => ({ user: m }))}
          />
        </div>
      )}
    </div>
  )
}

export default function DeliverableSection({ projectId, projectTitle, userRole, canManage = false, projectStartDate, projectDeadline }: Props) {
  const router = useRouter()
  const projMin = toInputDate(projectStartDate)
  const projMax = toInputDate(projectDeadline)

  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const [showDelivModal, setShowDelivModal] = useState(false)
  const [editingDeliv, setEditingDeliv] = useState<Deliverable | null>(null)
  const [delivForm, setDelivForm] = useState(BLANK_DELIVERABLE_FORM)
  const [delivSaving, setDelivSaving] = useState(false)
  const [delivError, setDelivError] = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [showHelp, setShowHelp] = useState(false)
  const [showTitleHelp, setShowTitleHelp] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  const titleHelpRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAll()
    fetch('/api/users?include_managers=true').then(r => r.json()).then(setMembers)
  }, [projectId])

  useEffect(() => {
    function handleTaskChanged() {
      fetchAll()
    }
    window.addEventListener('project-detail-data-changed', handleTaskChanged)
    return () => window.removeEventListener('project-detail-data-changed', handleTaskChanged)
  }, [])

  useEffect(() => {
    if (!showHelp) return
    function handleClick(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showHelp])

  useEffect(() => {
    if (!showTitleHelp) return
    function handleClick(e: MouseEvent) {
      if (titleHelpRef.current && !titleHelpRef.current.contains(e.target as Node)) setShowTitleHelp(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showTitleHelp])

  async function fetchAll() {
    setLoading(true)
    const delivData = await fetch(`/api/projects/${projectId}/deliverables`).then(r => r.json())
    setDeliverables(delivData)
    setLoading(false)
  }

  function refreshProjectDetails() {
    notifyProjectDetailChanged()
    router.refresh()
  }

  function openAddDeliv() {
    setEditingDeliv(null)
    setDelivForm(BLANK_DELIVERABLE_FORM)
    setDelivError('')
    setShowDelivModal(true)
  }

  function openEditDeliv(d: Deliverable) {
    setEditingDeliv(d)
    setDelivForm({
      title: d.title,
      description: d.description ?? '',
      mandays: d.mandays.toString(),
      priority: d.priority ?? 'medium',
      status: d.status,
      planned_start: toInputDate(d.planned_start),
      planned_end: toInputDate(d.planned_end),
      actual_start: toInputDate(d.actual_start),
      actual_end: toInputDate(d.actual_end),
      is_actual_override: d.is_actual_override ?? false,
    })
    setDelivError('')
    setShowDelivModal(true)
  }

  async function saveDeliv() {
    const title = delivForm.title.trim()
    if (!title) {
      setDelivError('Title is required')
      return
    }
    if (!delivForm.planned_start || !delivForm.planned_end) {
      setDelivError('Planned Start and Planned End are required')
      return
    }
    if (delivForm.planned_start > delivForm.planned_end) {
      setDelivError('Start date cannot be after end date')
      return
    }
    if (delivForm.planned_start < projMin || delivForm.planned_end > projMax) {
      setDelivError('Planned dates must be within project start and deadline')
      return
    }

    setDelivSaving(true)
    setDelivError('')

    const datePayload = {
      planned_start: delivForm.planned_start || null,
      planned_end: delivForm.planned_end || null,
    }

    try {
      if (editingDeliv) {
        const actPayload: Record<string, unknown> = {}
        if (delivForm.actual_start) {
          actPayload.actual_start = delivForm.actual_start
          actPayload.is_actual_override = true
        }
        if (delivForm.actual_end) {
          actPayload.actual_end = delivForm.actual_end
          actPayload.is_actual_override = true
        }
        if (!delivForm.actual_start && !delivForm.actual_end && editingDeliv.is_actual_override) {
          actPayload.actual_start = null
          actPayload.actual_end = null
          actPayload.is_actual_override = false
        }

        const res = await fetch(`/api/deliverables/${editingDeliv.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: delivForm.description,
            mandays: Number(delivForm.mandays),
            priority: delivForm.priority,
            status: delivForm.status,
            ...datePayload,
            ...actPayload,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      } else {
        const res = await fetch(`/api/projects/${projectId}/deliverables`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: delivForm.description,
            mandays: Number(delivForm.mandays),
            priority: delivForm.priority,
            ...datePayload,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      }

      setShowDelivModal(false)
      fetchAll()
      refreshProjectDetails()
    } catch (err: any) {
      setDelivError(err.message || 'Something went wrong')
    } finally {
      setDelivSaving(false)
    }
  }

  function deleteDeliv(id: number, title: string) {
    setDeleteError('')
    setDeleteConfirm({ id, title })
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    setDeleteError('')

    const res = await fetch(`/api/deliverables/${deleteConfirm.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeliverables(prev => prev.filter(d => d.id !== deleteConfirm.id))
      setDeleteConfirm(null)
      refreshProjectDetails()
    } else {
      const data = await res.json().catch(() => ({}))
      setDeleteError(data.error || 'Delete failed')
    }

    setDeleting(false)
  }

  async function moveDeliverable(index: number, direction: 'up' | 'down') {
    const sorted = [...deliverables].sort((a, b) => a.order - b.order)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= sorted.length) return

    const a = sorted[index]
    const b = sorted[targetIndex]

    await Promise.all([
      fetch(`/api/deliverables/${a.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: b.order }),
      }),
      fetch(`/api/deliverables/${b.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: a.order }),
      }),
    ])

    setDeliverables(prev =>
      prev.map(d => {
        if (d.id === a.id) return { ...d, order: b.order }
        if (d.id === b.id) return { ...d, order: a.order }
        return d
      })
    )
    refreshProjectDetails()
  }

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
  const sortedDeliverables = [...deliverables].sort((a, b) => a.order - b.order)

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Deliverables &amp; Tasks</h2>

          <div className="relative" ref={helpRef}>
            <button
              onClick={() => setShowHelp(v => !v)}
              className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center border border-blue-400 dark:border-blue-500 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              aria-label="Deliverables and tasks help"
            >
              ?
            </button>

            {showHelp && (
              <div className="absolute left-0 top-7 z-50 w-80 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-xl p-4 text-xs text-slate-600 dark:text-slate-300 space-y-3">
                <div className="absolute -top-2 left-3 w-3 h-3 rotate-45 bg-white dark:bg-navy-800 border-l border-t border-slate-200 dark:border-navy-600" />

                <div>
                  <p className="font-semibold text-slate-800 dark:text-white mb-1">Project Structure</p>
                  <p className="leading-relaxed"><strong>Project → Deliverable → Task</strong></p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-white mb-1">What is a Deliverable?</p>
                  <p className="leading-relaxed">A deliverable is a concrete outcome under a project. It has planned/actual dates, effort (mandays), and status for management-level tracking.</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-white mb-1">What is a Task?</p>
                  <p className="leading-relaxed">A task is a smaller execution unit inside a deliverable. Tasks carry assignee, due date, and daily execution status.</p>
                </div>

                <button
                  onClick={() => setShowHelp(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                >
                  Close
                </button>
              </div>
            )}
          </div>

          {!loading && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button onClick={openAddDeliv} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg" style={{ display: canManage ? undefined : 'none' }}>
          + Add Deliverable
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 py-4 text-center">Loading...</p>
      ) : sortedDeliverables.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No deliverables yet. Click &quot;+ Add Deliverable&quot; to create one.</p>
      ) : (
        <div className="space-y-2">
          {sortedDeliverables.map((d, idx) => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              userRole={userRole}
              canManage={canManage}
              members={members}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              onEdit={openEditDeliv}
              onDelete={deleteDeliv}
              canMoveUp={idx > 0}
              canMoveDown={idx < sortedDeliverables.length - 1}
              onMoveUp={() => moveDeliverable(idx, 'up')}
              onMoveDown={() => moveDeliverable(idx, 'down')}
              projectStartDate={projectStartDate}
              projectDeadline={projectDeadline}
            />
          ))}
        </div>
      )}

      {showDelivModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingDeliv ? 'Edit Deliverable' : `New Deliverable — ${projectTitle}`}
              </h2>
              <button onClick={() => setShowDelivModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Project timeline reference */}
            <div className="mb-4 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/60 p-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Project Timeline</p>
              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 mb-3">
                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">{fmt(projectStartDate)}</span>
                <span className="flex-1 border-t border-dashed border-slate-300 dark:border-navy-600" />
                <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium">{fmt(projectDeadline)}</span>
              </div>
              {sortedDeliverables.length > 0 && (
                <>
                  <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">Existing Deliverables</p>
                  <div className="space-y-1">
                    {sortedDeliverables.map(d => (
                      <div key={d.id} className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${editingDeliv?.id === d.id ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50' : 'bg-white dark:bg-navy-800'}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${d.status === 'Done' ? 'bg-green-500' : d.status === 'InProgress' ? 'bg-orange-400' : d.status === 'OnHold' ? 'bg-yellow-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        <span className="flex-1 truncate text-slate-700 dark:text-slate-200 font-medium">{d.title}</span>
                        <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                          {d.planned_start ? `${fmt(d.planned_start)} → ${d.planned_end ? fmt(d.planned_end) : '—'}` : <span className="italic">No dates</span>}
                        </span>
                        {editingDeliv?.id === d.id && <span className="text-[10px] font-semibold text-yellow-600 dark:text-yellow-400 shrink-0">editing</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Title *</label>
                  <div className="relative" ref={titleHelpRef}>
                    <button
                      type="button"
                      onClick={() => setShowTitleHelp(v => !v)}
                      className="w-5 h-5 text-xs font-bold flex items-center justify-center text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
                      aria-label="Deliverable title examples"
                    >
                      ?
                    </button>

                    {showTitleHelp && (
                      <div className="absolute left-0 top-6 z-50 w-80 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-xl p-3 text-xs text-slate-600 dark:text-slate-300">
                        <p className="font-semibold text-slate-800 dark:text-white mb-1">Deliverable examples (project terms)</p>
                        <ul className="list-disc ml-4 space-y-1">
                          <li>Backend API Integration</li>
                          <li>Data Migration Dry Run</li>
                          <li>UAT Completion &amp; Sign-Off</li>
                          <li>Dashboard Release v1</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <input
                  className={inputClass}
                  value={delivForm.title}
                  onChange={e => setDelivForm({ ...delivForm, title: e.target.value })}
                  placeholder="e.g. Dashboard Release v1"
                  autoFocus
                />
                <p className="mt-1 text-[11px] text-slate-400">Preset titles are now available during task creation.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea className={`${inputClass} resize-none`} rows={2} value={delivForm.description} onChange={e => setDelivForm({ ...delivForm, description: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Planned Start *</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={delivForm.planned_start}
                    min={projMin}
                    max={delivForm.planned_end || projMax}
                    onChange={e => {
                      const start = e.target.value
                      const mandays = start && delivForm.planned_end ? String(countWorkdays(start, delivForm.planned_end)) : delivForm.mandays
                      setDelivForm({ ...delivForm, planned_start: start, mandays })
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Planned End *</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={delivForm.planned_end}
                    min={delivForm.planned_start || projMin}
                    max={projMax}
                    onChange={e => {
                      const end = e.target.value
                      const mandays = delivForm.planned_start && end ? String(countWorkdays(delivForm.planned_start, end)) : delivForm.mandays
                      setDelivForm({ ...delivForm, planned_end: end, mandays })
                    }}
                  />
                </div>
              </div>

              {editingDeliv && canManage && (
                <div className="rounded-lg border border-blue-200 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-900/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Actual Dates (PM Override)</p>
                    {editingDeliv.is_actual_override && (
                      <button
                        type="button"
                        className="text-xs text-slate-400 hover:text-red-500"
                        onClick={() => setDelivForm(f => ({ ...f, actual_start: '', actual_end: '' }))}
                        title="Clear override — revert to auto-calculated dates"
                      >
                        Reset to auto
                      </button>
                    )}
                  </div>

                  {editingDeliv.is_actual_override && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">📌 Dates manually set by PM</p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Actual Start</label>
                      <input
                        type="date"
                        className={inputClass}
                        value={delivForm.actual_start}
                        onChange={e => setDelivForm(f => ({ ...f, actual_start: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">Actual End</label>
                      <input
                        type="date"
                        className={inputClass}
                        value={delivForm.actual_end}
                        onChange={e => setDelivForm(f => ({ ...f, actual_end: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Est. Mandays *</label>
                  <input type="number" min="1" className={inputClass} value={delivForm.mandays} onChange={e => setDelivForm({ ...delivForm, mandays: e.target.value })} />
                  <p className="mt-1 text-[11px] text-slate-400">Auto-calculation from Planned Start/End excludes weekends.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Priority *</label>
                  <select className={inputClass} value={delivForm.priority} onChange={e => setDelivForm({ ...delivForm, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              {editingDeliv && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select className={inputClass} value={delivForm.status} onChange={e => setDelivForm({ ...delivForm, status: e.target.value })}>
                    <option value="Pending">Pending</option>
                    <option value="InProgress">In Progress</option>
                    <option value="Done">Done</option>
                    <option value="OnHold">On Hold</option>
                  </select>
                </div>
              )}

              {delivError && <p className="text-xs text-red-500">{delivError}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setShowDelivModal(false)} className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700">Cancel</button>
              <button onClick={saveDeliv} disabled={delivSaving} className="px-4 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
                {delivSaving ? 'Saving...' : editingDeliv ? 'Save Changes' : 'Create Deliverable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Delete Deliverable</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
              Are you sure you want to delete <strong className="text-slate-800 dark:text-white">{deleteConfirm.title}</strong>?
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
              Deliverable cannot be deleted if it has tasks.
            </p>
            {deleteError && <p className="text-xs text-red-500 mb-3">{deleteError}</p>}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteError('') }}
                disabled={deleting}
                className="px-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
