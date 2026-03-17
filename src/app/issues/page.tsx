'use client'
import { useState, useEffect } from 'react'
import AppLayout from '@/components/Layout'

export default function IssuesPage() {
  const [issues, setIssues] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [filters, setFilters] = useState({ unit: '', severity: '', resolved: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/units').then(r => r.json()).then(setUnits)
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.unit) params.set('unit', filters.unit)
    if (filters.severity) params.set('severity', filters.severity)
    if (filters.resolved !== '') params.set('resolved', filters.resolved)
    fetch(`/api/issues?${params}`).then(r => r.json()).then(d => { setIssues(d); setLoading(false) })
  }, [filters])

  async function toggleResolved(id: number, current: boolean) {
    await fetch(`/api/issues/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: !current }),
    })
    setIssues(prev => prev.map(i => i.id === id ? { ...i, resolved: !current } : i))
  }

  const sevColors: Record<string, string> = {
    high: 'bg-red-900/50 text-red-400 border-red-700',
    medium: 'bg-orange-900/50 text-orange-400 border-orange-700',
    low: 'bg-green-900/50 text-green-400 border-green-700',
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Issues</h1>
        <p className="text-slate-400 mt-1">Track and manage project issues</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={filters.unit}
          onChange={e => setFilters({ ...filters, unit: e.target.value })}
          className="border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}
        >
          <option value="">All Units</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select
          value={filters.severity}
          onChange={e => setFilters({ ...filters, severity: e.target.value })}
          className="border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}
        >
          <option value="">All Severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filters.resolved}
          onChange={e => setFilters({ ...filters, resolved: e.target.value })}
          className="border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}
        >
          <option value="">All Status</option>
          <option value="false">Open</option>
          <option value="true">Resolved</option>
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: '#1e3a5f', backgroundColor: '#162d4a' }}>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Issue</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Project</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Unit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Severity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Reported by</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#1e3a5f' }}>
            {loading && <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">Loading...</td></tr>}
            {!loading && issues.length === 0 && <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-500">No issues found.</td></tr>}
            {issues.map(issue => (
              <tr key={issue.id} className="hover:bg-navy-700 transition-colors">
                <td className="px-6 py-4">
                  <p className={`font-medium text-sm ${issue.resolved ? 'line-through text-slate-500' : 'text-white'}`}>{issue.title}</p>
                  {issue.description && <p className="text-slate-500 text-xs mt-0.5">{issue.description}</p>}
                </td>
                <td className="px-6 py-4 text-slate-300 text-sm">{issue.project?.title}</td>
                <td className="px-6 py-4 text-slate-400 text-sm">{issue.project?.unit?.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sevColors[issue.severity] || sevColors.medium}`}>
                    {issue.severity.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400 text-sm">{issue.user?.name}</td>
                <td className="px-6 py-4">
                  {issue.resolved
                    ? <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">Resolved</span>
                    : <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">Open</span>
                  }
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleResolved(issue.id, issue.resolved)}
                    className="text-xs text-blue-400 hover:text-blue-300 underline"
                  >
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
