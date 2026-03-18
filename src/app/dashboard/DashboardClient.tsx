'use client'
import { useState } from 'react'
import Link from 'next/link'

interface Project {
  id: number
  title: string
  description: string | null
  status: string
  deadline: string
  unit: { name: string }
  owner: { name: string }
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

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 40 ? 'bg-orange-500' : 'bg-blue-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-200 dark:bg-navy-900 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">{value}%</span>
    </div>
  )
}

export default function DashboardClient({ projects, session }: { projects: Project[]; session: any }) {
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [updateForm, setUpdateForm] = useState({ progress_pct: '', status: 'InProgress', notes: '' })
  const [issueForm, setIssueForm] = useState({ title: '', description: '', severity: 'medium' })
  const [saving, setSaving] = useState(false)
  const [localProjects, setLocalProjects] = useState(projects)

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {session.user.role === 'manager' ? 'All projects overview' : `Your projects — ${session.user.unit_name || 'No unit'}`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Projects', value: stats.total, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-orange-600 dark:text-orange-400' },
          { label: 'Done', value: stats.done, color: 'text-green-600 dark:text-green-400' },
          { label: 'Open Issues', value: stats.issues, color: 'text-red-600 dark:text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-5 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <p className="text-slate-500 dark:text-slate-400 text-sm">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Projects */}
      <div className="rounded-xl border overflow-hidden bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex justify-between items-center">
          <h2 className="font-semibold text-slate-900 dark:text-white">Projects</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-navy-700">
          {localProjects.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">No projects found.</div>
          )}
          {localProjects.map(project => {
            const progress = project.updates[0]?.progress_pct ?? 0
            return (
              <div key={project.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <Link href={`/projects/${project.id}`} className="font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        {project.title}
                      </Link>
                      <StatusBadge status={project.status} />
                      <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{project.unit.name}</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm truncate">{project.description}</p>
                    <div className="mt-2 max-w-xs">
                      <ProgressBar value={progress} />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 dark:text-slate-500">
                      <span>PIC: {project.owner.name}</span>
                      <span>Deadline: {new Date(project.deadline).toLocaleDateString()}</span>
                      {project._count.issues > 0 && (
                        <span className="text-red-500 dark:text-red-400">{project._count.issues} open issue(s)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { setSelectedProject(project); setShowUpdateModal(true) }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                    >
                      Update
                    </button>
                    <button
                      onClick={() => { setSelectedProject(project); setShowIssueModal(true) }}
                      className="px-3 py-1.5 bg-red-50 dark:bg-red-900/50 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 text-xs rounded-lg border border-red-200 dark:border-red-800 transition-colors"
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

      {/* Update Modal */}
      {showUpdateModal && selectedProject && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Update Progress — {selectedProject.title}</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Progress %</label>
                <input
                  type="number" min={0} max={100}
                  value={updateForm.progress_pct}
                  onChange={e => setUpdateForm({ ...updateForm, progress_pct: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={updateForm.status}
                  onChange={e => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className={inputClass}
                >
                  <option value="InProgress">In Progress</option>
                  <option value="Done">Done</option>
                  <option value="OnHold">On Hold</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  value={updateForm.notes}
                  onChange={e => setUpdateForm({ ...updateForm, notes: e.target.value })}
                  className={`${inputClass} h-24 resize-none`}
                />
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
                <input
                  type="text"
                  value={issueForm.title}
                  onChange={e => setIssueForm({ ...issueForm, title: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={issueForm.description}
                  onChange={e => setIssueForm({ ...issueForm, description: e.target.value })}
                  className={`${inputClass} h-20 resize-none`}
                />
              </div>
              <div>
                <label className={labelClass}>Severity</label>
                <select
                  value={issueForm.severity}
                  onChange={e => setIssueForm({ ...issueForm, severity: e.target.value })}
                  className={inputClass}
                >
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
