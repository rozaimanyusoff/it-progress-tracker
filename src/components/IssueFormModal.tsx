'use client'

import { useState, useEffect } from 'react'

interface Props {
   context?: {
      project_id?: number
      deliverable_id?: number
      task_id?: number
      assignee_id?: number
   }
   onClose: () => void
   onCreated?: () => void
}

const TYPE_LABELS: Record<string, { label: string; icon: string; placeholder: string }> = {
   bug: { label: 'Bug', icon: '🐛', placeholder: 'Describe the bug or unexpected behaviour...' },
   enhancement: { label: 'Enhancement', icon: '✨', placeholder: 'Describe the improvement or feature request...' },
   clarification: { label: 'Clarification', icon: '❓', placeholder: 'What needs to be clarified or confirmed...' },
}

const SEV_LABELS: Record<string, { label: string; color: string }> = {
   minor: { label: 'Minor', color: 'text-green-600 dark:text-green-400' },
   moderate: { label: 'Moderate', color: 'text-blue-600 dark:text-blue-400' },
   major: { label: 'Major', color: 'text-orange-600 dark:text-orange-400' },
   critical: { label: 'Critical', color: 'text-red-600 dark:text-red-400' },
}

export default function IssueFormModal({ context, onClose, onCreated }: Props) {
   const [projects, setProjects] = useState<{ id: number; title: string }[]>([])
   const [deliverables, setDeliverables] = useState<{ id: number; title: string; tasks: { id: number; title: string }[] }[]>([])
   const [members, setMembers] = useState<{ id: number; name: string }[]>([])

   const [projectId, setProjectId] = useState(context?.project_id ? String(context.project_id) : '')
   const [deliverableId, setDeliverableId] = useState(context?.deliverable_id ? String(context.deliverable_id) : '')
   const [taskId, setTaskId] = useState(context?.task_id ? String(context.task_id) : '')
   const [assigneeId, setAssigneeId] = useState(context?.assignee_id ? String(context.assignee_id) : '')
   const [issueType, setIssueType] = useState('bug')
   const [title, setTitle] = useState('')
   const [description, setDescription] = useState('')
   const [severity, setSeverity] = useState('moderate')
   const [dueDate, setDueDate] = useState('')
   const [saving, setSaving] = useState(false)
   const [error, setError] = useState('')

   const isContextFixed = !!context?.project_id

   useEffect(() => {
      fetch('/api/projects').then(r => r.json()).then((data: any[]) => setProjects(data.map(p => ({ id: p.id, title: p.title }))))
      fetch('/api/users').then(r => r.json()).then(setMembers).catch(() => { })
   }, [])

   useEffect(() => {
      if (!projectId) { setDeliverables([]); return }
      fetch(`/api/projects/${projectId}/deliverables`).then(r => r.json()).then((data: any[]) =>
         setDeliverables(data.map(d => ({
            id: d.id,
            title: d.title,
            tasks: (d.tasks ?? []).map((t: any) => ({ id: t.id, title: t.title })),
         })))
      )
   }, [projectId])

   // Auto-compute due_date by severity
   useEffect(() => {
      const days = severity === 'critical' ? 1 : severity === 'major' ? 3 : severity === 'moderate' ? 7 : 14
      const d = new Date()
      d.setDate(d.getDate() + days)
      setDueDate(d.toISOString().slice(0, 10))
   }, [severity])

   const tasks = deliverableId ? (deliverables.find(d => d.id === Number(deliverableId))?.tasks ?? []) : []

   async function submit() {
      if (!title.trim()) { setError('Title is required'); return }
      if (!projectId) { setError('Project is required'); return }
      setError('')
      setSaving(true)
      const res = await fetch('/api/issues', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            project_id: Number(projectId),
            deliverable_id: deliverableId ? Number(deliverableId) : null,
            task_id: taskId ? Number(taskId) : null,
            assignee_id: assigneeId ? Number(assigneeId) : null,
            issue_type: issueType,
            issue_severity: severity,
            title: title.trim(),
            description: description.trim() || null,
            due_date: dueDate || null,
         }),
      })
      setSaving(false)
      if (!res.ok) {
         const d = await res.json()
         setError(d.error ?? 'Failed to create issue')
         return
      }
      window.dispatchEvent(new Event('issue-created'))
      onCreated?.()
      onClose()
   }

   const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm'
   const labelClass = 'block text-sm text-slate-500 dark:text-slate-400 mb-1'

   return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
         <div className="w-full max-w-lg rounded-2xl p-6 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Report Issue</h3>
               <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">×</button>
            </div>

            {/* Issue Type */}
            <div className="mb-4">
               <label className={labelClass}>Type</label>
               <div className="flex gap-2">
                  {Object.entries(TYPE_LABELS).map(([val, meta]) => (
                     <button
                        key={val}
                        onClick={() => setIssueType(val)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${issueType === val
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                           }`}
                     >
                        {meta.icon} {meta.label}
                     </button>
                  ))}
               </div>
            </div>

            <div className="space-y-3">
               {/* Project */}
               <div>
                  <label className={labelClass}>Project</label>
                  <select
                     value={projectId}
                     onChange={e => { setProjectId(e.target.value); setDeliverableId(''); setTaskId('') }}
                     className={inputClass}
                     disabled={isContextFixed}
                  >
                     <option value="">— Select project —</option>
                     {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
               </div>

               {/* Scope */}
               {projectId && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700">
                     <div>
                        <label className={labelClass}>Deliverable <span className="text-xs text-slate-400">(optional)</span></label>
                        <select
                           value={deliverableId}
                           onChange={e => { setDeliverableId(e.target.value); setTaskId('') }}
                           className={inputClass}
                           disabled={!!context?.deliverable_id}
                        >
                           <option value="">— None —</option>
                           {deliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className={labelClass}>Task <span className="text-xs text-slate-400">(optional)</span></label>
                        <select
                           value={taskId}
                           onChange={e => setTaskId(e.target.value)}
                           className={inputClass}
                           disabled={!deliverableId || !!context?.task_id}
                        >
                           <option value="">— None —</option>
                           {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                     </div>
                  </div>
               )}

               {/* Title */}
               <div>
                  <label className={labelClass}>Title</label>
                  <input
                     type="text"
                     value={title}
                     onChange={e => setTitle(e.target.value)}
                     placeholder={TYPE_LABELS[issueType].placeholder.split(' ').slice(0, 5).join(' ') + '...'}
                     className={inputClass}
                  />
               </div>

               {/* Description */}
               <div>
                  <label className={labelClass}>Description <span className="text-xs text-slate-400">(optional)</span></label>
                  <textarea
                     value={description}
                     onChange={e => setDescription(e.target.value)}
                     placeholder={TYPE_LABELS[issueType].placeholder}
                     className={`${inputClass} h-24 resize-none`}
                  />
               </div>

               {/* Severity + Due Date */}
               <div className="grid grid-cols-2 gap-3">
                  <div>
                     <label className={labelClass}>Severity</label>
                     <select value={severity} onChange={e => setSeverity(e.target.value)} className={inputClass}>
                        {Object.entries(SEV_LABELS).map(([val, meta]) => (
                           <option key={val} value={val}>{meta.label}</option>
                        ))}
                     </select>
                  </div>
                  <div>
                     <label className={labelClass}>Due date <span className="text-xs text-slate-400">(auto)</span></label>
                     <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} />
                  </div>
               </div>

               {/* Assign to */}
               {members.length > 0 && (
                  <div>
                     <label className={labelClass}>Assign to <span className="text-xs text-slate-400">(optional)</span></label>
                     <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={inputClass}>
                        <option value="">Unassigned</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                     </select>
                  </div>
               )}
            </div>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            <div className="flex gap-3 mt-6">
               <button
                  onClick={submit}
                  disabled={saving || !title.trim() || !projectId}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50 text-sm transition-colors"
               >
                  {saving ? 'Submitting...' : 'Submit Issue'}
               </button>
               <button
                  onClick={onClose}
                  className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white py-2 rounded-lg text-sm transition-colors"
               >
                  Cancel
               </button>
            </div>
         </div>
      </div>
   )
}
