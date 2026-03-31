'use client'

import { useState, useEffect, useRef } from 'react'
import FeatureTaskList from './FeatureTaskList'
import { Pencil, Trash2, X } from 'lucide-react'

interface Task { status: string }

interface Deliverable {
  id: number
  title: string
  description?: string | null
  mandays: number
  status: string
  planned_start?: string | null
  planned_end?: string | null
  actual_start?: string | null
  actual_end?: string | null
  module_id?: number | null
  tasks: Task[]
}

interface Module {
  id: number
  title: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  order: number
}

interface Member {
  id: number
  name: string
}

interface DeliverableRecord {
  id: number
  title: string
  description?: string | null
}

interface Props {
  projectId: number
  userRole: string
  projectStartDate: string
  projectDeadline: string
}

const STATUS_BADGE: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OnHold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}
const STATUS_LABELS: Record<string, string> = {
  Pending: 'Pending', InProgress: 'In Progress', Done: 'Done', OnHold: 'On Hold',
}

function fmt(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

function taskProgress(tasks: Task[]) {
  const done = tasks.filter(t => t.status === 'Done').length
  return { done, total: tasks.length, pct: tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0 }
}

function DeliverableCard({
  deliverable, userRole, members, expandedId, setExpandedId, onEdit, onDelete,
}: {
  deliverable: Deliverable
  userRole: string
  members: Member[]
  expandedId: number | null
  setExpandedId: (id: number | null) => void
  onEdit: (d: Deliverable) => void
  onDelete: (id: number, title: string) => void
}) {
  const { done, total, pct } = taskProgress(deliverable.tasks)
  const isExpanded = expandedId === deliverable.id

  return (
    <div className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 uppercase tracking-wide">Deliverable</span>
              <h4 className="font-medium text-slate-900 dark:text-white text-sm">{deliverable.title}</h4>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[deliverable.status]}`}>
                {STATUS_LABELS[deliverable.status]}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{deliverable.mandays} md</span>
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
                  ? <span className="text-slate-600 dark:text-slate-300">{fmt(deliverable.actual_start)} → {deliverable.actual_end ? fmt(deliverable.actual_end) : 'ongoing'}</span>
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
            {userRole === 'manager' && (
              <>
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
              {isExpanded ? 'Hide Tasks' : `Tasks (${total})`}
            </button>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-navy-700 pt-3">
          <FeatureTaskList
            deliverableId={deliverable.id}
            userRole={userRole}
            developers={members.map(m => ({ user: m }))}
          />
        </div>
      )}
    </div>
  )
}

const BLANK_DELIVERABLE_FORM = { title: '', description: '', mandays: '1', status: 'Pending', module_id: '', planned_start: '', planned_end: '' }
const BLANK_MODULE_FORM = { title: '', description: '', start_date: '', end_date: '' }

function toInputDate(iso?: string | null) {
  if (!iso) return ''
  return iso.slice(0, 10) // 'YYYY-MM-DD'
}

export default function DeliverableSection({ projectId, userRole, projectStartDate, projectDeadline }: Props) {
  const projMin = toInputDate(projectStartDate)
  const projMax = toInputDate(projectDeadline)
  const [modules, setModules] = useState<Module[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<number | 'ungrouped'>>(new Set(['ungrouped']))

  // Deliverable modal
  const [showDelivModal, setShowDelivModal] = useState(false)
  const [editingDeliv, setEditingDeliv] = useState<Deliverable | null>(null)
  const [delivForm, setDelivForm] = useState(BLANK_DELIVERABLE_FORM)
  const [delivSaving, setDelivSaving] = useState(false)
  const [delivError, setDelivError] = useState('')
  const [delivRecords, setDeliverableRecords] = useState<DeliverableRecord[]>([])
  const [titleIsCustom, setTitleIsCustom] = useState(false)

  // Module modal
  const [showModuleModal, setShowModuleModal] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [moduleForm, setModuleForm] = useState(BLANK_MODULE_FORM)
  const [moduleSaving, setModuleSaving] = useState(false)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'module' | 'deliverable'; id: number; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    fetchAll()
    fetch('/api/users').then(r => r.json()).then(setMembers)
    fetch('/api/deliverable-records').then(r => r.json()).then(d => setDeliverableRecords(Array.isArray(d) ? d : []))
  }, [projectId])

  async function fetchAll() {
    setLoading(true)
    const [modData, delivData] = await Promise.all([
      fetch(`/api/modules?project_id=${projectId}`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/deliverables`).then(r => r.json()),
    ])
    setModules(modData)
    setDeliverables(delivData)
    const ids = new Set<number | 'ungrouped'>(['ungrouped', ...modData.map((m: Module) => m.id)])
    setExpandedModules(ids)
    setLoading(false)
  }

  // ── Deliverable CRUD ──────────────────────────────────────────
  function openAddDeliv(moduleId?: number) {
    setEditingDeliv(null)
    setDelivForm({ ...BLANK_DELIVERABLE_FORM, module_id: moduleId?.toString() ?? '' })
    setDelivError('')
    setTitleIsCustom(false)
    setShowDelivModal(true)
  }

  function openEditDeliv(d: Deliverable) {
    setEditingDeliv(d)
    setDelivForm({
      title: d.title,
      description: d.description ?? '',
      mandays: d.mandays.toString(),
      status: d.status,
      module_id: d.module_id?.toString() ?? '',
      planned_start: toInputDate(d.planned_start),
      planned_end: toInputDate(d.planned_end),
    })
    setDelivError('')
    setTitleIsCustom(!delivRecords.some(r => r.title === d.title))
    setShowDelivModal(true)
  }

  async function saveDeliv() {
    if (!delivForm.title.trim()) { setDelivError('Title is required'); return }
    if (delivForm.planned_start && delivForm.planned_end && delivForm.planned_start > delivForm.planned_end) {
      setDelivError('Start date cannot be after end date'); return
    }
    setDelivSaving(true)
    setDelivError('')
    const datePayload = {
      planned_start: delivForm.planned_start || null,
      planned_end: delivForm.planned_end || null,
    }
    try {
      if (editingDeliv) {
        const res = await fetch(`/api/deliverables/${editingDeliv.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: delivForm.title,
            description: delivForm.description,
            mandays: Number(delivForm.mandays),
            status: delivForm.status,
            module_id: delivForm.module_id ? Number(delivForm.module_id) : null,
            ...datePayload,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      } else {
        const res = await fetch(`/api/projects/${projectId}/deliverables`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: delivForm.title,
            description: delivForm.description,
            mandays: Number(delivForm.mandays),
            module_id: delivForm.module_id ? Number(delivForm.module_id) : null,
            ...datePayload,
          }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      }
      setShowDelivModal(false)
      fetchAll()
    } catch (err: any) {
      setDelivError(err.message || 'Something went wrong')
    } finally {
      setDelivSaving(false)
    }
  }

  function deleteDeliv(id: number, title: string) {
    setDeleteError('')
    setDeleteConfirm({ type: 'deliverable', id, title })
  }

  // ── Module CRUD ───────────────────────────────────────────────
  function openAddModule() {
    setEditingModule(null)
    setModuleForm(BLANK_MODULE_FORM)
    setShowModuleModal(true)
  }

  function openEditModule(m: Module) {
    setEditingModule(m)
    setModuleForm({
      title: m.title,
      description: m.description ?? '',
      start_date: toInputDate(m.start_date),
      end_date: toInputDate(m.end_date),
    })
    setShowModuleModal(true)
  }

  async function saveModule() {
    if (!moduleForm.title.trim()) return
    if (moduleForm.start_date && moduleForm.end_date && moduleForm.start_date > moduleForm.end_date) return
    setModuleSaving(true)
    const payload = {
      title: moduleForm.title,
      description: moduleForm.description,
      start_date: moduleForm.start_date || null,
      end_date: moduleForm.end_date || null,
    }
    if (editingModule) {
      const res = await fetch(`/api/modules/${editingModule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const updated = await res.json()
        setModules(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
      }
    } else {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, ...payload }),
      })
      if (res.ok) {
        const created = await res.json()
        setModules(prev => [...prev, created])
        setExpandedModules(prev => new Set([...prev, created.id]))
      }
    }
    setModuleSaving(false)
    setShowModuleModal(false)
  }

  function deleteModule(id: number, title: string) {
    setDeleteError('')
    setDeleteConfirm({ type: 'module', id, title })
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    setDeleteError('')
    const url = deleteConfirm.type === 'module'
      ? `/api/modules/${deleteConfirm.id}`
      : `/api/deliverables/${deleteConfirm.id}`
    const res = await fetch(url, { method: 'DELETE' })
    if (res.ok) {
      if (deleteConfirm.type === 'module') {
        setModules(prev => prev.filter(m => m.id !== deleteConfirm.id))
      } else {
        setDeliverables(prev => prev.filter(d => d.id !== deleteConfirm.id))
      }
      setDeleteConfirm(null)
    } else {
      const data = await res.json().catch(() => ({}))
      setDeleteError(data.error || 'Delete failed')
    }
    setDeleting(false)
  }

  function toggleGroup(key: number | 'ungrouped') {
    setExpandedModules(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const [showHelp, setShowHelp] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showHelp) return
    function handleClick(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showHelp])

  const ungrouped = deliverables.filter(d => !d.module_id)

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Modules & Deliverables</h2>          {/* Help popover */}
          <div className="relative" ref={helpRef}>
            <button
              onClick={() => setShowHelp(v => !v)}
              className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center border border-blue-400 dark:border-blue-500 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              aria-label="Modules and Deliverables help"
            >
              ?
            </button>
            {showHelp && (
              <div className="absolute left-0 top-7 z-50 w-80 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-xl p-4 text-xs text-slate-600 dark:text-slate-300 space-y-3">
                <div className="absolute -top-2 left-3 w-3 h-3 rotate-45 bg-white dark:bg-navy-800 border-l border-t border-slate-200 dark:border-navy-600" />

                <div>
                  <p className="font-semibold text-slate-800 dark:text-white mb-1">What are Modules?</p>
                  <p className="leading-relaxed">A <strong>Module</strong> is a high-level phase or workstream that groups related deliverables together. Think of it as a chapter — it organises work into logical stages (e.g. &ldquo;Phase 1: Discovery&rdquo;, &ldquo;Backend Setup&rdquo;).</p>
                  <p className="mt-1 leading-relaxed text-slate-400 dark:text-slate-500 italic">Example: A data migration project may have modules like &ldquo;Source Analysis&rdquo;, &ldquo;ETL Pipeline&rdquo;, and &ldquo;UAT&rdquo;.</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-white mb-1">What are Deliverables?</p>
                  <p className="leading-relaxed">A <strong>Deliverable</strong> is a concrete output or milestone under a module. It has planned/actual dates, mandays effort, and a status. Deliverables appear on the Gantt chart.</p>
                  <p className="mt-1 leading-relaxed text-slate-400 dark:text-slate-500 italic">Example: &ldquo;Prepare backup storage&rdquo;, &ldquo;Setup repository infrastructure&rdquo;.</p>
                </div>

                <div>
                  <p className="font-semibold text-slate-800 dark:text-white mb-1">What are Tasks?</p>
                  <p className="leading-relaxed">A <strong>Task</strong> is a granular unit of work under a deliverable. Tasks have assignees, actual start/end dates, and drive the progress % on the burndown chart.</p>
                  <p className="mt-1 leading-relaxed text-slate-400 dark:text-slate-500 italic">Example: &ldquo;Configure S3 bucket&rdquo;, &ldquo;Test restore procedure&rdquo;.</p>
                </div>

                <div className="border-t border-slate-100 dark:border-navy-700 pt-2">
                  <p className="font-semibold text-slate-800 dark:text-white mb-1">Deliverable vs Task</p>
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="text-slate-400 dark:text-slate-500">
                        <th className="text-left pb-1 pr-2">Deliverable</th>
                        <th className="text-left pb-1">Task</th>
                      </tr>
                    </thead>
                    <tbody className="space-y-1">
                      <tr><td className="pr-2 py-0.5">Visible on Gantt chart</td><td>Drives burndown chart</td></tr>
                      <tr><td className="pr-2 py-0.5">Has planned dates &amp; mandays</td><td>Has assignee &amp; actual dates</td></tr>
                      <tr><td className="pr-2 py-0.5">1 deliverable → many tasks</td><td>Smallest tracked unit</td></tr>
                      <tr><td className="pr-2 py-0.5">Manager-level tracking</td><td>Developer-level tracking</td></tr>
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={() => setShowHelp(false)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                >
                  Close
                </button>
              </div>
            )}
          </div>          {!loading && (
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {modules.length} module{modules.length !== 1 ? 's' : ''}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                {deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        {userRole === 'manager' && (
          <div className="flex items-center gap-2">
            <button onClick={openAddModule} className="px-3 py-1.5 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg border border-slate-200 dark:border-navy-600">
              + Module
            </button>
            <button onClick={() => openAddDeliv()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
              + Add Deliverable
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-4 text-center">Loading...</p>
      ) : (
        <div className="space-y-4">
          {/* Module groups */}
          {modules.map(mod => {
            const modDeliverables = deliverables.filter(d => d.module_id === mod.id)
            const isOpen = expandedModules.has(mod.id)
            const doneTasks = modDeliverables.reduce((s, d) => s + d.tasks.filter(t => t.status === 'Done').length, 0)
            const totalTasks = modDeliverables.reduce((s, d) => s + d.tasks.length, 0)

            return (
              <div key={mod.id} className="border border-blue-200 dark:border-blue-900/50 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20">
                  <button onClick={() => toggleGroup(mod.id)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                    <span className="text-xs text-blue-400 shrink-0">{isOpen ? '▼' : '▶'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-200 text-blue-800 dark:bg-blue-800/50 dark:text-blue-200 uppercase tracking-wide shrink-0">Module</span>
                        <span className="font-semibold text-sm text-blue-900 dark:text-blue-200 truncate">{mod.title}</span>
                        {mod.description && <span className="text-xs text-blue-500 dark:text-blue-400 truncate hidden sm:inline">{mod.description}</span>}
                      </div>
                      {(mod.start_date || mod.end_date) && (
                        <p className="text-xs text-blue-400 mt-0.5">
                          {mod.start_date ? fmt(mod.start_date) : '—'} → {mod.end_date ? fmt(mod.end_date) : '—'}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-blue-400 mr-2 shrink-0 whitespace-nowrap">
                      {modDeliverables.length} deliverable(s) · {doneTasks}/{totalTasks} tasks
                    </span>
                  </button>
                  {userRole === 'manager' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { openAddDeliv(mod.id); setExpandedModules(prev => new Set([...prev, mod.id])) }}
                        className="text-xs px-2 py-1 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-300"
                      >
                        + Deliverable
                      </button>
                      <button onClick={() => openEditModule(mod)} className="p-1 border border-yellow-200 dark:border-yellow-700 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/30 text-yellow-500 dark:text-yellow-400" title="Edit module">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteModule(mod.id, mod.title)} className="p-1 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400" title="Delete module">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="p-3 space-y-2">
                    {modDeliverables.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2 text-center">
                        No deliverables in this module yet.
                        {userRole === 'manager' && (
                          <button onClick={() => openAddDeliv(mod.id)} className="ml-1 text-blue-500 hover:underline">Add one</button>
                        )}
                      </p>
                    ) : (
                      modDeliverables.map(d => (
                        <DeliverableCard
                          key={d.id}
                          deliverable={d}
                          userRole={userRole}
                          members={members}
                          expandedId={expandedId}
                          setExpandedId={setExpandedId}
                          onEdit={openEditDeliv}
                          onDelete={deleteDeliv}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Ungrouped deliverables */}
          {(ungrouped.length > 0 || modules.length === 0) && (
            <div className="border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
              {modules.length > 0 && (
                <div className="flex items-center px-4 py-3 bg-slate-50 dark:bg-navy-900/50">
                  <button onClick={() => toggleGroup('ungrouped')} className="flex items-center gap-2 flex-1 text-left">
                    <span className="text-xs text-slate-400">{expandedModules.has('ungrouped') ? '▼' : '▶'}</span>
                    <span className="font-medium text-sm text-slate-600 dark:text-slate-300">Without Module</span>
                    <span className="text-xs text-slate-400 ml-2">{ungrouped.length} deliverable(s)</span>
                  </button>
                </div>
              )}
              {(modules.length === 0 || expandedModules.has('ungrouped')) && (
                <div className="p-3 space-y-2">
                  {ungrouped.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4 text-center">
                      No deliverables yet.{userRole === 'manager' ? ' Click "+ Add Deliverable" to create one.' : ''}
                    </p>
                  ) : (
                    ungrouped.map(d => (
                      <DeliverableCard
                        key={d.id}
                        deliverable={d}
                        userRole={userRole}
                        members={members}
                        expandedId={expandedId}
                        setExpandedId={setExpandedId}
                        onEdit={openEditDeliv}
                        onDelete={deleteDeliv}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Deliverable Modal ── */}
      {showDelivModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingDeliv ? 'Edit Deliverable' : 'New Deliverable'}
              </h2>
              <button onClick={() => setShowDelivModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                {!titleIsCustom ? (
                  <select
                    className={inputClass}
                    value={delivForm.title}
                    onChange={e => {
                      if (e.target.value === '__new__') {
                        setTitleIsCustom(true)
                        setDelivForm({ ...delivForm, title: '' })
                      } else {
                        const rec = delivRecords.find(r => r.title === e.target.value)
                        setDelivForm({ ...delivForm, title: e.target.value, description: rec?.description || delivForm.description })
                      }
                    }}
                  >
                    <option value="">-- Select deliverable --</option>
                    {delivRecords.map(r => <option key={r.id} value={r.title}>{r.title}</option>)}
                    <option value="__new__">＋ Add new title...</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      value={delivForm.title}
                      onChange={e => setDelivForm({ ...delivForm, title: e.target.value })}
                      placeholder="e.g. Dashboard, User Management"
                      autoFocus
                    />
                    {delivRecords.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setTitleIsCustom(false); setDelivForm({ ...delivForm, title: '' }) }}
                        className="shrink-0 text-xs px-2 py-1 border border-slate-300 dark:border-navy-600 rounded text-slate-500 hover:bg-slate-50 dark:hover:bg-navy-700"
                      >
                        Library
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea className={`${inputClass} resize-none`} rows={2} value={delivForm.description} onChange={e => setDelivForm({ ...delivForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Planned Start</label>
                  <input
                    type="date" className={inputClass}
                    value={delivForm.planned_start}
                    min={projMin} max={delivForm.planned_end || projMax}
                    onChange={e => setDelivForm({ ...delivForm, planned_start: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Planned End</label>
                  <input
                    type="date" className={inputClass}
                    value={delivForm.planned_end}
                    min={delivForm.planned_start || projMin} max={projMax}
                    onChange={e => setDelivForm({ ...delivForm, planned_end: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Est. Mandays *</label>
                  <input type="number" min="1" className={inputClass} value={delivForm.mandays} onChange={e => setDelivForm({ ...delivForm, mandays: e.target.value })} />
                </div>
                {editingDeliv && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                    <select className={inputClass} value={delivForm.status} onChange={e => setDelivForm({ ...delivForm, status: e.target.value })}>
                      <option value="Pending">Pending</option>
                      <option value="InProgress">In Progress</option>
                      <option value="Done">Done</option>
                      <option value="OnHold">On Hold</option>
                    </select>
                  </div>
                )}
              </div>
              {modules.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Module (optional)</label>
                  <select className={inputClass} value={delivForm.module_id} onChange={e => setDelivForm({ ...delivForm, module_id: e.target.value })}>
                    <option value="">Without Module</option>
                    {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              )}
              {delivError && <p className="text-sm text-red-500">{delivError}</p>}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setShowDelivModal(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700">Cancel</button>
              <button onClick={saveDeliv} disabled={delivSaving} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
                {delivSaving ? 'Saving...' : editingDeliv ? 'Save Changes' : 'Create Deliverable'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Delete {deleteConfirm.type === 'module' ? 'Module' : 'Deliverable'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              Are you sure you want to delete <strong className="text-slate-800 dark:text-white">{deleteConfirm.title}</strong>?
            </p>
            {deleteConfirm.type === 'module' ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
                Module cannot be deleted if it has deliverables or linked features.
              </p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
                Deliverable cannot be deleted if it has tasks.
              </p>
            )}
            {deleteError && <p className="text-sm text-red-500 mb-3">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setDeleteConfirm(null); setDeleteError('') }}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Module Modal ── */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingModule ? 'Edit Module' : 'Add Module'}</h2>
              <button onClick={() => setShowModuleModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input className={inputClass} value={moduleForm.title} onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })} placeholder="e.g. Leave Management, Payroll" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea className={`${inputClass} resize-none`} rows={2} value={moduleForm.description} onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date" className={inputClass}
                    value={moduleForm.start_date}
                    min={projMin} max={moduleForm.end_date || projMax}
                    onChange={e => setModuleForm({ ...moduleForm, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                  <input
                    type="date" className={inputClass}
                    value={moduleForm.end_date}
                    min={moduleForm.start_date || projMin} max={projMax}
                    onChange={e => setModuleForm({ ...moduleForm, end_date: e.target.value })}
                  />
                </div>
              </div>
              {moduleForm.start_date && moduleForm.end_date && moduleForm.start_date > moduleForm.end_date && (
                <p className="text-sm text-red-500">Start date cannot be after end date</p>
              )}
              <p className="text-xs text-slate-400">Dates must be within the project duration: {projMin} → {projMax}</p>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowModuleModal(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50">Cancel</button>
              <button onClick={saveModule} disabled={moduleSaving || !moduleForm.title.trim() || !!(moduleForm.start_date && moduleForm.end_date && moduleForm.start_date > moduleForm.end_date)} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
                {moduleSaving ? 'Saving...' : editingModule ? 'Save Changes' : 'Create Module'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
