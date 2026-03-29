'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import AppLayout from '@/components/Layout'

export default function IssuesPage() {
  const { data: session } = useSession()
  const isManager = (session?.user as any)?.role === 'manager'

  const [issues, setIssues]   = useState<any[]>([])
  const [members, setMembers] = useState<{ id: number; name: string }[]>([])
  const [filters, setFilters] = useState({ severity: '', resolved: '' })
  const [loading, setLoading] = useState(true)

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
                  <button onClick={() => toggleResolved(issue.id, issue.resolved)} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline">
                    {issue.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
