'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/Layout'

// ── Types ─────────────────────────────────────────────────────────
type Project = {
  id: number; title: string; description: string | null; status: string
  start_date: string; deadline: string
  assignees: { user: { id: number; name: string; email: string } }[]
  _count: { issues: number }
}
type Feature = {
  id: number; title: string; description: string | null; mandays: number
  planned_start: string; planned_end: string; status: string
  module: { id: number; title: string } | null
}

const TABS = ['Projects', 'New Project', 'Features'] as const
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

// ── Status helpers ─────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  Pending:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Done:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OnHold:     'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
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
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${STATUS_COLOR[p.status] ?? STATUS_COLOR.Pending}`}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
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
    start_date: '', deadline: '', status: 'Pending',
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
      setForm({ title: '', description: '', assignee_ids: [], start_date: '', deadline: '', status: 'Pending' })
      onCreated()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to create project')
    }
  }

  return (
    <div className="max-w-2xl">
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
          <div>
            <label className={labelClass}>Initial Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass}>
              <option value="Pending">Pending</option>
              <option value="InProgress">In Progress</option>
              <option value="Done">Done</option>
              <option value="OnHold">On Hold</option>
            </select>
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
  const [projects, setProjects] = useState<{ id: number; title: string }[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', mandays: '1', planned_start: '', planned_end: '' })

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then((data: any[]) =>
      setProjects(data.map(p => ({ id: p.id, title: p.title })))
    )
  }, [])

  useEffect(() => {
    if (!projectId) { setFeatures([]); return }
    setLoading(true)
    fetch(`/api/features?project_id=${projectId}`).then(r => r.json()).then(data => { setFeatures(data); setLoading(false) })
  }, [projectId])

  function calcMandays(start: string, end: string) {
    if (!start || !end) return form.mandays
    const s = new Date(start), e = new Date(end)
    if (e < s) return '1'
    let days = 0; const cur = new Date(s)
    while (cur <= e) { const d = cur.getDay(); if (d !== 0 && d !== 6) days++; cur.setDate(cur.getDate() + 1) }
    return String(Math.max(1, days))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); if (!projectId) return
    setSaving(true)
    const res = await fetch('/api/features', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: Number(projectId), title: form.title,
        description: form.description || null, mandays: Number(form.mandays),
        planned_start: form.planned_start, planned_end: form.planned_end,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const fresh = await fetch(`/api/features?project_id=${projectId}`).then(r => r.json())
      setFeatures(fresh)
      setForm({ title: '', description: '', mandays: '1', planned_start: '', planned_end: '' })
      setShowForm(false)
      showToast('success', 'Feature added')
    } else {
      showToast('error', (await res.json()).error || 'Failed to add feature')
    }
  }

  const featureStatusColor: Record<string, string> = {
    Pending:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    Done:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    OnHold:     'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          className="text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select project...</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        {projectId && (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold">
            + Add Feature
          </button>
        )}
      </div>

      {showForm && projectId && (
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Start *</label>
                <input type="date" required className={inputClass} value={form.planned_start}
                  onChange={e => setForm(f => ({ ...f, planned_start: e.target.value, mandays: calcMandays(e.target.value, f.planned_end) }))} />
              </div>
              <div>
                <label className={labelClass}>End *</label>
                <input type="date" required className={inputClass} value={form.planned_end}
                  onChange={e => setForm(f => ({ ...f, planned_end: e.target.value, mandays: calcMandays(f.planned_start, e.target.value) }))} />
              </div>
              <div>
                <label className={labelClass}>Mandays</label>
                <input type="number" min="1" className={inputClass} value={form.mandays} onChange={e => setForm(f => ({ ...f, mandays: e.target.value }))} />
              </div>
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

      {!projectId && <p className="text-slate-400 text-sm py-8 text-center">Select a project to view features.</p>}
      {projectId && loading && <p className="text-slate-400 text-sm py-8 text-center">Loading...</p>}
      {projectId && !loading && features.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">No features yet.</p>}
      {!loading && features.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden bg-white dark:bg-navy-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Feature</th>
                <th className="text-left px-5 py-3 font-medium">Module</th>
                <th className="text-left px-5 py-3 font-medium">Period</th>
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
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs">{f.module?.title ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                    {new Date(f.planned_start).toLocaleDateString()} → {new Date(f.planned_end).toLocaleDateString()}
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
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Projects'    && <ProjectsTab onNewProject={() => setActiveTab('New Project')} />}
      {activeTab === 'New Project' && <NewProjectTab showToast={showToast} onCreated={() => setActiveTab('Projects')} />}
      {activeTab === 'Features'    && <FeaturesTab showToast={showToast} />}
    </AppLayout>
  )
}
