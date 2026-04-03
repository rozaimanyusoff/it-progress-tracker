'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import IssueFormModal from './IssueFormModal'

interface HistoryEntry {
  id: number
  action: string
  from_value: string | null
  to_value: string | null
  note: string | null
  created_at: string
  user: { id: number; name: string }
}

interface Issue {
  id: number
  title: string
  description: string | null
  issue_type: string
  issue_severity: string
  issue_status: string
  due_date: string | null
  resolution_note: string | null
  resolved_at: string | null
  media_urls: string[]
  created_at: string
  user: { id: number; name: string }
  assignee: { id: number; name: string } | null
  resolved_by: { id: number; name: string } | null
  deliverable: { id: number; title: string; module: { id: number; title: string } | null } | null
  task: { id: number; title: string } | null
}

const SEV_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-700',
  major: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-700',
  moderate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700',
  minor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-700',
}

const SEV_DOT: Record<string, string> = {
  critical: 'bg-red-500', major: 'bg-orange-400', moderate: 'bg-blue-400', minor: 'bg-green-500'
}

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  resolved: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed'
}

const TYPE_ICON: Record<string, string> = { bug: '🐛', enhancement: '✨', clarification: '❓' }

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function isOverdue(due: string | null, status: string) {
  if (!due || status === 'resolved' || status === 'closed') return false
  return new Date(due) < new Date()
}

export default function ProjectIssueSection({ projectId, refreshKey }: { projectId: number; refreshKey?: number }) {
  const { data: session } = useSession()
  const isManager = (session?.user as any)?.role === 'manager'
  const currentUserId = Number((session?.user as any)?.id)

  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: 'open', type: '', severity: '' })
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [history, setHistory] = useState<Record<number, HistoryEntry[]>>({})
  const [historyLoading, setHistoryLoading] = useState<number | null>(null)

  // Status-change modal state
  const [statusModal, setStatusModal] = useState<{ issue: Issue; toStatus: string } | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [reopenReason, setReopenReason] = useState('')
  const [transitioning, setTransitioning] = useState(false)

  const fetchIssues = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.status) params.set('issue_status', filters.status)
    if (filters.type) params.set('issue_type', filters.type)
    if (filters.severity) params.set('issue_severity', filters.severity)
    fetch(`/api/projects/${projectId}/issues?${params}`)
      .then(r => r.json())
      .then(data => { setIssues(data); setLoading(false) })
  }, [projectId, filters])

  useEffect(() => { fetchIssues() }, [fetchIssues, refreshKey])

  useEffect(() => {
    const h = () => fetchIssues()
    window.addEventListener('issue-created', h)
    return () => window.removeEventListener('issue-created', h)
  }, [fetchIssues])

  async function loadHistory(issueId: number) {
    if (history[issueId]) return
    setHistoryLoading(issueId)
    const data = await fetch(`/api/issues/${issueId}/history`).then(r => r.json())
    setHistory(prev => ({ ...prev, [issueId]: data }))
    setHistoryLoading(null)
  }

  function toggleExpand(id: number) {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    if (next) loadHistory(next)
  }

  function openStatusModal(issue: Issue, toStatus: string) {
    setStatusModal({ issue, toStatus })
    setResolutionNote('')
    setReopenReason('')
  }

  async function confirmTransition() {
    if (!statusModal) return
    setTransitioning(true)
    const body: any = { issue_status: statusModal.toStatus }
    if (statusModal.toStatus === 'resolved') body.resolution_note = resolutionNote
    if (statusModal.toStatus === 'open') body.reopen_reason = reopenReason
    const res = await fetch(`/api/issues/${statusModal.issue.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setTransitioning(false)
    if (!res.ok) {
      const d = await res.json()
      alert(d.error ?? 'Failed to update status')
      return
    }
    setStatusModal(null)
    setHistory({})
    fetchIssues()
  }

  const openCount = issues.filter(i => i.issue_status === 'open' || i.issue_status === 'in_progress').length

  return (
    <div className="mt-6 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-navy-700 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Issues</h2>
          {openCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              {openCount} open
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filters */}
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300"
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select
            value={filters.severity}
            onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}
            className="text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300"
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="moderate">Moderate</option>
            <option value="minor">Minor</option>
          </select>
          <select
            value={filters.type}
            onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
            className="text-xs bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300"
          >
            <option value="">All types</option>
            <option value="bug">🐛 Bug</option>
            <option value="enhancement">✨ Enhancement</option>
            <option value="clarification">❓ Clarification</option>
          </select>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            + Issue
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Loading issues...</div>
      ) : issues.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">No issues found.</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-navy-700">
          {issues.map(issue => {
            const overdue = isOverdue(issue.due_date, issue.issue_status)
            const isExpanded = expandedId === issue.id

            return (
              <div key={issue.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEV_DOT[issue.issue_severity] ?? 'bg-slate-400'}`} />
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span title={issue.issue_type} className="text-base leading-none">{TYPE_ICON[issue.issue_type] ?? '📋'}</span>
                        <p className={`font-medium text-sm text-slate-900 dark:text-white ${issue.issue_status === 'closed' ? 'line-through text-slate-400' : ''}`}>
                          {issue.title}
                        </p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${SEV_STYLE[issue.issue_severity] ?? ''}`}>
                          {issue.issue_severity}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${STATUS_STYLE[issue.issue_status] ?? ''}`}>
                          {STATUS_LABEL[issue.issue_status] ?? issue.issue_status}
                        </span>
                        {overdue && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      {/* Workflow actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {issue.issue_status === 'open' && (
                          <button onClick={() => openStatusModal(issue, 'in_progress')} className="text-xs px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20">
                            Start
                          </button>
                        )}
                        {issue.issue_status === 'in_progress' && (
                          <button onClick={() => openStatusModal(issue, 'resolved')} className="text-xs px-2 py-1 rounded-lg border border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20">
                            Resolve
                          </button>
                        )}
                        {issue.issue_status === 'resolved' && isManager && (
                          <>
                            <button onClick={() => openStatusModal(issue, 'closed')} className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-navy-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                              Close
                            </button>
                            <button onClick={() => openStatusModal(issue, 'open')} className="text-xs px-2 py-1 rounded-lg border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                              Reopen
                            </button>
                          </>
                        )}
                        {issue.issue_status === 'closed' && isManager && (
                          <button onClick={() => openStatusModal(issue, 'open')} className="text-xs px-2 py-1 rounded-lg border border-orange-300 dark:border-orange-700 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20">
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {issue.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{issue.description}</p>
                    )}

                    {/* Scope */}
                    {(issue.deliverable || issue.task) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {issue.deliverable?.module && (
                          <span className="text-purple-600 dark:text-purple-400">{issue.deliverable.module.title}</span>
                        )}
                        {issue.deliverable && (
                          <span className="text-blue-600 dark:text-blue-400">› {issue.deliverable.title}</span>
                        )}
                        {issue.task && (
                          <span className="text-slate-500 dark:text-slate-400">› {issue.task.title}</span>
                        )}
                      </div>
                    )}

                    {/* Attachments */}
                    {issue.media_urls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {issue.media_urls.map((url, i) => {
                          const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
                          return isImg ? (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="" className="w-14 h-14 object-cover rounded border border-slate-200 dark:border-navy-600 hover:opacity-90" />
                            </a>
                          ) : (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-navy-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700">
                              📄 Attachment
                            </a>
                          )
                        })}
                      </div>
                    )}

                    {/* Resolution note */}
                    {issue.resolution_note && (
                      <div className="mt-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300">
                        <span className="font-semibold">Resolution: </span>{issue.resolution_note}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-2 flex items-center gap-3 flex-wrap text-xs text-slate-400 dark:text-slate-500">
                      <span>By <span className="font-medium text-slate-600 dark:text-slate-300">{issue.user.name}</span>  · {timeAgo(issue.created_at)}</span>
                      {issue.due_date && (
                        <span className={overdue ? 'text-red-500' : ''}>
                          Due {new Date(issue.due_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                      {issue.assignee && (
                        <span>→ <span className="font-medium text-slate-600 dark:text-slate-300">{issue.assignee.name}</span></span>
                      )}
                      {issue.resolved_by && (
                        <span>✓ by <span className="font-medium text-slate-600 dark:text-slate-300">{issue.resolved_by.name}</span></span>
                      )}
                      <button
                        onClick={() => toggleExpand(issue.id)}
                        className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                      >
                        {isExpanded ? 'Hide history' : 'History'}
                      </button>
                    </div>

                    {/* History timeline */}
                    {isExpanded && (
                      <div className="mt-3 pl-3 border-l-2 border-slate-200 dark:border-navy-600 space-y-2">
                        {historyLoading === issue.id ? (
                          <p className="text-xs text-slate-400">Loading...</p>
                        ) : (history[issue.id] ?? []).length === 0 ? (
                          <p className="text-xs text-slate-400">No history yet.</p>
                        ) : (
                          (history[issue.id] ?? []).map(h => (
                            <div key={h.id} className="text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-medium text-slate-600 dark:text-slate-300">{h.user.name}</span>{' '}
                              {h.action === 'status_changed' && <>changed status from <span className="font-medium">{STATUS_LABEL[h.from_value ?? ''] ?? h.from_value}</span> → <span className="font-medium">{STATUS_LABEL[h.to_value ?? ''] ?? h.to_value}</span></>}
                              {h.action === 'reopened' && <>reopened this issue{h.note ? `: ${h.note}` : ''}</>}
                              {h.action === 'reassigned' && <>reassigned to user #{h.to_value}</>}
                              {h.action === 'created' && <>reported this issue</>}
                              <span className="text-slate-400 ml-1">· {timeAgo(h.created_at)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Issue Form Modal */}
      {showForm && (
        <IssueFormModal
          context={{ project_id: projectId }}
          onClose={() => setShowForm(false)}
          onCreated={fetchIssues}
        />
      )}

      {/* Status Transition Modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-2xl p-6 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              {statusModal.toStatus === 'in_progress' && 'Start working on this issue?'}
              {statusModal.toStatus === 'resolved' && 'Mark as resolved'}
              {statusModal.toStatus === 'closed' && 'Close this issue?'}
              {statusModal.toStatus === 'open' && 'Reopen this issue?'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{statusModal.issue.title}</p>

            {statusModal.toStatus === 'resolved' && (
              <div className="mb-4">
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Resolution note <span className="text-red-500">*</span> <span className="text-xs">(min 10 chars)</span></label>
                <textarea
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none text-slate-900 dark:text-white"
                  placeholder="Describe how this was resolved..."
                />
              </div>
            )}

            {statusModal.toStatus === 'open' && (
              <div className="mb-4">
                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-1">Reason for reopening <span className="text-xs text-slate-400">(optional)</span></label>
                <textarea
                  value={reopenReason}
                  onChange={e => setReopenReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none text-slate-900 dark:text-white"
                  placeholder="Why is this being reopened?"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={confirmTransition}
                disabled={transitioning || (statusModal.toStatus === 'resolved' && resolutionNote.trim().length < 10)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50 text-sm"
              >
                {transitioning ? 'Saving...' : 'Confirm'}
              </button>
              <button
                onClick={() => setStatusModal(null)}
                className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

