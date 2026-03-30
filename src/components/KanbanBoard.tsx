'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import TaskUpdateModal from './TaskUpdateModal'

interface Task {
  id: number
  title: string
  status: string
  is_predefined: boolean
  time_started_at: string | null
  time_spent_seconds: number
  review_count: number
  project: { id: number; title: string } | null
  module: { id: number; title: string } | null
  feature: { id: number; title: string } | null
  deliverable: { id: number; title: string } | null
}

type BoardState = Record<string, Task[]>

interface Project { id: number; title: string }
interface Feature { id: number; title: string; module_id: number | null }
interface Module  { id: number; title: string; features: Feature[] }

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: 'Todo',       label: 'To Do',       color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' },
  { id: 'InProgress', label: 'In Progress', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' },
  { id: 'InReview',   label: 'To Review',   color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' },
  { id: 'Done',       label: 'Done',        color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
]

function reviewCardStyle(task: { status: string; review_count: number }): string {
  if (task.status === 'Done')
    return 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 border-l-[3px] border-l-green-400'
  if (task.status === 'InReview')
    return 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-700/60 border-l-[3px] border-l-yellow-400'
  if (task.status !== 'Todo' && task.review_count > 0)
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
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// ── Add Task Modal ────────────────────────────────────────────────
function AddTaskModal({ onClose, onAdded }: { onClose: () => void; onAdded: (task: Task) => void }) {
  const [projects, setProjects]   = useState<Project[]>([])
  const [modules, setModules]     = useState<Module[]>([])
  const [features, setFeatures]   = useState<Feature[]>([])
  const [projectId, setProjectId] = useState('')
  const [moduleId, setModuleId]   = useState('')
  const [featureId, setFeatureId] = useState('')
  const [title, setTitle]         = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  // New feature inline form
  const [showNewFeature, setShowNewFeature]     = useState(false)
  const [newFeatTitle, setNewFeatTitle]         = useState('')
  const [newFeatStart, setNewFeatStart]         = useState('')
  const [newFeatEnd, setNewFeatEnd]             = useState('')
  const [newFeatMandays, setNewFeatMandays]     = useState('1')

  function calcMandays(start: string, end: string): string {
    if (!start || !end) return newFeatMandays
    const s = new Date(start), e = new Date(end)
    if (e < s) return '1'
    let days = 0
    const cur = new Date(s)
    while (cur <= e) {
      const dow = cur.getDay()
      if (dow !== 0 && dow !== 6) days++
      cur.setDate(cur.getDate() + 1)
    }
    return String(Math.max(1, days))
  }

  function handleFeatStart(val: string) {
    setNewFeatStart(val)
    setNewFeatMandays(calcMandays(val, newFeatEnd))
  }

  function handleFeatEnd(val: string) {
    setNewFeatEnd(val)
    setNewFeatMandays(calcMandays(newFeatStart, val))
  }
  const [creatingFeature, setCreatingFeature]   = useState(false)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then((data: any[]) =>
      setProjects(data.map(p => ({ id: p.id, title: p.title })))
    )
  }, [])

  useEffect(() => {
    if (!projectId) { setModules([]); setFeatures([]); setModuleId(''); setFeatureId(''); return }
    Promise.all([
      fetch(`/api/modules?project_id=${projectId}`).then(r => r.json()),
      fetch(`/api/features?project_id=${projectId}`).then(r => r.json()),
    ]).then(([modData, featData]) => {
      setModules(modData.map((m: any) => ({
        id: m.id, title: m.title,
        features: (m.features ?? []).map((f: any) => ({ id: f.id, title: f.title, module_id: m.id })),
      })))
      setFeatures(featData.filter((f: any) => !f.module_id).map((f: any) => ({ id: f.id, title: f.title, module_id: null })))
      setModuleId(''); setFeatureId('')
    })
  }, [projectId])

  // If project has modules, features must come from selected module (or ungrouped if no modules)
  const visibleFeatures = modules.length > 0
    ? (moduleId ? (modules.find(m => m.id === Number(moduleId))?.features ?? []) : [])
    : features

  async function createFeature() {
    if (!newFeatTitle.trim() || !projectId || !newFeatStart || !newFeatEnd) return
    setCreatingFeature(true)
    const res = await fetch('/api/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: Number(projectId),
        module_id: moduleId ? Number(moduleId) : null,
        title: newFeatTitle.trim(),
        mandays: Number(newFeatMandays) || 1,
        planned_start: newFeatStart,
        planned_end: newFeatEnd,
      }),
    })
    if (res.ok) {
      const f = await res.json()
      const newFeat: Feature = { id: f.id, title: f.title, module_id: f.module_id ?? null }
      if (moduleId) {
        setModules(prev => prev.map(m => m.id === Number(moduleId) ? { ...m, features: [...m.features, newFeat] } : m))
      } else {
        setFeatures(prev => [...prev, newFeat])
      }
      setFeatureId(String(f.id))
      setShowNewFeature(false)
      setNewFeatTitle(''); setNewFeatStart(''); setNewFeatEnd(''); setNewFeatMandays('1')
    }
    setCreatingFeature(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (modules.length > 0 && !moduleId) { setError('Please select a module.'); return }
    if (!featureId) { setError('Please select or create a feature.'); return }
    if (!title.trim()) { setError('Task title is required.'); return }
    setSaving(true); setError('')

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_id: Number(featureId), title: title.trim(), description: description.trim() || null }),
    })
    if (!res.ok) {
      setError((await res.json()).error || 'Failed to create task')
      setSaving(false); return
    }
    const task = await res.json()
    onAdded(task)
    onClose()
  }

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add Task to Board</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project *</label>
            <select className={inputClass} value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          {/* Module — required when project has modules */}
          {projectId && modules.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Module *</label>
              <select className={inputClass} value={moduleId} onChange={e => { setModuleId(e.target.value); setFeatureId('') }}>
                <option value="">Select module...</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          )}

          {/* Feature */}
          {projectId && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Feature *</label>
                <button type="button" onClick={() => setShowNewFeature(!showNewFeature)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  {showNewFeature ? '— Cancel new feature' : '+ New feature'}
                </button>
              </div>

              {!showNewFeature ? (
                <>
                  <select className={inputClass} value={featureId} onChange={e => setFeatureId(e.target.value)}>
                    <option value="">Select feature...</option>
                    {visibleFeatures.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                  </select>
                  {visibleFeatures.length === 0 && (
                    <p className="text-xs text-slate-400 mt-1">No features yet — create one above.</p>
                  )}
                </>
              ) : (
                <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2 bg-blue-50 dark:bg-blue-900/20">
                  <input className={inputClass} placeholder="Feature title *" value={newFeatTitle} onChange={e => setNewFeatTitle(e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 mb-0.5 block">Start *</label>
                      <input type="date" className={inputClass} value={newFeatStart} onChange={e => handleFeatStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-0.5 block">End *</label>
                      <input type="date" className={inputClass} value={newFeatEnd} onChange={e => handleFeatEnd(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-0.5 block">Mandays</label>
                      <input type="number" min="1" className={inputClass} value={newFeatMandays} onChange={e => setNewFeatMandays(e.target.value)} />
                    </div>
                  </div>
                  <button type="button" onClick={createFeature} disabled={creatingFeature || !newFeatTitle.trim() || !newFeatStart || !newFeatEnd}
                    className="w-full py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium">
                    {creatingFeature ? 'Creating...' : 'Create & Select Feature'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Task title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Task Title *</label>
            <input className={inputClass} placeholder="e.g. Implement login endpoint" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea className={`${inputClass} resize-none`} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
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
  const [allTasks, setAllTasks]         = useState<Task[]>([])
  const [assignedIssues, setAssignedIssues] = useState<AssignedIssue[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [, setTick] = useState(0)

  // Filters
  const [filterProjectId, setFilterProjectId] = useState('')
  const [filterFeatureId, setFilterFeatureId] = useState('')
  const [showLegend, setShowLegend] = useState(false)

  // Tick every second so InProgress timers re-render
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

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
    // Members cannot drag directly to InReview — must use Submit for Review in modal
    if (!isManager && newStatus === 'InReview') return

    // Optimistic update
    setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated: Task = await res.json()
      setAllTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
    } else {
      loadMyTasks()
    }
  }

  async function moveTask(taskId: number, currentStatus: string, direction: 'next' | 'prev') {
    const colIds = COLUMNS.map(c => c.id)
    const newIdx = colIds.indexOf(currentStatus) + (direction === 'next' ? 1 : -1)
    if (newIdx < 0 || newIdx >= colIds.length) return
    const newStatus = colIds[newIdx]

    // InReview cannot go back to Todo
    if (currentStatus === 'InReview' && newStatus === 'Todo') return
    // Members cannot move directly to InReview — must use Submit for Review in modal
    if (!isManager && newStatus === 'InReview') return

    setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated: Task = await res.json()
      setAllTasks(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
    }
  }

  function handleStatusChange(taskId: number, newStatus: string) {
    setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">Loading your tasks...</div>
  }

  const activeTask = activeTaskId !== null ? findTask(board, activeTaskId) : null
  const totalVisible = visibleTasks.length

  return (
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
        <button
          onClick={() => setShowLegend(v => !v)}
          className={`w-6 h-6 rounded-full text-xs font-bold border transition-colors ${showLegend ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-navy-600 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
          title="Show legend"
        >?</button>
      </div>

      {/* Legend panel */}
      {showLegend && (
        <div className="mb-5 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-4 text-xs text-slate-600 dark:text-slate-300">
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
                  <span>Awaiting manager review</span>
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
                    <li>✗ Cannot move directly to To Review</li>
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
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-4 items-start">
          {COLUMNS.map(col => (
            <div key={col.id} className="flex flex-col">
              <div className={`rounded-lg px-3 py-2 mb-3 flex items-center justify-between ${col.color}`}>
                <span className="font-semibold text-sm">{col.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium opacity-70">
                    {board[col.id].length + (col.id === 'Todo' ? assignedIssues.length : 0)}
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

              {col.id === 'Todo' && board[col.id].length === 0 && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mb-2 w-full border-2 border-dashed border-slate-200 dark:border-navy-600 rounded-lg py-4 text-xs text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                >
                  + Add your first task
                </button>
              )}

              {/* Assigned issue cards — To Do column only */}
              {col.id === 'Todo' && assignedIssues.map(issue => {
                const sevColor: Record<string, string> = {
                  high:   'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
                  medium: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300',
                  low:    'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
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
                    {board[col.id].map((task, index) => (
                      <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`rounded-lg p-3 shadow-sm select-none transition-colors ${reviewCardStyle(task)} ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : 'hover:shadow-md'}`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-0.5">
                              <p className="font-medium text-sm text-slate-800 dark:text-white leading-snug">{task.title}</p>
                              {task.review_count > 0 && task.status !== 'Todo' && (
                                <span
                                  title={`Reviewed ${task.review_count} time${task.review_count > 1 ? 's' : ''}`}
                                  className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 whitespace-nowrap"
                                >
                                  ↩ {task.review_count}
                                </span>
                              )}
                            </div>
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
                              {(() => {
                                const s = getElapsedSeconds(task)
                                const running = task.status === 'InProgress'
                                if (s <= 0 && !running) return null
                                return (
                                  <span className="flex items-center gap-1">
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
                            </div>
                            <div className="flex items-center justify-between mt-2 gap-1">
                              <div className="flex gap-1">
                                {col.id !== 'Todo' && (
                                  <button onClick={() => moveTask(task.id, col.id, 'prev')} className="text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-500 hover:bg-slate-50" title="Move back">←</button>
                                )}
                                {col.id !== 'Done' && (
                                  <button onClick={() => moveTask(task.id, col.id, 'next')} className="text-xs px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-600 text-slate-500 hover:bg-slate-50" title="Move forward">→</button>
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

      {activeTask && (
        <TaskUpdateModal
          taskId={activeTask.id}
          taskTitle={activeTask.title}
          moduleTitle={activeTask.module?.title ?? null}
          featureTitle={activeTask.feature?.title ?? activeTask.deliverable?.title ?? null}
          projectTitle={activeTask.project?.title ?? null}
          currentStatus={activeTask.status}
          reviewCount={activeTask.review_count}
          onClose={() => { setActiveTaskId(null); loadMyTasks() }}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
