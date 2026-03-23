'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import AppLayout from '@/components/Layout'

export default function ExportPage() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return d.toLocaleString('default', { month: 'long', year: 'numeric' })
  })

  const user = session?.user as any

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      setProjects(d)
      setLoading(false)
    })
  }, [])

  if (user?.role !== 'manager') {
    return (
      <AppLayout>
        <div className="text-center py-20 text-slate-400">Access denied. Manager only.</div>
      </AppLayout>
    )
  }

  async function handleExport() {
    setExporting(true)
    setDone(false)
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month }),
    })
    const data = await res.json()
    if (data.file) {
      const bytes = Uint8Array.from(atob(data.file), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `IT_Progress_Report_${month.replace(' ', '_')}.pptx`
      a.click()
      URL.revokeObjectURL(url)
      setDone(true)
    }
    setExporting(false)
  }

  const statusLabel: Record<string, string> = { InProgress: 'In Progress', OnHold: 'On Hold', Done: 'Done', Pending: 'Pending' }
  const statusColors: Record<string, string> = {
    Done: 'text-green-600 dark:text-green-400',
    InProgress: 'text-orange-600 dark:text-orange-400',
    OnHold: 'text-red-600 dark:text-red-400',
    Pending: 'text-slate-500 dark:text-slate-400',
  }

  return (
    <AppLayout>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Export Report</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Generate PPTX report and notify team via email</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. March 2026"
          />
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {exporting ? (
              <><span className="animate-spin">↻</span> Generating...</>
            ) : (
              <><span>↓</span> Export PPTX</>
            )}
          </button>
        </div>
      </div>

      {done && (
        <div className="mb-6 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-500/50 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
          Report exported and email sent to all team members!
        </div>
      )}

      <div className="rounded-xl border overflow-hidden bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between bg-slate-50 dark:bg-navy-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">All Projects</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">{projects.length} projects</span>
            {projects.length > 0 && (
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                avg {Math.round(projects.reduce((s, p) => s + (p.updates?.[0]?.progress_pct ?? 0), 0) / projects.length)}%
              </span>
            )}
          </div>
        </div>
        {loading && <p className="px-6 py-4 text-slate-400 text-sm">Loading preview...</p>}
        <div className="divide-y divide-slate-100 dark:divide-navy-700">
          {projects.map(p => {
            const progress = p.updates?.[0]?.progress_pct ?? 0
            return (
              <div key={p.id} className="px-6 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white text-sm font-medium truncate">{p.title}</p>
                  <p className="text-slate-500 text-xs">{p.owner?.name}</p>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <div className="flex-1 bg-slate-200 dark:bg-navy-900 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">{progress}%</span>
                </div>
                <span className={`text-xs font-medium w-20 text-right ${statusColors[p.status] || statusColors.Pending}`}>
                  {statusLabel[p.status] || p.status}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}
