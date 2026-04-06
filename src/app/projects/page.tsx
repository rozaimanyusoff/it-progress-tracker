'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'
import AppLayout from '@/components/Layout'

// ── Types ─────────────────────────────────────────────────────────
type Project = {
  id: number; title: string; description: string | null; status: string
  start_date: string; deadline: string
  health_status?: string | null
  assignees: { user: { id: number; name: string; email: string } }[]
  _count: { issues: number }
}
type Feature = {
  id: number; title: string; description: string | null; mandays: number
  status: string
  project_links?: { project: { id: number; title: string } }[]
}
type TemplateTask = {
  id: number; name: string; est_mandays: number | null; sort_order: number
}
type TemplateDeliverable = {
  id: number; name: string; type: string; sort_order: number; tasks: TemplateTask[]
}
type ModuleTemplate = {
  id: number; code: string; display_name: string; description: string | null
  icon: string | null; sort_order: number; is_active: boolean
  deliverables: TemplateDeliverable[]
}

const TABS = ['Projects', 'New Project', 'Features', 'Deliverables'] as const
type Tab = typeof TABS[number]

const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-lg ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {msg}
    </div>
  )
}

// ── Type badge colours (shared with ModuleTemplateModal) ──────────
const TYPE_BADGE: Record<string, string> = {
  database: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  backend: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  frontend: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  testing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  documentation: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

// ── Status helpers ─────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OnHold: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
}
const STATUS_LABEL: Record<string, string> = {
  Pending: 'Pending', InProgress: 'In Progress', Done: 'Done', OnHold: 'On Hold',
}

// ── Projects List Tab ──────────────────────────────────────────────
function ProjectsTab({ onNewProject }: { onNewProject: () => void }) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => { setProjects(d); setLoading(false) })
  }, [])

  if (loading) return <p className="text-slate-400 py-8 text-center text-sm">Loading...</p>

  if (projects.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 text-sm mb-4">No projects yet.</p>
        <button onClick={onNewProject} className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold">
          + Create First Project
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        <button onClick={onNewProject} className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold">
          + New Project
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map(p => {
          const now = new Date()
          const deadline = new Date(p.deadline)
          const start = new Date(p.start_date)
          const totalDays = Math.max(1, (deadline.getTime() - start.getTime()) / 86400000)
          const elapsed = Math.max(0, (now.getTime() - start.getTime()) / 86400000)
          const progress = Math.min(100, Math.round((elapsed / totalDays) * 100))
          const overdue = p.status !== 'Done' && deadline < now

          return (
            <div
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}`)}
              className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-navy-600 transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-snug line-clamp-2">{p.title}</h3>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLOR[p.status] ?? STATUS_COLOR.Pending}`}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  {p.health_status && p.status !== 'Done' && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${p.health_status === 'on_track' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        p.health_status === 'at_risk' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          p.health_status === 'delayed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                      }`}>
                      {p.health_status === 'on_track' ? '🟢 On Track' :
                        p.health_status === 'at_risk' ? '🟡 At Risk' :
                          p.health_status === 'delayed' ? '🔴 Delayed' : '⚫ Overdue'}
                    </span>
                  )}
                </div>
              </div>

              {p.description && (
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{p.description}</p>
              )}

              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${overdue ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex -space-x-1.5">
                  {p.assignees.slice(0, 4).map(a => (
                    <div
                      key={a.user.id}
                      className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-navy-800"
                      title={a.user.name}
                    >
                      {a.user.name[0].toUpperCase()}
                    </div>
                  ))}
                  {p.assignees.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-600 text-slate-500 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-navy-800">
                      +{p.assignees.length - 4}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {p._count.issues > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <span className="text-[10px]">⚠</span>{p._count.issues}
                    </span>
                  )}
                  <span className={overdue ? 'text-red-400' : ''}>
                    {overdue ? 'Overdue' : deadline.toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── New Project Tab ────────────────────────────────────────────────
function NewProjectTab({
  showToast, onCreated,
}: {
  showToast: (t: 'success' | 'error', m: string) => void
  onCreated: () => void
}) {
  const [members, setMembers] = useState<any[]>([])
  const [form, setForm] = useState({
    title: '', description: '', assignee_ids: [] as number[],
    start_date: '', deadline: '', status: 'Pending', category: 'NonClaimable',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(setMembers)
  }, [])

  function toggleAssignee(id: number) {
    setForm(prev => ({
      ...prev,
      assignee_ids: prev.assignee_ids.includes(id)
        ? prev.assignee_ids.filter(x => x !== id)
        : [...prev.assignee_ids, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.assignee_ids.length === 0) { setError('Please select at least one assignee.'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      showToast('success', 'Project created')
      setForm({ title: '', description: '', assignee_ids: [], start_date: '', deadline: '', status: 'Pending', category: 'NonClaimable' })
      onCreated()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to create project')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className={labelClass}>Project Title *</label>
            <input type="text" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputClass} h-24 resize-none`} />
          </div>
          <div>
            <label className={labelClass}>Assignees *</label>
            <div className="rounded-lg border border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 divide-y divide-slate-200 dark:divide-navy-700">
              {members.map(m => (
                <label key={m.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.assignee_ids.includes(m.id)}
                    onChange={() => toggleAssignee(m.id)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-800 dark:text-slate-200">{m.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{m.email}</span>
                </label>
              ))}
              {members.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No members available.</p>}
            </div>
            {form.assignee_ids.length > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">{form.assignee_ids.length} member(s) selected</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Date *</label>
              <input type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Deadline *</label>
              <input type="date" required value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Initial Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass}>
                <option value="Pending">Pending</option>
                <option value="InProgress">In Progress</option>
                <option value="Done">Done</option>
                <option value="OnHold">On Hold</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Project Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputClass}>
                <option value="Claimable">Claimable / External</option>
                <option value="NonClaimable">Non-claimable / Internal</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Features Tab ──────────────────────────────────────────────────
function FeaturesTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', mandays: '1' })

  useEffect(() => {
    setLoading(true)
    fetch('/api/features').then(r => r.json()).then(data => { setFeatures(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/features', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title, description: form.description || null, mandays: Number(form.mandays),
      }),
    })
    setSaving(false)
    if (res.ok) {
      const fresh = await fetch('/api/features').then(r => r.json())
      setFeatures(Array.isArray(fresh) ? fresh : [])
      setForm({ title: '', description: '', mandays: '1' })
      setShowForm(false)
      showToast('success', 'Feature created')
    } else {
      showToast('error', (await res.json()).error || 'Failed to create feature')
    }
  }

  const featureStatusColor: Record<string, string> = {
    Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    OnHold: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={() => setShowForm(v => !v)} className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold">
          + New Feature
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-5 mb-5">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm">New Feature</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className={labelClass}>Title *</label>
              <input required className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea className={`${inputClass} resize-none`} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Estimated Mandays</label>
              <input type="number" min="1" className={inputClass} value={form.mandays} onChange={e => setForm(f => ({ ...f, mandays: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? 'Saving...' : 'Add Feature'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <p className="text-slate-400 text-sm py-8 text-center">Loading...</p>}
      {!loading && features.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">No features yet.</p>}
      {!loading && features.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden bg-white dark:bg-navy-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Feature</th>
                <th className="text-left px-5 py-3 font-medium">Linked Projects</th>
                <th className="text-left px-5 py-3 font-medium">Mandays</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {features.map(f => (
                <tr key={f.id} className="border-b border-slate-100 dark:border-navy-700 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-700">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{f.title}</p>
                    {f.description && <p className="text-xs text-slate-400 truncate max-w-xs">{f.description}</p>}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {f.project_links && f.project_links.length > 0
                      ? f.project_links.map(l => l.project.title).join(', ')
                      : <span className="italic text-slate-300 dark:text-slate-600">Unlinked</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs">{f.mandays}d</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${featureStatusColor[f.status] ?? featureStatusColor.Pending}`}>{f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Deliverables Tab ──────────────────────────────────────────────
const DELIV_TYPES = ['database', 'backend', 'frontend', 'testing', 'documentation'] as const
type DelivType = typeof DELIV_TYPES[number]

type TaskDraft = { name: string; est_mandays: string }
type DelivDraft = { name: string; type: DelivType; tasks: TaskDraft[] }

function DeliverablesTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [templates, setTemplates] = useState<ModuleTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [expandedDeliverables, setExpandedDeliverables] = useState<Record<number, boolean>>({})

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplIcon, setTplIcon] = useState('')
  const [tplDesc, setTplDesc] = useState('')
  const [delivDrafts, setDelivDrafts] = useState<DelivDraft[]>([
    { name: '', type: 'frontend', tasks: [] },
  ])

  // Edit
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editDesc, setEditDesc] = useState('')

  function fetchTemplates() {
    setLoading(true)
    fetch('/api/module-templates').then(r => r.json()).then(data => {
      const list: ModuleTemplate[] = Array.isArray(data) ? data : []
      setTemplates(list)
      const exp: Record<number, boolean> = {}
      list.forEach(t => { exp[t.id] = true })
      setExpanded(exp)
      setLoading(false)
    })
  }

  useEffect(() => { fetchTemplates() }, [])

  function toggleTemplate(id: number) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleDeliverable(id: number) {
    setExpandedDeliverables(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Deliverable drafts helpers ────────────────────────────────
  function addDelivRow() {
    setDelivDrafts(prev => [...prev, { name: '', type: 'frontend', tasks: [] }])
  }
  function removeDelivRow(i: number) {
    setDelivDrafts(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateDeliv(i: number, patch: Partial<DelivDraft>) {
    setDelivDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d))
  }
  function addTaskRow(di: number) {
    setDelivDrafts(prev => prev.map((d, idx) => idx === di
      ? { ...d, tasks: [...d.tasks, { name: '', est_mandays: '' }] }
      : d))
  }
  function removeTaskRow(di: number, ti: number) {
    setDelivDrafts(prev => prev.map((d, idx) => idx === di
      ? { ...d, tasks: d.tasks.filter((_, j) => j !== ti) }
      : d))
  }
  function updateTask(di: number, ti: number, patch: Partial<TaskDraft>) {
    setDelivDrafts(prev => prev.map((d, idx) => idx === di
      ? { ...d, tasks: d.tasks.map((t, j) => j === ti ? { ...t, ...patch } : t) }
      : d))
  }

  // ── Create ────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!tplName.trim()) return
    setSaving(true)
    const res = await fetch('/api/module-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: tplName,
        icon: tplIcon || null,
        description: tplDesc || null,
        deliverables: delivDrafts.filter(d => d.name.trim()).map(d => ({
          name: d.name.trim(),
          type: d.type,
          tasks: d.tasks.filter(t => t.name.trim()).map(t => ({
            name: t.name.trim(),
            est_mandays: t.est_mandays ? Number(t.est_mandays) : null,
          })),
        })),
      }),
    })
    setSaving(false)
    if (res.ok) {
      setShowForm(false)
      setTplName(''); setTplIcon(''); setTplDesc('')
      setDelivDrafts([{ name: '', type: 'frontend', tasks: [] }])
      fetchTemplates()
      showToast('success', 'Template created')
    } else {
      showToast('error', (await res.json()).error || 'Failed to create')
    }
  }

  // ── Edit (name/icon/desc only) ────────────────────────────────
  function openEdit(tpl: ModuleTemplate) {
    setEditingId(tpl.id)
    setEditName(tpl.display_name)
    setEditIcon(tpl.icon ?? '')
    setEditDesc(tpl.description ?? '')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim() || editingId == null) return
    setSaving(true)
    const res = await fetch(`/api/module-templates/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: editName, icon: editIcon || null, description: editDesc || null }),
    })
    setSaving(false)
    if (res.ok) {
      setEditingId(null)
      fetchTemplates()
      showToast('success', 'Template updated')
    } else {
      showToast('error', 'Failed to update')
    }
  }

  // ── Delete ────────────────────────────────────────────────────
  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete template "${name}"? This will remove all its deliverables and tasks.`)) return
    const res = await fetch(`/api/module-templates/${id}`, { method: 'DELETE' })
    if (res.ok) { fetchTemplates(); showToast('success', 'Deleted') }
    else showToast('error', 'Failed to delete')
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400 flex-1">
          Module templates with pre-defined deliverables and tasks.
        </p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold"
        >
          + New Template
        </button>
      </div>

      {/* ── Create form ── */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-5 mb-5 space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-white text-sm">New Template</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Icon (emoji)</label>
                <input className={inputClass} value={tplIcon} onChange={e => setTplIcon(e.target.value)} placeholder="📦" maxLength={4} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Template Name *</label>
                <input required className={inputClass} value={tplName} onChange={e => setTplName(e.target.value)} placeholder="e.g. Simple CRUD" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input className={inputClass} value={tplDesc} onChange={e => setTplDesc(e.target.value)} placeholder="Optional description" />
            </div>

            {/* Deliverables */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass}>Deliverables</label>
                <button type="button" onClick={addDelivRow} className="text-xs text-blue-500 hover:text-blue-700">+ Add deliverable</button>
              </div>
              <div className="space-y-3">
                {delivDrafts.map((d, di) => (
                  <div key={di} className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-3 space-y-2">
                    <div className="flex gap-2">
                      <select
                        className={`${inputClass} w-36 shrink-0`}
                        value={d.type}
                        onChange={e => updateDeliv(di, { type: e.target.value as DelivType })}
                      >
                        {DELIV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        className={inputClass}
                        value={d.name}
                        onChange={e => updateDeliv(di, { name: e.target.value })}
                        placeholder="Deliverable name, e.g. Backend API"
                      />
                      <button type="button" onClick={() => removeDelivRow(di)} className="text-red-400 hover:text-red-600 text-xs shrink-0 px-1">✕</button>
                    </div>
                    {/* Tasks */}
                    <div className="ml-2 space-y-1.5">
                      {d.tasks.map((t, ti) => (
                        <div key={ti} className="flex gap-2 items-center">
                          <input
                            className={`${inputClass} flex-1`}
                            value={t.name}
                            onChange={e => updateTask(di, ti, { name: e.target.value })}
                            placeholder="Task name"
                          />
                          <input
                            type="number" step="0.5" min="0"
                            className={`${inputClass} w-20`}
                            value={t.est_mandays}
                            onChange={e => updateTask(di, ti, { est_mandays: e.target.value })}
                            placeholder="md"
                          />
                          <button type="button" onClick={() => removeTaskRow(di, ti)} className="text-red-400 hover:text-red-600 text-xs shrink-0 px-1">✕</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addTaskRow(di)} className="text-xs text-blue-500 hover:text-blue-700">+ task</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Template'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Edit form ── */}
      {editingId != null && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5 mb-5">
          <h3 className="font-semibold text-slate-800 dark:text-white text-sm mb-3">Edit Template</h3>
          <form onSubmit={handleEdit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Icon</label>
                <input className={inputClass} value={editIcon} onChange={e => setEditIcon(e.target.value)} placeholder="📦" maxLength={4} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Name *</label>
                <input required className={inputClass} value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input className={inputClass} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setEditingId(null)} className="px-5 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <p className="text-slate-400 text-sm py-8 text-center">Loading...</p>}
      {!loading && templates.length === 0 && (
        <p className="text-slate-400 text-sm py-8 text-center">No deliverable templates yet.</p>
      )}
      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map(tpl => {
            const totalTasks = tpl.deliverables.reduce((s, d) => s + d.tasks.length, 0)
            return (
              <div key={tpl.id} className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
                {/* Template header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => toggleTemplate(tpl.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <span className="text-2xl leading-none">{tpl.icon ?? '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{tpl.display_name}</p>
                      {tpl.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{tpl.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {tpl.deliverables.length} deliverable{tpl.deliverables.length !== 1 ? 's' : ''} · {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                    </span>
                    {expanded[tpl.id]
                      ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(tpl)} className="text-xs px-2 py-1 border border-slate-200 dark:border-navy-600 rounded hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300">Edit</button>
                    <button onClick={() => handleDelete(tpl.id, tpl.display_name)} className="text-xs px-2 py-1 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">Delete</button>
                  </div>
                </div>

                {/* Deliverables */}
                {expanded[tpl.id] && (
                  <div className="border-t border-slate-100 dark:border-navy-700 divide-y divide-slate-100 dark:divide-navy-700">
                    {tpl.deliverables.map(d => (
                      <div key={d.id}>
                        <button
                          onClick={() => toggleDeliverable(d.id)}
                          className="w-full flex items-center gap-2.5 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-navy-700/40 transition-colors text-left"
                        >
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_BADGE[d.type] ?? TYPE_BADGE.frontend}`}>
                            {d.type}
                          </span>
                          <span className="flex-1 text-sm font-medium text-slate-800 dark:text-white">{d.name}</span>
                          <span className="text-xs text-slate-400 shrink-0">{d.tasks.length} task{d.tasks.length !== 1 ? 's' : ''}</span>
                          {expandedDeliverables[d.id]
                            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        </button>

                        {/* Tasks */}
                        {expandedDeliverables[d.id] && d.tasks.length > 0 && (
                          <div className="px-5 pb-3 space-y-1.5 bg-slate-50 dark:bg-navy-900/30">
                            {d.tasks.map(task => (
                              <div key={task.id} className="flex items-center gap-2 text-xs">
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 ml-1" />
                                <span className="flex-1 text-slate-700 dark:text-slate-300">{task.name}</span>
                                {task.est_mandays != null && (
                                  <span className="text-slate-400 shrink-0">{task.est_mandays}d</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('Projects')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session || (session.user as any).role !== 'manager') router.replace('/dashboard')
  }, [session, status, router])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <AppLayout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Projects</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage projects and features</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-navy-700">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Projects' && <ProjectsTab onNewProject={() => setActiveTab('New Project')} />}
      {activeTab === 'New Project' && <NewProjectTab showToast={showToast} onCreated={() => setActiveTab('Projects')} />}
      {activeTab === 'Features' && <FeaturesTab showToast={showToast} />}
      {activeTab === 'Deliverables' && <DeliverablesTab showToast={showToast} />}
    </AppLayout>
  )
}
