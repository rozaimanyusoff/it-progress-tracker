'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/Layout'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ── Types ─────────────────────────────────────────────────────────
type Project = {
  id: number; title: string; description: string | null; status: string
  start_date: string; deadline: string
  health_status?: string | null
  assignees: { user: { id: number; name: string; email: string } }[]
  updates: { progress_pct: number }[]
  _count: { issues: number }
  computedProgress: number
  computedStatus: string
  monthlyData?: { month: string; assigned: number; completed: number }[]
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

const TABS = ['Projects', 'New Project', 'Features', 'Task Categories'] as const
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

function MonthlyComboChart({ data }: { data: { month: string; assigned: number; completed: number }[] }) {
  const hasData = data.some(d => d.assigned > 0 || d.completed > 0)
  if (!hasData) return <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">No task data</p>
  return (
    <ResponsiveContainer width="100%" height={54}>
      <ComposedChart data={data} barSize={8} margin={{ top: 4, right: 2, bottom: 0, left: -24 }}>
        <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}
          formatter={(v: unknown, name: unknown) => [`${v} tasks`, name === 'completed' ? 'Completed' : 'Assigned'] as [string, string]}
        />
        <Bar dataKey="completed" fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Line dataKey="assigned" type="monotone" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
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

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
  const now = new Date()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        <button onClick={onNewProject} className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold">
          + New Project
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        {/* Table header */}
        <div className="grid bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
          style={{ gridTemplateColumns: '2fr 1fr 160px 190px 1fr 100px 110px 60px 72px' }}>
          <span>Project</span>
          <span>Status</span>
          <span>Progress</span>
          <span>Tasks (Monthly)</span>
          <span>Team</span>
          <span>Start</span>
          <span>Deadline</span>
          <span>Issues</span>
          <span></span>
        </div>

        {/* Rows */}
        {projects.map((p, i) => {
          const deadline = new Date(p.deadline)
          const progress = p.computedProgress ?? 0
          const overdue = p.computedStatus !== 'Done' && deadline < now
          const isLast = i === projects.length - 1

          return (
            <div
              key={p.id}
              className={`grid items-center px-4 py-3 gap-3 hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors ${!isLast ? 'border-b border-slate-100 dark:border-navy-700' : ''}`}
              style={{ gridTemplateColumns: '2fr 1fr 160px 190px 1fr 100px 110px 60px 72px' }}
            >
              {/* Project title + description */}
              <div className="min-w-0">
                <p className="font-semibold text-sm text-slate-900 dark:text-white truncate leading-snug">{p.title}</p>
                {p.description && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{p.description}</p>
                )}
              </div>

              {/* Status + health */}
              <div className="flex flex-col gap-1 items-start">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLOR[p.computedStatus] ?? STATUS_COLOR.Pending}`}>
                  {STATUS_LABEL[p.computedStatus] ?? p.computedStatus}
                </span>
                {p.health_status && p.computedStatus !== 'Done' && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                    p.health_status === 'on_track' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
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

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 dark:text-slate-400">{progress}%</span>
                  {overdue && <span className="text-red-400 font-medium text-[10px]">Overdue</span>}
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${overdue ? 'bg-red-500' : progress >= 100 ? 'bg-green-500' : 'bg-primary'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Tasks monthly chart */}
              <div className="min-w-[170px]">
                <MonthlyComboChart data={p.monthlyData ?? []} />
              </div>

              {/* Team avatars */}
              <div className="flex -space-x-1.5">
                {p.assignees.slice(0, 5).map(a => (
                  <div
                    key={a.user.id}
                    title={a.user.name}
                    className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-navy-800 shrink-0"
                  >
                    {a.user.name[0].toUpperCase()}
                  </div>
                ))}
                {p.assignees.length > 5 && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-600 text-slate-500 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-navy-800 shrink-0">
                    +{p.assignees.length - 5}
                  </div>
                )}
                {p.assignees.length === 0 && (
                  <span className="text-xs text-slate-300 dark:text-slate-600 italic">—</span>
                )}
              </div>

              {/* Start date */}
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(p.start_date)}</span>

              {/* Deadline */}
              <span className={`text-xs whitespace-nowrap font-medium ${overdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                {fmtDate(p.deadline)}
              </span>

              {/* Issues */}
              <div>
                {p._count.issues > 0 ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
                    <span>⚠</span>{p._count.issues}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                )}
              </div>

              {/* Action */}
              <button
                onClick={() => router.push(`/projects/${p.id}`)}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                View
              </button>
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
    fetch('/api/users?include_managers=true').then(r => r.json()).then(setMembers)
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
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">{form.assignee_ids.length} assignee(s) selected</p>
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

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplIcon, setTplIcon] = useState('')
  const [tplDesc, setTplDesc] = useState('')
  const [delivDrafts, setDelivDrafts] = useState<DelivDraft[]>([
    { name: '', type: 'frontend', tasks: [] },
  ])

  // Edit template metadata
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // Task actions within edit mode
  const [taskActionMenuId, setTaskActionMenuId] = useState<number | null>(null)
  const [taskEditModal, setTaskEditModal] = useState<{ id: number; name: string; md: string } | null>(null)
  const [addTaskModal, setAddTaskModal] = useState<{ deliverableId: number; deliverableName: string } | null>(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskMd, setNewTaskMd] = useState('')
  const [taskSaving, setTaskSaving] = useState(false)
  const [draftTaskModal, setDraftTaskModal] = useState<{ draftIndex: number; categoryName: string } | null>(null)
  const [draftTaskName, setDraftTaskName] = useState('')
  const [draftTaskMd, setDraftTaskMd] = useState('')

  function fetchTemplates() {
    setLoading(true)
    fetch('/api/module-templates').then(r => r.json()).then(data => {
      const list: ModuleTemplate[] = Array.isArray(data) ? data : []
      setTemplates(list)
      setLoading(false)
    })
  }

  useEffect(() => { fetchTemplates() }, [])

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
  function removeTaskRow(di: number, ti: number) {
    setDelivDrafts(prev => prev.map((d, idx) => idx === di
      ? { ...d, tasks: d.tasks.filter((_, j) => j !== ti) }
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

  // ── Task CRUD (within edit mode) ─────────────────────────────
  function startEditTask(task: TemplateTask) {
    setTaskActionMenuId(null)
    setTaskEditModal({
      id: task.id,
      name: task.name,
      md: task.est_mandays != null ? String(task.est_mandays) : '',
    })
  }

  async function saveTaskEdit(taskId: number) {
    setTaskSaving(true)
    const res = await fetch(`/api/template-tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: taskEditModal?.name ?? '',
        est_mandays: taskEditModal && taskEditModal.md !== '' ? Number(taskEditModal.md) : null,
      }),
    })
    setTaskSaving(false)
    if (res.ok) { setTaskEditModal(null); fetchTemplates() }
    else showToast('error', 'Failed to update task')
  }

  async function deleteTask(taskId: number) {
    if (!confirm('Delete this task?')) return
    const res = await fetch(`/api/template-tasks/${taskId}`, { method: 'DELETE' })
    if (res.ok) fetchTemplates()
    else showToast('error', 'Failed to delete task')
  }

  async function addTask(delivId: number) {
    if (!newTaskName.trim()) return
    setTaskSaving(true)
    const res = await fetch('/api/template-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_deliverable_id: delivId, name: newTaskName, est_mandays: newTaskMd !== '' ? Number(newTaskMd) : null }),
    })
    setTaskSaving(false)
    if (res.ok) { setAddTaskModal(null); setNewTaskName(''); setNewTaskMd(''); fetchTemplates() }
    else showToast('error', 'Failed to add task')
  }

  function addDraftTask(draftIndex: number) {
    if (!draftTaskName.trim()) return
    setDelivDrafts(prev => prev.map((d, idx) => idx === draftIndex
      ? {
        ...d,
        tasks: [
          ...d.tasks,
          { name: draftTaskName.trim(), est_mandays: draftTaskMd.trim() },
        ],
      }
      : d))
    setDraftTaskModal(null)
    setDraftTaskName('')
    setDraftTaskMd('')
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
          Template library with pre-defined task categories and tasks.
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
                <label className={labelClass}>Task Categories</label>
                <button type="button" onClick={addDelivRow} className="text-xs text-blue-500 hover:text-blue-700">+ Add category</button>
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
                        placeholder="Task category name, e.g. Backend API"
                      />
                      <button type="button" onClick={() => removeDelivRow(di)} className="text-red-400 hover:text-red-600 text-xs shrink-0 px-1">✕</button>
                    </div>
                    <div className="ml-2 space-y-2">
                      {d.tasks.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {d.tasks.map((t, ti) => (
                            <span
                              key={ti}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 text-xs text-slate-700 dark:text-slate-300"
                            >
                              <span>{t.name}</span>
                              <span className="text-slate-400">{t.est_mandays ? `expected ${t.est_mandays} md` : 'expected —'}</span>
                              <button
                                type="button"
                                onClick={() => removeTaskRow(di, ti)}
                                className="text-slate-400 hover:text-red-500"
                                aria-label="Remove draft task"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setDraftTaskModal({ draftIndex: di, categoryName: d.name || `Category ${di + 1}` })}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        + Add task
                      </button>
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
      {editingId != null && (() => {
        const editingTpl = templates.find(t => t.id === editingId)
        return (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5 mb-5 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Edit Template</h3>

            {/* Metadata */}
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
                <button type="button" onClick={() => { setEditingId(null); setTaskEditModal(null); setTaskActionMenuId(null); setAddTaskModal(null) }} className="px-5 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg">
                  Cancel
                </button>
              </div>
            </form>

            {/* Deliverables + tasks editor */}
            {editingTpl && editingTpl.deliverables.length > 0 && (
              <div className="space-y-3 pt-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Task Categories & Tasks</p>
                {editingTpl.deliverables.map(d => (
                  <div key={d.id} className="rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 overflow-hidden">
                    {/* Deliverable header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-navy-700">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[d.type] ?? TYPE_BADGE.frontend}`}>{d.type}</span>
                      <span className="text-sm font-medium text-slate-800 dark:text-white flex-1">{d.name}</span>
                      <button
                        type="button"
                        onClick={() => { setAddTaskModal({ deliverableId: d.id, deliverableName: d.name }); setNewTaskName(''); setNewTaskMd('') }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        + Add task
                      </button>
                    </div>

                    {/* Task badges */}
                    <div className="p-3 border-t border-slate-100 dark:border-navy-700">
                      {d.tasks.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {d.tasks.map(task => (
                            <div key={task.id} className="relative group">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 text-xs text-slate-700 dark:text-slate-300">
                                <span>{task.name}</span>
                                <span className="text-slate-400">{task.est_mandays != null ? `${task.est_mandays} md` : '—'}</span>
                                <button
                                  type="button"
                                  className="ml-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => setTaskActionMenuId(prev => prev === task.id ? null : task.id)}
                                  aria-label="Task options"
                                >
                                  ⋯
                                </button>
                              </span>
                              {taskActionMenuId === task.id && (
                                <div className="absolute right-0 top-8 z-20 w-28 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-lg py-1">
                                  <button
                                    type="button"
                                    onClick={() => startEditTask(task)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700"
                                  >
                                    Update
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setTaskActionMenuId(null); deleteTask(task.id) }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No tasks — click "+ Add task" to add one.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {loading && <p className="text-slate-400 text-sm py-8 text-center">Loading...</p>}
      {!loading && templates.length === 0 && (
        <p className="text-slate-400 text-sm py-8 text-center">No task category templates yet.</p>
      )}
      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map(tpl => {
            const totalTasks = tpl.deliverables.reduce((s, d) => s + d.tasks.length, 0)
            return (
              <div key={tpl.id} className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
                {/* Template header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl leading-none">{tpl.icon ?? '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{tpl.display_name}</p>
                      {tpl.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{tpl.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {tpl.deliverables.length} {tpl.deliverables.length === 1 ? 'category' : 'categories'} · {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(tpl)} className="text-xs px-2 py-1 border border-slate-200 dark:border-navy-600 rounded hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300">Edit</button>
                    <button onClick={() => handleDelete(tpl.id, tpl.display_name)} className="text-xs px-2 py-1 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">Delete</button>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-navy-700 p-4 space-y-3">
                  <div className="space-y-2">
                    {tpl.deliverables.map(d => (
                      <div
                        key={d.id}
                        className="rounded-lg border border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/30 p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[d.type] ?? TYPE_BADGE.frontend}`}>
                            {d.type}
                          </span>
                          <span className="text-sm font-medium text-slate-800 dark:text-white flex-1">{d.name}</span>
                          <button
                            type="button"
                            onClick={() => { setAddTaskModal({ deliverableId: d.id, deliverableName: d.name }); setNewTaskName(''); setNewTaskMd('') }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            + Add task
                          </button>
                        </div>

                        {d.tasks.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {d.tasks.map(task => (
                              <div key={task.id} className="relative group">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 text-xs text-slate-700 dark:text-slate-200">
                                  <span>{task.name}</span>
                                  <span className="text-slate-400">
                                    expected {task.est_mandays != null ? `${task.est_mandays} md` : '—'}
                                  </span>
                                  <button
                                    type="button"
                                    className="ml-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setTaskActionMenuId(prev => prev === task.id ? null : task.id)}
                                    aria-label="Task options"
                                  >
                                    ⋯
                                  </button>
                                </span>
                                {taskActionMenuId === task.id && (
                                  <div className="absolute right-0 top-8 z-20 w-28 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-lg py-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditTask(task)}
                                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700"
                                    >
                                      Update
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setTaskActionMenuId(null); deleteTask(task.id) }}
                                      className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No tasks in this category.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {addTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl p-5">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Add Task</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Category: <span className="font-medium text-slate-700 dark:text-slate-300">{addTaskModal.deliverableName}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Task Name *</label>
                <input
                  className={inputClass}
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  placeholder="e.g. Implement list endpoint"
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>Expected Mandays</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  className={inputClass}
                  value={newTaskMd}
                  onChange={e => setNewTaskMd(e.target.value)}
                  placeholder="e.g. 1.5"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setAddTaskModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => addTask(addTaskModal.deliverableId)}
                disabled={taskSaving || !newTaskName.trim()}
                className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {taskSaving ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {taskEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl p-5">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Update Task</h4>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Task Name *</label>
                <input
                  className={inputClass}
                  value={taskEditModal.name}
                  onChange={e => setTaskEditModal(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>Expected Mandays</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  className={inputClass}
                  value={taskEditModal.md}
                  onChange={e => setTaskEditModal(prev => prev ? { ...prev, md: e.target.value } : prev)}
                  placeholder="e.g. 1.5"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setTaskEditModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveTaskEdit(taskEditModal.id)}
                disabled={taskSaving || !taskEditModal.name.trim()}
                className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {taskSaving ? 'Saving...' : 'Update Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {draftTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl p-5">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Add Task</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Category: <span className="font-medium text-slate-700 dark:text-slate-300">{draftTaskModal.categoryName}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Task Name *</label>
                <input
                  className={inputClass}
                  value={draftTaskName}
                  onChange={e => setDraftTaskName(e.target.value)}
                  placeholder="e.g. Implement list endpoint"
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>Expected Mandays</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  className={inputClass}
                  value={draftTaskMd}
                  onChange={e => setDraftTaskMd(e.target.value)}
                  placeholder="e.g. 1.5"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setDraftTaskModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => addDraftTask(draftTaskModal.draftIndex)}
                disabled={!draftTaskName.trim()}
                className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                Add Task
              </button>
            </div>
          </div>
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

  const visibleTabs = TABS

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.replace('/dashboard')
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
        {visibleTabs.map(tab => (
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
      {activeTab === 'Task Categories' && <DeliverablesTab showToast={showToast} />}
    </AppLayout>
  )
}
