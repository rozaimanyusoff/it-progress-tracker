'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface ProjectActionsProps {
  project: {
    id: number
    title: string
    description: string | null
    status: string
    deadline: string
    assignees: { user: { id: number; name: string } }[]
  }
  isManager: boolean
  onIssueCreated?: () => void
}

export default function ProjectActions({ project, isManager, onIssueCreated }: ProjectActionsProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Edit modal (manager)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    title: project.title,
    description: project.description ?? '',
    status: project.status,
    deadline: project.deadline.slice(0, 10),
    assignee_ids: project.assignees.map(a => a.user.id),
  })
  const [members, setMembers] = useState<{ id: number; name: string }[]>([])

  // Issue modal
  const [showIssue, setShowIssue] = useState(false)
  const [issueForm, setIssueForm] = useState({ title: '', description: '', severity: 'medium' })
  const [issueModuleId, setIssueModuleId] = useState('')
  const [issueDeliverableId, setIssueDeliverableId] = useState('')
  const [issueTaskId, setIssueTaskId] = useState('')
  const [modules, setModules] = useState<{ id: number; title: string }[]>([])
  const [deliverables, setDeliverables] = useState<{ id: number; title: string; module_id: number | null; tasks: { id: number; title: string }[] }[]>([])
  const [issueFiles, setIssueFiles] = useState<File[]>([])
  const [issuePreviews, setIssuePreviews] = useState<string[]>([])
  const issueFileInputRef = useRef<HTMLInputElement>(null)

  function handleIssueFiles(selected: FileList | null) {
    if (!selected) return
    const newFiles = Array.from(selected)
    setIssueFiles(prev => [...prev, ...newFiles])
    newFiles.forEach(f => setIssuePreviews(prev => [...prev, URL.createObjectURL(f)]))
  }

  function removeIssueFile(index: number) {
    URL.revokeObjectURL(issuePreviews[index])
    setIssueFiles(prev => prev.filter((_, i) => i !== index))
    setIssuePreviews(prev => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    if (isManager) {
      fetch('/api/users').then(r => r.json()).then(setMembers)
    }
  }, [isManager])

  async function submitEdit() {
    setSaving(true)
    await fetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSaving(false)
    setShowEdit(false)
    router.refresh()
  }

  function openIssue() {
    setIssueForm({ title: '', description: '', severity: 'medium' })
    setIssueModuleId('')
    setIssueDeliverableId('')
    setIssueTaskId('')
    setIssueFiles([])
    setIssuePreviews([])
    Promise.all([
      fetch(`/api/modules?project_id=${project.id}`).then(r => r.json()),
      fetch(`/api/projects/${project.id}/deliverables`).then(r => r.json()),
    ]).then(([mods, delivs]) => {
      setModules(mods)
      setDeliverables(delivs)
    })
    setShowIssue(true)
  }

  async function submitIssue() {
    setSaving(true)
    let mediaUrls: string[] = []
    if (issueFiles.length > 0) {
      const fd = new FormData()
      fd.append('context', 'issues')
      issueFiles.forEach(f => fd.append('files', f))
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
      if (uploadRes.ok) {
        const { urls } = await uploadRes.json()
        mediaUrls = urls
      }
    }
    await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: project.id,
        ...(issueDeliverableId && { deliverable_id: Number(issueDeliverableId) }),
        ...(issueTaskId && { task_id: Number(issueTaskId) }),
        media_urls: mediaUrls,
        ...issueForm,
      }),
    })
    setSaving(false)
    setShowIssue(false)
    onIssueCreated?.()
    window.dispatchEvent(new CustomEvent('issue-created'))
    router.refresh()
  }

  // Cascading filter helpers
  const filteredDeliverables = issueModuleId
    ? deliverables.filter(d => d.module_id === Number(issueModuleId))
    : deliverables
  const filteredTasks = issueDeliverableId
    ? deliverables.find(d => d.id === Number(issueDeliverableId))?.tasks ?? []
    : []

  const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm text-slate-500 dark:text-slate-400 mb-1'

  return (
    <>
      <div className="flex items-center gap-2">
        {isManager && (
          <button
            onClick={() => setShowEdit(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
          >
            Edit
          </button>
        )}
        <button
          onClick={openIssue}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
        >
          + Issue
        </button>
      </div>

      {/* Edit Modal */}
      {showEdit && (
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
                <label className={labelClass}>Assignees</label>
                <div className="rounded-lg border border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 divide-y divide-slate-200 dark:divide-navy-700 max-h-40 overflow-y-auto">
                  {members.map(m => (
                    <label key={m.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={editForm.assignee_ids.includes(m.id)}
                        onChange={() => setEditForm(prev => ({
                          ...prev,
                          assignee_ids: prev.assignee_ids.includes(m.id)
                            ? prev.assignee_ids.filter(x => x !== m.id)
                            : [...prev.assignee_ids, m.id],
                        }))}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-800 dark:text-slate-200">{m.name}</span>
                    </label>
                  ))}
                </div>
                {editForm.assignee_ids.length > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{editForm.assignee_ids.length} member(s) selected</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={submitEdit} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setShowEdit(false)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Modal */}
      {showIssue && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Report Issue</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{project.title}</p>
            <div className="space-y-3">
              {/* Cascading scope selectors */}
              <div className="grid grid-cols-1 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Scope <span className="font-normal normal-case text-slate-400">(optional)</span></p>
                <div>
                  <label className={labelClass}>Module</label>
                  <select
                    value={issueModuleId}
                    onChange={e => { setIssueModuleId(e.target.value); setIssueDeliverableId(''); setIssueTaskId('') }}
                    className={inputClass}
                  >
                    <option value="">— All modules —</option>
                    {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Deliverable</label>
                  <select
                    value={issueDeliverableId}
                    onChange={e => { setIssueDeliverableId(e.target.value); setIssueTaskId('') }}
                    className={inputClass}
                    disabled={filteredDeliverables.length === 0}
                  >
                    <option value="">— All deliverables —</option>
                    {filteredDeliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Task</label>
                  <select
                    value={issueTaskId}
                    onChange={e => setIssueTaskId(e.target.value)}
                    className={inputClass}
                    disabled={filteredTasks.length === 0}
                  >
                    <option value="">— All tasks —</option>
                    {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Title</label>
                <input type="text" value={issueForm.title} onChange={e => setIssueForm({ ...issueForm, title: e.target.value })} className={inputClass} placeholder="Briefly describe the issue" />
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

              {/* Attachments */}
              <div>
                <label className={labelClass}>Attachments <span className="font-normal text-slate-400">(images, videos, PDF)</span></label>
                <button
                  type="button"
                  onClick={() => issueFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-300 dark:border-navy-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
                >
                  <span>📎</span> Attach files
                </button>
                <input
                  ref={issueFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,application/pdf"
                  className="hidden"
                  onChange={e => handleIssueFiles(e.target.files)}
                />
                {issuePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {issuePreviews.map((url, i) => {
                      const name = issueFiles[i]?.name ?? ''
                      const isPdf = name.toLowerCase().endsWith('.pdf')
                      const isVid = /\.(mp4|webm|mov)$/i.test(name)
                      return (
                        <div key={i} className="relative group w-16 shrink-0">
                          {isPdf ? (
                            <div className="w-16 h-16 flex flex-col items-center justify-center rounded-lg border border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 gap-0.5">
                              <span className="text-xl">📄</span>
                              <span className="text-[9px] font-semibold text-slate-500 uppercase">PDF</span>
                            </div>
                          ) : isVid ? (
                            <div className="relative">
                              <video src={url} className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-navy-600" muted />
                              <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 pointer-events-none">
                                <span className="text-white">▶</span>
                              </span>
                            </div>
                          ) : (
                            <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-navy-600" />
                          )}
                          <button
                            onClick={() => removeIssueFile(i)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >×</button>
                          <p className="text-[10px] text-slate-400 truncate w-16 mt-0.5 text-center">{name}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={submitIssue} disabled={saving || !issueForm.title.trim()} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Report Issue'}
              </button>
              <button onClick={() => setShowIssue(false)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2 rounded-lg">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
