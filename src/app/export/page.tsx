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
      // Download file
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

  // Group projects by unit for preview
  const byUnit: Record<string, any[]> = {}
  for (const p of projects) {
    const u = p.unit?.name || 'Unknown'
    if (!byUnit[u]) byUnit[u] = []
    byUnit[u].push(p)
  }

  const statusLabel: Record<string, string> = { InProgress: 'In Progress', OnHold: 'On Hold', Done: 'Done', Pending: 'Pending' }
  const statusColors: Record<string, string> = {
    Done: 'text-green-400',
    InProgress: 'text-orange-400',
    OnHold: 'text-red-400',
    Pending: 'text-slate-400',
  }

  return (
    <AppLayout>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Export Report</h1>
          <p className="text-slate-400 mt-1">Generate PPTX report and notify team via email</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}
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
        <div className="mb-6 bg-green-900/30 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
          Report exported and email sent to all team members!
        </div>
      )}

      {/* Preview */}
      <div className="space-y-6">
        {loading && <p className="text-slate-400">Loading preview...</p>}
        {Object.entries(byUnit).map(([unit, unitProjects]) => {
          const avg = unitProjects.length
            ? Math.round(unitProjects.reduce((s, p) => s + (p.updates?.[0]?.progress_pct ?? 0), 0) / unitProjects.length)
            : 0
          return (
            <div key={unit} className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1e3a5f', backgroundColor: '#162d4a' }}>
                <h2 className="font-semibold text-white">{unit}</h2>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-400">{unitProjects.length} projects</span>
                  <span className="text-blue-400 font-medium">avg {avg}%</span>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: '#1e3a5f' }}>
                {unitProjects.map(p => {
                  const progress = p.updates?.[0]?.progress_pct ?? 0
                  return (
                    <div key={p.id} className="px-6 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{p.title}</p>
                        <p className="text-slate-500 text-xs">{p.owner?.name}</p>
                      </div>
                      <div className="flex items-center gap-2 w-32">
                        <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: '#0a1628' }}>
                          <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">{progress}%</span>
                      </div>
                      <span className={`text-xs font-medium w-20 text-right ${statusColors[p.status] || statusColors.Pending}`}>
                        {statusLabel[p.status] || p.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </AppLayout>
  )
}
