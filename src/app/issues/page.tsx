'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import AppLayout from '@/components/Layout'

type EditForm = {
  title: string
  description: string
  severity: string
  moduleId: string
  deliverableId: string
  taskId: string
}

export default function IssuesPage() {
  const { data: session } = useSession()
  const isManager = (session?.user as any)?.role === 'manager'

  const [issues, setIssues]   = useState<any[]>([])
  const [members, setMembers] = useState<{ id: number; name: string }[]>([])
  const [filters, setFilters] = useState({ severity: '', resolved: '' })
  const [loading, setLoading] = useState(true)

  // Edit modal
  const [editingIssue, setEditingIssue] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ title: '', description: '', severity: 'medium', moduleId: '', deliverableId: '', taskId: '' })
  const [editModules, setEditModules] = useState<{ id: number; title: string }[]>([])
  const [editDeliverables, setEditDeliverables] = useState<{ id: number; title: string; module_id: number | null; tasks: { id: number; title: string }[] }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.severity) params.set('severity', filters.severity)
    if (filters.resolved !== '') params.set('resolved', filters.resolved)
    fetch(`/api/issues?${params}`).then(r => r.json()).then(d => { setIssues(d); setLoading(false) })
  }, [filters])

  useEffect(() => {
    if (isManager) {
      fetch('/api/users').then(r => r.json()).then(setMembers)
    }
  }, [isManager])

  async function toggleResolved(id: number, current: boolean) {
    await fetch(`/api/issues/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: !current }),
    })
    setIssues(prev => prev.map(i => i.id === id ? { ...i, resolved: !current } : i))
  }

  async function assignIssue(id: number, assigneeId: string) {
    const res = await fetch(`/api/issues/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_id: assigneeId ? Number(assigneeId) : null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setIssues(prev => prev.map(i => i.id === id ? { ...i, assignee: updated.assignee } : i))
    }
  }

  function openEdit(issue: any) {
    setEditingIssue(issue)
    setEditForm({
      title: issue.title,
      description: issue.description ?? '',
      severity: issue.severity,
      moduleId: issue.deliverable?.module?.id ? String(issue.deliverable.module.id) : '',
      deliverableId: issue.deliverable?.id ? String(issue.deliverable.id) : '',
      taskId: issue.task?.id ? String(issue.task.id) : '',
    })
    Promise.all([
      fetch(`/api/modules?project_id=${issue.project_id}`).then(r => r.json()),
      fetch(`/api/projects/${issue.project_id}/deliverables`).then(r => r.json()),
    ]).then(([mods, delivs]) => {
      setEditModules(mods)
      setEditDeliverables(delivs)
    })
  }

  async function submitEdit() {
    if (!editingIssue) return
    setSaving(true)
    const res = await fetch(`/api/issues/${editingIssue.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editForm.title,
        description: editForm.description,
        severity: editForm.severity,
        deliverable_id: editForm.deliverableId || null,
        task_id: editForm.taskId || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setIssues(prev => prev.map(i => i.id === editingIssue.id ? { ...i, ...updated } : i))
    }
    setSaving(false)
    setEditingIssue(null)
  }

  async function selfAssign(id: number) {
    const userId = (session?.user as any)?.id
    const res = await fetch(`/api/issues/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_id: Number(userId) }),
    })
    if (res.ok) {
      const updated = await res.json()
      setIssues(prev => prev.map(i => i.id === id ? { ...i, assignee: updated.assignee } : i))
    }
  }

  const sevColors: Record<string, string> = {
    high:   'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700',
    medium: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-400 dark:border-orange-700',
    low:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700',
  }

  const selectClass = 'bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const colSpan = 7

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Issues</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Track and manage project issues</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select value={filters.severity} onChange={e => setFilters({ ...filters, severity: e.target.value })} className={selectClass}>
          <option value="">All Severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filters.resolved} onChange={e => setFilters({ ...filters, resolved: e.target.value })} className={selectClass}>
          <option value="">All Status</option>
          <option value="false">Open</option>
          <option value="true">Resolved</option>
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700">
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Issue</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Project</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Severity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Reported by</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Assignee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
            {loading && <tr><td colSpan={colSpan} className="px-6 py-10 text-center text-slate-400">Loading...</td></tr>}
            {!loading && issues.length === 0 && <tr><td colSpan={colSpan} className="px-6 py-10 text-center text-slate-400">No issues found.</td></tr>}
            {issues.map(issue => (
              <tr key={issue.id} className="hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                <td className="px-6 py-4">
                  <p className={`font-medium text-sm ${issue.resolved ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>{issue.title}</p>
                  {issue.description && <p className="text-slate-500 text-xs mt-0.5">{issue.description}</p>}
                  {(issue.deliverable || issue.task) && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
                      {issue.deliverable?.module && (
                        <span className="text-[11px] text-purple-600 dark:text-purple-400">
                          {issue.deliverable.module.title}
                        </span>
                      )}
                      {issue.deliverable?.module && (issue.deliverable || issue.task) && (
                        <span className="text-slate-300 dark:text-slate-600 text-[11px]">›</span>
                      )}
                      {issue.deliverable && (
                        <span className="text-[11px] text-blue-600 dark:text-blue-400">
                          {issue.deliverable.title}
                        </span>
                      )}
                      {issue.task && (
                        <>
                          {issue.deliverable && <span className="text-slate-300 dark:text-slate-600 text-[11px]">›</span>}
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {issue.task.title}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm">{issue.project?.title}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sevColors[issue.severity] || sevColors.medium}`}>
                    {issue.severity.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{issue.user?.name}</td>
                <td className="px-6 py-4">
                  {isManager ? (
                    <select
                      value={issue.assignee?.id ?? ''}
                      onChange={e => assignIssue(issue.id, e.target.value)}
                      className="text-sm bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Unassigned</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  ) : issue.assignee ? (
                    <span className="text-sm text-slate-500 dark:text-slate-400">{issue.assignee.name}</span>
                  ) : !issue.resolved ? (
                    <button
                      onClick={() => selfAssign(issue.id)}
                      className="text-xs px-2 py-1 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors whitespace-nowrap"
                    >
                      + Add to my To Do
                    </button>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {issue.resolved
                    ? <span className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Resolved</span>
                    : <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Open</span>
                  }
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => openEdit(issue)} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline">
                      Edit
                    </button>
                    <button onClick={() => toggleResolved(issue.id, issue.resolved)} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline">
                      {issue.resolved ? 'Reopen' : 'Resolve'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Edit Modal */}
      {editingIssue && (() => {
        const filteredDeliverables = editForm.moduleId
          ? editDeliverables.filter(d => d.module_id === Number(editForm.moduleId))
          : editDeliverables
        const filteredTasks = editForm.deliverableId
          ? editDeliverables.find(d => d.id === Number(editForm.deliverableId))?.tasks ?? []
          : []
        const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
        const labelClass = 'block text-sm text-slate-500 dark:text-slate-400 mb-1'
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md rounded-2xl p-6 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Edit Issue</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{editingIssue.project?.title}</p>
              <div className="space-y-3">
                {/* Scope */}
                <div className="grid grid-cols-1 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Scope <span className="font-normal normal-case text-slate-400">(optional)</span></p>
                  <div>
                    <label className={labelClass}>Module</label>
                    <select value={editForm.moduleId} onChange={e => setEditForm(f => ({ ...f, moduleId: e.target.value, deliverableId: '', taskId: '' }))} className={inputClass}>
                      <option value="">— All modules —</option>
                      {editModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Deliverable</label>
                    <select value={editForm.deliverableId} onChange={e => setEditForm(f => ({ ...f, deliverableId: e.target.value, taskId: '' }))} className={inputClass} disabled={filteredDeliverables.length === 0}>
                      <option value="">— All deliverables —</option>
                      {filteredDeliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Task</label>
                    <select value={editForm.taskId} onChange={e => setEditForm(f => ({ ...f, taskId: e.target.value }))} className={inputClass} disabled={filteredTasks.length === 0}>
                      <option value="">— All tasks —</option>
                      {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Title</label>
                  <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={`${inputClass} h-20 resize-none`} />
                </div>
                <div>
                  <label className={labelClass}>Severity</label>
                  <select value={editForm.severity} onChange={e => setEditForm(f => ({ ...f, severity: e.target.value }))} className={inputClass}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={submitEdit} disabled={saving || !editForm.title.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50 text-sm">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setEditingIssue(null)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}
    </AppLayout>
  )
}
