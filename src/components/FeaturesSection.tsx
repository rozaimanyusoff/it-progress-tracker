'use client'

import { useState, useEffect } from 'react'
import AddFeatureModal from './AddFeatureModal'
import FeatureTaskList from './FeatureTaskList'
import { Pencil, Trash2, X } from 'lucide-react'

interface Developer { user: { id: number; name: string } }
interface Member { id: number; name: string }
interface Task { status: string }

interface Feature {
  id: number
  title: string
  description?: string | null
  mandays: number
  status: string
  actual_start?: string | null
  actual_end?: string | null
  module_id?: number | null
  created_by: { id: number; name: string }
  developers: Developer[]
  tasks: Task[]
}

interface CatalogFeature {
  id: number
  title: string
  description?: string | null
  mandays: number
  status: string
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

function FeatureCard({
  feature, userRole, members, expandedId, setExpandedId,
  onEdit, onUnlink,
}: {
  feature: Feature
  userRole: string
  members: Member[]
  expandedId: number | null
  setExpandedId: (id: number | null) => void
  onEdit: (f: Feature) => void
  onUnlink: (id: number, title: string) => void
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
            <div className="mt-1 text-xs text-slate-400">
              Actual: {feature.actual_start ? `${fmt(feature.actual_start)} → ${feature.actual_end ? fmt(feature.actual_end) : 'ongoing'}` : 'Not started'}
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
                <button onClick={() => onEdit(feature)} className="p-1 border border-yellow-200 dark:border-yellow-700 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/30 text-yellow-500 dark:text-yellow-400" title="Edit feature">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onUnlink(feature.id, feature.title)} className="p-1 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400" title="Unlink feature">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
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

  // Edit Feature modal
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null)

  // Link Feature modal
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [catalog, setCatalog] = useState<CatalogFeature[]>([])
  const [selectedFeatureId, setSelectedFeatureId] = useState('')
  const [linkModuleId, setLinkModuleId] = useState('')
  const [linking, setLinking] = useState(false)

  // Add/Edit Module modal
  const [showModuleModal, setShowModuleModal] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' })
  const [moduleLoading, setModuleLoading] = useState(false)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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
    setModules(modData.map((m: any) => ({ id: m.id, title: m.title, description: m.description, order: m.order })))
    setFeatures(featData)
    setExpandedModules(new Set(modData.map((m: any) => m.id)))
    setLoading(false)
  }

  async function openLinkModal() {
    const all = await fetch('/api/features').then(r => r.json())
    const linkedIds = new Set(features.map(f => f.id))
    setCatalog(all.filter((f: CatalogFeature) => !linkedIds.has(f.id)))
    setSelectedFeatureId('')
    setLinkModuleId('')
    setShowLinkModal(true)
  }

  async function handleLink() {
    if (!selectedFeatureId) return
    setLinking(true)
    await fetch(`/api/projects/${projectId}/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_id: Number(selectedFeatureId), module_id: linkModuleId ? Number(linkModuleId) : null }),
    })
    setLinking(false)
    setShowLinkModal(false)
    fetchAll()
  }

  async function unlinkFeature(id: number, title: string) {
    if (!confirm(`Unlink feature "${title}" from this project?`)) return
    await fetch(`/api/projects/${projectId}/features`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_id: id }),
    })
    setFeatures(prev => prev.filter(f => f.id !== id))
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

  function deleteModule(id: number, title: string) {
    setDeleteError('')
    setDeleteConfirm({ id, title })
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    setDeleteError('')
    const res = await fetch(`/api/modules/${deleteConfirm.id}`, { method: 'DELETE' })
    if (res.ok) {
      setModules(prev => prev.filter(m => m.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    } else {
      const data = await res.json().catch(() => ({}))
      setDeleteError(data.error || 'Delete failed')
    }
    setDeleting(false)
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
            <button onClick={openLinkModal} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">
              + Link Feature
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-4 text-center">Loading...</p>
      ) : (
        <div className="space-y-4">
          {modules.map(mod => {
            const modFeatures = features.filter(f => f.module_id === mod.id)
            const isOpen = expandedModules.has(mod.id)
            const totalTasks = modFeatures.reduce((s, f) => s + f.tasks.length, 0)
            const doneTasks = modFeatures.reduce((s, f) => s + f.tasks.filter(t => t.status === 'Done').length, 0)

            return (
              <div key={mod.id} className="border border-blue-200 dark:border-blue-900/50 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20">
                  <button onClick={() => toggleModule(mod.id)} className="flex items-center gap-2 flex-1 text-left">
                    <span className="text-xs text-blue-400">{isOpen ? '▼' : '▶'}</span>
                    <span className="font-semibold text-sm text-blue-900 dark:text-blue-200">{mod.title}</span>
                    {mod.description && <span className="text-xs text-blue-500 dark:text-blue-400 truncate">{mod.description}</span>}
                    <span className="text-xs text-blue-400 ml-auto mr-2">{modFeatures.length} feature(s) · {doneTasks}/{totalTasks} tasks</span>
                  </button>
                  {userRole === 'manager' && (
                    <div className="flex items-center gap-1 shrink-0">
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
                          onUnlink={unlinkFeature}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}

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
                    onUnlink={unlinkFeature}
                  />
                ))}
              </div>
            </div>
          )}

          {modules.length === 0 && ungroupedFeatures.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">
              No features linked yet.{userRole === 'manager' ? ' Use "+ Link Feature" to attach features from the catalog.' : ''}
            </p>
          )}
        </div>
      )}

      {/* Edit Feature Modal */}
      {editingFeature && (
        <AddFeatureModal
          onClose={() => setEditingFeature(null)}
          onCreated={() => { fetchAll(); setEditingFeature(null) }}
          editFeature={editingFeature}
        />
      )}

      {/* Link Feature Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Link Feature</h2>
              <button onClick={() => setShowLinkModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Feature *</label>
                {catalog.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">All features are already linked, or no features exist in the catalog.</p>
                ) : (
                  <select className={inputClass} value={selectedFeatureId} onChange={e => setSelectedFeatureId(e.target.value)}>
                    <option value="">Select a feature...</option>
                    {catalog.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                  </select>
                )}
              </div>
              {modules.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assign to Module (optional)</label>
                  <select className={inputClass} value={linkModuleId} onChange={e => setLinkModuleId(e.target.value)}>
                    <option value="">Ungrouped</option>
                    {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowLinkModal(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50">Cancel</button>
              <button onClick={handleLink} disabled={linking || !selectedFeatureId} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50">
                {linking ? 'Linking...' : 'Link Feature'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Delete Module</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              Are you sure you want to delete <strong className="text-slate-800 dark:text-white">{deleteConfirm.title}</strong>?
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
              Module cannot be deleted if it has linked features.
            </p>
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

      {/* Add/Edit Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingModule ? 'Edit Module' : 'Add Module'}</h2>
              <button onClick={closeModuleModal} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
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
