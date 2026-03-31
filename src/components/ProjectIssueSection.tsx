'use client'

import { useState, useEffect } from 'react'

interface IssueTask {
  id: number
  title: string
  assignee: { id: number; name: string } | null
}

interface Issue {
  id: number
  title: string
  description: string | null
  severity: string
  resolved: boolean
  media_urls: string[]
  created_at: string
  user: { id: number; name: string }
  assignee: { id: number; name: string } | null
  deliverable: {
    id: number
    title: string
    module: { id: number; title: string } | null
    tasks: IssueTask[]
  } | null
  task: IssueTask | null
}

const SEVERITY_STYLE: Record<string, string> = {
  high:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800',
  medium: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
  low:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  const sz = size === 'xs' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'
  return (
    <span className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}>
      {name[0].toUpperCase()}
    </span>
  )
}

export default function ProjectIssueSection({ projectId, refreshKey }: { projectId: number; refreshKey?: number }) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open')

  function fetchIssues() {
    setLoading(true)
    fetch(`/api/projects/${projectId}/issues`)
      .then(r => r.json())
      .then(data => { setIssues(data); setLoading(false) })
  }

  useEffect(() => { fetchIssues() }, [projectId, refreshKey])

  useEffect(() => {
    window.addEventListener('issue-created', fetchIssues)
    return () => window.removeEventListener('issue-created', fetchIssues)
  }, [projectId])

  async function toggleResolved(issue: Issue) {
    const res = await fetch(`/api/issues/${issue.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: !issue.resolved }),
    })
    if (res.ok) {
      setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, resolved: !i.resolved } : i))
    }
  }

  const filtered = issues.filter(i =>
    filter === 'all' ? true : filter === 'open' ? !i.resolved : i.resolved
  )

  const openCount = issues.filter(i => !i.resolved).length

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
        <div className="flex items-center gap-1 text-xs">
          {(['open', 'resolved', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg capitalize transition-colors ${
                filter === f
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-medium'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Loading issues...</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">
          {filter === 'open' ? 'No open issues.' : filter === 'resolved' ? 'No resolved issues.' : 'No issues reported.'}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-navy-700">
          {filtered.map(issue => {
            // Collect previous assignees from the deliverable's tasks
            const deliverableAssignees = issue.deliverable?.tasks
              .map(t => t.assignee)
              .filter((a): a is { id: number; name: string } => a !== null)
              .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i) ?? []

            const taskAssignee = issue.task?.assignee ?? null

            return (
              <div key={issue.id} className={`px-5 py-4 transition-colors ${issue.resolved ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  {/* Severity dot */}
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                    issue.severity === 'high' ? 'bg-red-500' :
                    issue.severity === 'medium' ? 'bg-orange-400' : 'bg-green-500'
                  }`} />

                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium text-sm text-slate-900 dark:text-white ${issue.resolved ? 'line-through decoration-slate-400' : ''}`}>
                          {issue.title}
                        </p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${SEVERITY_STYLE[issue.severity]}`}>
                          {issue.severity}
                        </span>
                        {issue.resolved && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                            Resolved
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleResolved(issue)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors shrink-0 ${
                          issue.resolved
                            ? 'border-slate-300 dark:border-navy-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            : 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
                        }`}
                      >
                        {issue.resolved ? 'Reopen' : '✓ Resolve'}
                      </button>
                    </div>

                    {/* Description */}
                    {issue.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{issue.description}</p>
                    )}

                    {/* Scope context */}
                    {(issue.deliverable || issue.task) && (
                      <div className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-1.5 text-xs">
                        {issue.deliverable?.module && (
                          <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                            <span className="font-medium">Module:</span>
                            <span>{issue.deliverable.module.title}</span>
                          </div>
                        )}
                        {issue.deliverable && (
                          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <span className="font-medium">Deliverable:</span>
                            <span>{issue.deliverable.title}</span>
                          </div>
                        )}
                        {issue.task && (
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <span className="font-medium">Task:</span>
                            <span>{issue.task.title}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Previous assignees context */}
                    {(taskAssignee || deliverableAssignees.length > 0) && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {issue.task ? 'Task assignee:' : 'Deliverable assignees:'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {issue.task ? (
                            taskAssignee && (
                              <div className="flex items-center gap-1">
                                <Avatar name={taskAssignee.name} size="xs" />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{taskAssignee.name}</span>
                              </div>
                            )
                          ) : (
                            deliverableAssignees.map(a => (
                              <div key={a.id} className="flex items-center gap-1">
                                <Avatar name={a.name} size="xs" />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{a.name}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Attachments */}
                    {issue.media_urls.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {issue.media_urls.map((url, i) => {
                          const isPdf = url.toLowerCase().endsWith('.pdf')
                          const isVid = /\.(mp4|webm|mov)$/i.test(url)
                          return isPdf ? (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-navy-600 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700">
                              📄 PDF
                            </a>
                          ) : isVid ? (
                            <video key={i} src={url} className="w-16 h-16 object-cover rounded border border-slate-200 dark:border-navy-600" muted />
                          ) : (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="" className="w-16 h-16 object-cover rounded border border-slate-200 dark:border-navy-600 hover:opacity-90" />
                            </a>
                          )
                        })}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                      <div className="flex items-center gap-1">
                        <Avatar name={issue.user.name} size="xs" />
                        <span>Reported by <span className="font-medium text-slate-600 dark:text-slate-300">{issue.user.name}</span></span>
                      </div>
                      <span>·</span>
                      <span>{timeAgo(issue.created_at)}</span>
                      {issue.assignee && (
                        <>
                          <span>·</span>
                          <div className="flex items-center gap-1">
                            <span>Assigned to</span>
                            <Avatar name={issue.assignee.name} size="xs" />
                            <span className="font-medium text-slate-600 dark:text-slate-300">{issue.assignee.name}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
