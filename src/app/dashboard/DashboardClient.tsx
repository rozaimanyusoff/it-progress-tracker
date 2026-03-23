'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import DeveloperAnalytics from '@/components/DeveloperAnalytics'

interface Project {
  id: number
  title: string
  description: string | null
  status: string
  deadline: string
  start_date: string
  owner: { id: number; name: string }
  updates: { progress_pct: number; status: string; created_at: string }[]
  _count: { issues: number }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Done: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700',
    InProgress: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-400 dark:border-orange-700',
    OnHold: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700',
    Pending: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
  }
  const labels: Record<string, string> = { InProgress: 'In Progress', OnHold: 'On Hold', Done: 'Done', Pending: 'Pending' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] || map.Pending}`}>
      {labels[status] || status}
    </span>
  )
}

function CircleProgress({ value }: { value: number }) {
  const size = 52
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = value >= 80 ? '#22c55e' : value >= 40 ? '#f97316' : '#3b82f6'
  const trackColor = 'var(--circle-track, #e2e8f0)'

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" stroke={trackColor} className="dark:[--circle-track:#162d4a]" />
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" stroke={color} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <span className="text-xs font-bold" style={{ color }}>{value}%</span>
    </div>
  )
}

export default function DashboardClient({ projects, session }: { projects: Project[]; session: any }) {
  const isManager = session.user.role === 'manager'

  // Shared
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [saving, setSaving] = useState(false)
  const [localProjects, setLocalProjects] = useState(projects)

  // Progress update (member)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateForm, setUpdateForm] = useState({ progress_pct: '', status: 'InProgress', notes: '' })

  // Edit project (manager)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', description: '', status: '', deadline: '', owner_id: '' })
  const [members, setMembers] = useState<{ id: number; name: string }[]>([])

  const [issueForm, setIssueForm] = useState({ title: '', description: '', severity: 'medium' })

  useEffect(() => {
    if (isManager) {
      fetch('/api/users').then(r => r.json()).then(setMembers)
    }
  }, [isManager])

  function openEdit(project: Project) {
    setSelectedProject(project)
    setEditForm({
      title: project.title,
      description: project.description ?? '',
      status: project.status,
      deadline: project.deadline.slice(0, 10),
      owner_id: String(project.owner.id),
    })
    setShowEditModal(true)
  }

  function openUpdate(project: Project) {
    const progress = project.updates[0]?.progress_pct ?? 0
    setSelectedProject(project)
    setUpdateForm({ progress_pct: String(progress), status: project.status, notes: '' })
    setShowUpdateModal(true)
  }

  async function submitEdit() {
    if (!selectedProject) return
    setSaving(true)
    const res = await fetch(`/api/projects/${selectedProject.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      const updated = await res.json()
      setLocalProjects(prev => prev.map(p =>
        p.id === selectedProject.id
          ? { ...p, title: updated.title, description: updated.description, status: updated.status, deadline: updated.deadline, owner: members.find(m => m.id === Number(editForm.owner_id)) ? { id: Number(editForm.owner_id), name: members.find(m => m.id === Number(editForm.owner_id))!.name } : p.owner }
          : p
      ))
    }
    setSaving(false)
    setShowEditModal(false)
  }

  async function submitUpdate() {
    if (!selectedProject) return
    setSaving(true)
    await fetch('/api/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: selectedProject.id, ...updateForm }),
    })
    setSaving(false)
    setShowUpdateModal(false)
    window.location.reload()
  }

  async function submitIssue() {
    if (!selectedProject) return
    setSaving(true)
    await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: selectedProject.id, ...issueForm }),
    })
    setSaving(false)
    setShowIssueModal(false)
    window.location.reload()
  }

  const stats = {
    total: localProjects.length,
    inProgress: localProjects.filter(p => p.status === 'InProgress').length,
    done: localProjects.filter(p => p.status === 'Done').length,
    issues: localProjects.reduce((s, p) => s + p._count.issues, 0),
  }

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm text-slate-500 dark:text-slate-400 mb-1'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {isManager ? 'All projects overview' : 'Your assigned projects'}
          </p>
        </div>
        {isManager && (
          <Link href="/projects/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
            + New Project
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Total Projects', value: stats.total, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-orange-600 dark:text-orange-400' },
          { label: 'Done', value: stats.done, color: 'text-green-600 dark:text-green-400' },
          { label: 'Open Issues', value: stats.issues, color: 'text-red-600 dark:text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 sm:p-5 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">{s.label}</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Projects */}
      <div className="rounded-xl border overflow-hidden bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 mb-6">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Projects</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-navy-700">
          {localProjects.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">No projects found.</div>
          )}
          {localProjects.map(project => {
            const progress = project.updates[0]?.progress_pct ?? 0
            return (
              <div key={project.id} className="px-4 sm:px-6 py-4 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="pt-0.5">
                    <CircleProgress value={progress} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link href={`/projects/${project.id}`} className="font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm sm:text-base">
                        {project.title}
                      </Link>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.description && (
                      <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm truncate mb-1">{project.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-400 dark:text-slate-500">
                      <span>PIC: {project.owner.name}</span>
                      <span>Deadline: {new Date(project.deadline).toLocaleDateString()}</span>
                      {project._count.issues > 0 && (
                        <span className="text-red-500 dark:text-red-400">{project._count.issues} open issue(s)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    {isManager ? (
                      <button
                        onClick={() => openEdit(project)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-navy-700 hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-700 dark:text-slate-300 text-xs rounded-lg border border-slate-200 dark:border-navy-600 transition-colors whitespace-nowrap"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={() => openUpdate(project)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors whitespace-nowrap"
                      >
                        Update
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectedProject(project); setShowIssueModal(true) }}
                      className="px-3 py-1.5 bg-red-50 dark:bg-red-900/50 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-200 dark:border-red-800 transition-colors whitespace-nowrap"
                    >
                      + Issue
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Developer Analytics */}
      <DeveloperAnalytics />

      {/* Edit Project Modal (manager) */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Edit Project</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Title</label>
                <input type="text" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className={`${inputClass} h-20 resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className={inputClass}>
                    <option value="Pending">Pending</option>
                    <option value="InProgress">In Progress</option>
                    <option value="Done">Done</option>
                    <option value="OnHold">On Hold</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Deadline</label>
                  <input type="date" value={editForm.deadline} onChange={e => setEditForm({ ...editForm, deadline: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>PIC (Owner)</label>
                <select value={editForm.owner_id} onChange={e => setEditForm({ ...editForm, owner_id: e.target.value })} className={inputClass}>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={submitEdit} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setShowEditModal(false)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Update Progress Modal (member) */}
      {showUpdateModal && selectedProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Update Progress — {selectedProject.title}</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Progress %</label>
                <input type="number" min={0} max={100} value={updateForm.progress_pct} onChange={e => setUpdateForm({ ...updateForm, progress_pct: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select value={updateForm.status} onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })} className={inputClass}>
                  <option value="InProgress">In Progress</option>
                  <option value="Done">Done</option>
                  <option value="OnHold">On Hold</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={updateForm.notes} onChange={e => setUpdateForm({ ...updateForm, notes: e.target.value })} className={`${inputClass} h-24 resize-none`} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={submitUpdate} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Update'}
              </button>
              <button onClick={() => setShowUpdateModal(false)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Modal */}
      {showIssueModal && selectedProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Report Issue — {selectedProject.title}</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Title</label>
                <input type="text" value={issueForm.title} onChange={e => setIssueForm({ ...issueForm, title: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea value={issueForm.description} onChange={e => setIssueForm({ ...issueForm, description: e.target.value })} className={`${inputClass} h-20 resize-none`} />
              </div>
              <div>
                <label className={labelClass}>Severity</label>
                <select value={issueForm.severity} onChange={e => setIssueForm({ ...issueForm, severity: e.target.value })} className={inputClass}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={submitIssue} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Report Issue'}
              </button>
              <button onClick={() => setShowIssueModal(false)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
