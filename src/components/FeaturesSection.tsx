'use client'

import { useState, useEffect } from 'react'
import AddFeatureModal from './AddFeatureModal'
import FeatureTaskList from './FeatureTaskList'

interface Developer { user: { id: number; name: string } }
interface Member { id: number; name: string }

interface Task { status: string }

interface Feature {
  id: number
  title: string
  description?: string | null
  mandays: number
  status: string
  planned_start: string
  planned_end: string
  actual_start?: string | null
  actual_end?: string | null
  module_id?: number | null
  created_by: { id: number; name: string }
  developers: Developer[]
  tasks: Task[]
}

interface Module {
  id: number
  title: string
  description?: string | null
  order: number
}

interface Props {
  projectId: number
  userRole: string
}

const STATUS_BADGE: Record<string, string> = {
  Pending:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Done:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OnHold:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
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

function FeatureCard({
  feature, userRole, members, expandedId, setExpandedId,
  onEdit, onDelete,
}: {
  feature: Feature
  userRole: string
  members: Member[]
  expandedId: number | null
  setExpandedId: (id: number | null) => void
  onEdit: (f: Feature) => void
  onDelete: (id: number, title: string) => void
}) {
  const { done, total, pct } = taskProgress(feature.tasks)
  const isExpanded = expandedId === feature.id

  return (
    <div className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-slate-900 dark:text-white text-sm">{feature.title}</h4>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[feature.status]}`}>
                {STATUS_LABELS[feature.status]}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{feature.mandays} md</span>
            </div>
            {feature.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{feature.description}</p>
            )}
            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-400">
              <span>Plan: {fmt(feature.planned_start)} → {fmt(feature.planned_end)}</span>
              <span>Actual: {feature.actual_start ? `${fmt(feature.actual_start)} → ${feature.actual_end ? fmt(feature.actual_end) : 'ongoing'}` : 'Not started'}</span>
            </div>
            {feature.developers.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {feature.developers.map(d => (
                  <span key={d.user.id} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                    {d.user.name}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">{done}/{total} tasks</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {userRole === 'manager' && (
              <>
                <button onClick={() => onEdit(feature)} className="text-xs px-2 py-1 border border-slate-200 dark:border-navy-600 rounded hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300">Edit</button>
                <button onClick={() => onDelete(feature.id, feature.title)} className="text-xs px-2 py-1 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">Delete</button>
              </>
            )}
            <button
              onClick={() => setExpandedId(isExpanded ? null : feature.id)}
              className="text-xs px-2 py-1 border border-slate-200 dark:border-navy-600 rounded hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300"
            >
              {isExpanded ? 'Hide Tasks' : 'View Tasks'}
            </button>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-navy-700 pt-3">
          <FeatureTaskList featureId={feature.id} userRole={userRole} developers={members.map(m => ({ user: m }))} />
        </div>
      )}
    </div>
  )
}

export default function FeaturesSection({ projectId, userRole }: Props) {
  const [modules, setModules] = useState<Module[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set())

  // Add Feature modal
  const [showAddFeature, setShowAddFeature] = useState(false)
  const [addFeatureModuleId, setAddFeatureModuleId] = useState<number | null>(null)
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null)

  // Add/Edit Module modal
  const [showModuleModal, setShowModuleModal] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' })
  const [moduleLoading, setModuleLoading] = useState(false)

  useEffect(() => {
    fetchAll()
    fetch('/api/users').then(r => r.json()).then(setMembers)
  }, [projectId])

  async function fetchAll() {
    setLoading(true)
    const [modRes, featRes] = await Promise.all([
      fetch(`/api/modules?project_id=${projectId}`),
      fetch(`/api/features?project_id=${projectId}`),
    ])
    const modData = await modRes.json()
    const featData = await featRes.json()
    // modData from GET /api/modules includes features too, but we use separate features list for flexibility
    setModules(modData.map((m: any) => ({ id: m.id, title: m.title, description: m.description, order: m.order })))
    setFeatures(featData)
    // Auto-expand all modules
    setExpandedModules(new Set(modData.map((m: any) => m.id)))
    setLoading(false)
  }

  async function deleteFeature(id: number, title: string) {
    if (!confirm(`Delete feature "${title}" and all its tasks?`)) return
    const res = await fetch(`/api/features/${id}`, { method: 'DELETE' })
    if (res.ok) setFeatures(prev => prev.filter(f => f.id !== id))
  }

  async function saveModule() {
    if (!moduleForm.title.trim()) return
    setModuleLoading(true)
    if (editingModule) {
      const res = await fetch(`/api/modules/${editingModule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moduleForm),
      })
      if (res.ok) {
        const updated = await res.json()
        setModules(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
      }
    } else {
      const res = await fetch('/api/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, ...moduleForm }),
      })
      if (res.ok) {
        const created = await res.json()
        setModules(prev => [...prev, { id: created.id, title: created.title, description: created.description, order: created.order }])
        setExpandedModules(prev => new Set([...prev, created.id]))
      }
    }
    setModuleLoading(false)
    closeModuleModal()
  }

  async function deleteModule(id: number, title: string) {
    if (!confirm(`Delete module "${title}"? Features will be moved to ungrouped.`)) return
    const res = await fetch(`/api/modules/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setModules(prev => prev.filter(m => m.id !== id))
      setFeatures(prev => prev.map(f => f.module_id === id ? { ...f, module_id: null } : f))
    }
  }

  function openAddModule() {
    setEditingModule(null)
    setModuleForm({ title: '', description: '' })
    setShowModuleModal(true)
  }

  function openEditModule(m: Module) {
    setEditingModule(m)
    setModuleForm({ title: m.title, description: m.description ?? '' })
    setShowModuleModal(true)
  }

  function closeModuleModal() {
    setShowModuleModal(false)
    setEditingModule(null)
  }

  function toggleModule(id: number) {
    setExpandedModules(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const ungroupedFeatures = features.filter(f => !f.module_id)

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Modules & Features</h2>
        {userRole === 'manager' && (
          <div className="flex items-center gap-2">
            <button onClick={openAddModule} className="px-3 py-1.5 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg border border-slate-200 dark:border-navy-600">
              + Module
            </button>
            <button onClick={() => { setAddFeatureModuleId(null); setShowAddFeature(true) }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
              + Feature
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-4 text-center">Loading...</p>
      ) : (
        <div className="space-y-4">
          {/* Modules */}
          {modules.map(mod => {
            const modFeatures = features.filter(f => f.module_id === mod.id)
            const isOpen = expandedModules.has(mod.id)
            const totalTasks = modFeatures.reduce((s, f) => s + f.tasks.length, 0)
            const doneTasks = modFeatures.reduce((s, f) => s + f.tasks.filter(t => t.status === 'Done').length, 0)

            return (
              <div key={mod.id} className="border border-blue-200 dark:border-blue-900/50 rounded-xl overflow-hidden">
                {/* Module header */}
                <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20">
                  <button onClick={() => toggleModule(mod.id)} className="flex items-center gap-2 flex-1 text-left">
                    <span className="text-xs text-blue-400">{isOpen ? '▼' : '▶'}</span>
                    <span className="font-semibold text-sm text-blue-900 dark:text-blue-200">{mod.title}</span>
                    {mod.description && <span className="text-xs text-blue-500 dark:text-blue-400 truncate">{mod.description}</span>}
                    <span className="text-xs text-blue-400 ml-auto mr-2">{modFeatures.length} feature(s) · {doneTasks}/{totalTasks} tasks</span>
                  </button>
                  {userRole === 'manager' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setAddFeatureModuleId(mod.id); setShowAddFeature(true) }}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
                      >+ Feature</button>
                      <button onClick={() => openEditModule(mod)} className="text-xs px-2 py-1 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-300">Edit</button>
                      <button onClick={() => deleteModule(mod.id, mod.title)} className="text-xs px-2 py-1 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 text-red-500">Delete</button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <div className="p-3 space-y-2">
                    {modFeatures.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2 text-center">No features in this module yet.</p>
                    ) : (
                      modFeatures.map(f => (
                        <FeatureCard
                          key={f.id}
                          feature={f}
                          userRole={userRole}
                          members={members}
                          expandedId={expandedId}
                          setExpandedId={setExpandedId}
                          onEdit={setEditingFeature}
                          onDelete={deleteFeature}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Ungrouped features */}
          {ungroupedFeatures.length > 0 && (
            <div className="border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-navy-900/50">
                <span className="font-medium text-sm text-slate-600 dark:text-slate-300">Ungrouped Features</span>
              </div>
              <div className="p-3 space-y-2">
                {ungroupedFeatures.map(f => (
                  <FeatureCard
                    key={f.id}
                    feature={f}
                    userRole={userRole}
                    members={members}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                    onEdit={setEditingFeature}
                    onDelete={deleteFeature}
                  />
                ))}
              </div>
            </div>
          )}

          {modules.length === 0 && ungroupedFeatures.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">
              No modules or features yet.{userRole === 'manager' ? ' Add a module or feature above.' : ''}
            </p>
          )}
        </div>
      )}

      {/* Add/Edit Feature Modal */}
      {(showAddFeature || editingFeature) && (
        <AddFeatureModal
          projectId={projectId}
          moduleId={showAddFeature ? addFeatureModuleId : (editingFeature?.module_id ?? null)}
          onClose={() => { setShowAddFeature(false); setEditingFeature(null) }}
          onCreated={() => { fetchAll(); setShowAddFeature(false); setEditingFeature(null) }}
          editFeature={editingFeature}
        />
      )}

      {/* Add/Edit Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingModule ? 'Edit Module' : 'Add Module'}</h2>
              <button onClick={closeModuleModal} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input className={inputClass} value={moduleForm.title} onChange={e => setModuleForm({ ...moduleForm, title: e.target.value })} placeholder="e.g. Authentication Module" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea className={`${inputClass} resize-none`} rows={2} value={moduleForm.description} onChange={e => setModuleForm({ ...moduleForm, description: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={closeModuleModal} className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50">Cancel</button>
              <button onClick={saveModule} disabled={moduleLoading || !moduleForm.title.trim()} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
                {moduleLoading ? 'Saving...' : editingModule ? 'Save Changes' : 'Create Module'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
