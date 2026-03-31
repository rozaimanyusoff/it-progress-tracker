'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import AppLayout from '@/components/Layout'
import { BarChart3, TrendingDown, AlertTriangle, FileDown, Loader2, CheckCircle2 } from 'lucide-react'

const SECTIONS = [
  { key: 'gantt', label: 'Gantt Chart', Icon: BarChart3, desc: 'Timeline of modules & deliverables' },
  { key: 'burndown', label: 'Burndown Chart', Icon: TrendingDown, desc: 'Task completion velocity' },
  { key: 'issues', label: 'Issues', Icon: AlertTriangle, desc: 'Open issues per project' },
] as const

type SectionKey = typeof SECTIONS[number]['key']

function toMonthLabel(ym: string): string {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

function currentYM(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const statusLabel: Record<string, string> = {
  InProgress: 'In Progress', OnHold: 'On Hold', Done: 'Done', Pending: 'Pending',
}
const statusColors: Record<string, string> = {
  Done: 'text-green-600 dark:text-green-400',
  InProgress: 'text-orange-500 dark:text-orange-400',
  OnHold: 'text-red-500 dark:text-red-400',
  Pending: 'text-slate-400',
}

export default function ReportPage() {
  const { data: session } = useSession()
  const user = session?.user as any

  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [fromMonth, setFromMonth] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 2)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [toMonth, setToMonth] = useState(currentYM)
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    gantt: true,
    burndown: true,
    issues: true,
  })
  const [exporting, setExporting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => {
        setProjects(d)
        setSelectedIds(new Set(d.map((p: any) => p.id)))
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

  const allSelected = projects.length > 0 && selectedIds.size === projects.length
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(projects.map(p => p.id)))
  }
  const toggleProject = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }
  const toggleSection = (key: SectionKey) => {
    setSections(s => ({ ...s, [key]: !s[key] }))
  }

  async function handleGenerate() {
    if (selectedIds.size === 0) { setError('Select at least one project.'); return }
    setExporting(true); setDone(false); setError('')
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_ids: Array.from(selectedIds),
          from_month: toMonthLabel(fromMonth),
          to_month: toMonthLabel(toMonth),
          sections,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Export failed'); return }
      if (data.file) {
        const bytes = Uint8Array.from(atob(data.file), c => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const label = fromMonth === toMonth
          ? toMonthLabel(toMonth)
          : `${toMonthLabel(fromMonth)} - ${toMonthLabel(toMonth)}`
        a.download = `IT_Progress_Report_${label.replace(/ /g, '_')}.pptx`
        a.click()
        URL.revokeObjectURL(url)
        setDone(true)
      }
    } finally {
      setExporting(false)
    }
  }

  const activeSections = SECTIONS.filter(s => sections[s.key])

  return (
    <AppLayout>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Report Builder</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure and export a PPTX progress report
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={exporting || selectedIds.size === 0}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          {exporting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
          ) : (
            <><FileDown className="w-4 h-4" /> Generate Report</>
          )}
        </button>
      </div>

      {done && (
        <div className="mb-5 flex items-center gap-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Report generated and downloaded successfully.
        </div>
      )}
      {error && (
        <div className="mb-5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Left: Project Selection */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Select Projects</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">{selectedIds.size} of {projects.length} selected</span>
          </div>

          {/* Select All row */}
          <div
            className="px-5 py-3 border-b border-slate-100 dark:border-navy-700 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-700/50 transition-colors"
            onClick={toggleAll}
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${allSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-navy-500'}`}>
              {allSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Select All</span>
          </div>

          {loading && (
            <p className="px-5 py-6 text-slate-400 text-sm text-center">Loading projects...</p>
          )}

          <div className="divide-y divide-slate-100 dark:divide-navy-700">
            {projects.map(p => {
              const progress = p.updates?.[0]?.progress_pct ?? 0
              const checked = selectedIds.has(p.id)
              return (
                <div
                  key={p.id}
                  className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-700/50 transition-colors"
                  onClick={() => toggleProject(p.id)}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-navy-500'}`}>
                    {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{p.title}</p>
                  </div>
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <div className="flex-1 bg-slate-200 dark:bg-navy-900 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-7 text-right">{progress}%</span>
                  </div>
                  <span className={`text-xs font-medium w-20 text-right shrink-0 ${statusColors[p.status] ?? statusColors.Pending}`}>
                    {statusLabel[p.status] ?? p.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Options */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Period */}
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700">
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Report Period</h2>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">From</label>
                <input
                  type="month"
                  value={fromMonth}
                  max={toMonth}
                  onChange={e => setFromMonth(e.target.value)}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">To</label>
                <input
                  type="month"
                  value={toMonth}
                  min={fromMonth}
                  onChange={e => setToMonth(e.target.value)}
                  className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {fromMonth && toMonth && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {fromMonth === toMonth
                    ? toMonthLabel(toMonth)
                    : `${toMonthLabel(fromMonth)} — ${toMonthLabel(toMonth)}`}
                </p>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Include in Report</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{activeSections.length} sections</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-1">
              {SECTIONS.map(({ key, label, Icon, desc }) => {
                const active = sections[key]
                return (
                  <div
                    key={key}
                    onClick={() => toggleSection(key)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${active ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-navy-700/50'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-navy-700 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium transition-colors ${active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>{label}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{desc}</p>
                    </div>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-navy-500'}`}>
                      {active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary */}
          {selectedIds.size > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700/50 px-5 py-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Summary</p>
              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                <li><span className="text-slate-400 dark:text-slate-500">Projects: </span>{selectedIds.size}</li>
                <li>
                  <span className="text-slate-400 dark:text-slate-500">Period: </span>
                  {fromMonth === toMonth ? toMonthLabel(toMonth) : `${toMonthLabel(fromMonth)} — ${toMonthLabel(toMonth)}`}
                </li>
                <li>
                  <span className="text-slate-400 dark:text-slate-500">Sections: </span>
                  {activeSections.length > 0 ? activeSections.map(s => s.label).join(', ') : 'None'}
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}


