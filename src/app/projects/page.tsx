'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/Layout'
import BurndownChart from '@/components/BurndownChart'
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { createPortal } from 'react-dom'

// ── Types ─────────────────────────────────────────────────────────
type Project = {
  id: number; title: string; description: string | null; status: string
  start_date: string; deadline: string
  health_status?: string | null
  computedHealthStatus?: 'on_track' | 'at_risk' | 'delayed' | 'overdue' | null
  completionRate?: number | null
  onTimeCompletionRate?: number | null
  scopeVolatility?: number | null
  assignees: { user: { id: number; name: string; email: string } }[]
  updates: { progress_pct: number }[]
  _count: { issues: number }
  computedProgress: number
  computedStatus: string
  monthlyData?: {
    monthKey: string
    month: string
    assigned: number
    completed: number
    onTimeCompleted: number
    lateCompleted: number
    overdueOpen: number
  }[]
  burndownTasks?: {
    id: number
    status: string
    actual_end: string | null
  }[]
}
type Feature = {
  id: number; title: string; description: string | null; mandays: number
  status: string
  project_links?: { project: { id: number; title: string } }[]
}
type TemplateTask = {
  id: number; name: string; est_mandays: number | null; sort_order: number
}
type TemplateDeliverable = {
  id: number; name: string; type: string; sort_order: number; tasks: TemplateTask[]
}
type ModuleTemplate = {
  id: number; code: string; display_name: string; description: string | null
  icon: string | null; sort_order: number; is_active: boolean
  deliverables: TemplateDeliverable[]
}

const TABS = ['Projects', 'New Project', 'Features', 'Task Categories'] as const
type Tab = typeof TABS[number]

const inputClass = 'w-full bg-slate-50 dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg text-sm font-medium shadow-lg ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {msg}
    </div>
  )
}

// ── Type badge colours (shared with ModuleTemplateModal) ──────────
const TYPE_BADGE: Record<string, string> = {
  database: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  backend: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  frontend: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  testing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  documentation: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

// ── Status helpers ─────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OnHold: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
}
const STATUS_LABEL: Record<string, string> = {
  Pending: 'Pending', InProgress: 'In Progress', Done: 'Done', OnHold: 'On Hold',
}

type KPITone = 'neutral' | 'good' | 'warning' | 'danger'

const KPI_TONE_CLASS: Record<KPITone, string> = {
  neutral: 'border-slate-200 bg-gray-50 dark:border-navy-700 dark:bg-navy-900/40',
  good: 'border-green-200 bg-green-50 dark:border-green-800/70 dark:bg-green-900/20',
  warning: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800/70 dark:bg-yellow-900/20',
  danger: 'border-red-200 bg-red-50 dark:border-red-800/70 dark:bg-red-900/20',
}

function KPIInfoCard({
  label,
  value,
  valueClassName,
  tone = 'neutral',
  generalExplanation,
  currentExplanation,
}: {
  label: string
  value: string
  valueClassName: string
  tone?: KPITone
  generalExplanation: string
  currentExplanation: string
}) {
  return (
    <div className={`rounded-md border px-2 py-2 relative ${KPI_TONE_CLASS[tone]}`}>
      <div className="relative group">
        <span
          className="absolute -top-2 -right-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 cursor-help"
          title={`General: ${generalExplanation}\nCurrent: ${currentExplanation}`}
        >
          ?
        </span>
        <div className="pointer-events-none hidden group-hover:block absolute right-0 top-4 z-40 w-64 rounded-md border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-lg p-2">
          <p className="text-[10px] text-slate-700 dark:text-slate-200"><span className="font-semibold">General:</span> {generalExplanation}</p>
          <p className="text-[10px] text-slate-800 dark:text-slate-100 mt-1"><span className="font-semibold">Current:</span> {currentExplanation}</p>
        </div>
      </div>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300 font-semibold">{label}</p>
      </div>
      <p className={`text-xs font-semibold mt-1 ${valueClassName}`}>{value}</p>
    </div>
  )
}

function MonthlyComboChart({
  data,
}: {
  data: {
    month: string
    assigned: number
    completed: number
    onTimeCompleted: number
    lateCompleted: number
    overdueOpen: number
  }[]
}) {
  const chartWrapRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [tooltipState, setTooltipState] = useState<{
    left: number
    top: number
    label: string
    items: { name: string; value: string; color: string }[]
  } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const enrichedData = data.map(d => ({
    ...d,
    completionRate: d.assigned > 0 ? Math.round((d.completed / d.assigned) * 100) : null,
  }))
  const hasData = enrichedData.some(d =>
    d.assigned > 0 ||
    d.onTimeCompleted > 0 ||
    d.lateCompleted > 0 ||
    d.overdueOpen > 0
  )
  if (!hasData) return <p className="text-[10px] text-slate-600 dark:text-slate-300 italic">No task data</p>

  const activeIndexes = enrichedData
    .map((d, idx) => ({
      idx,
      active: d.assigned > 0 || d.onTimeCompleted > 0 || d.lateCompleted > 0 || d.overdueOpen > 0,
    }))
    .filter(x => x.active)
    .map(x => x.idx)

  const firstActive = activeIndexes[0] ?? 0
  const lastActive = activeIndexes[activeIndexes.length - 1] ?? (enrichedData.length - 1)
  const chartData = enrichedData.slice(firstActive, lastActive + 1).map((d, idx) => ({ ...d, idx }))
  const chartWidth = Math.max(chartData.length * 120, 520)
  const xEdgePad = chartData.length <= 2 ? 0.18 : 0.1
  const metricLabel: Record<string, string> = {
    assigned: 'Assigned',
    onTimeCompleted: 'Completed (On-time)',
    lateCompleted: 'Completed (Late)',
    overdueOpen: 'Overdue Open',
    completionRate: 'Completion Rate',
  }

  return (
    <div className="w-full overflow-visible">
      <div className="overflow-x-auto">
        <div ref={chartWrapRef} style={{ width: chartWidth, height: 136 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            barSize={8}
            margin={{ top: 4, right: 6, bottom: 0, left: 2 }}
            onMouseMove={(state: any) => {
              if (!state?.isTooltipActive || !chartWrapRef.current) {
                setTooltipState(null)
                return
              }

              const rect = chartWrapRef.current.getBoundingClientRect()
              const activePayload = Array.isArray(state.activePayload) ? state.activePayload : []
              const fallbackIndex = Number(state.activeTooltipIndex ?? -1)
              const fallbackPoint = fallbackIndex >= 0 ? chartData[fallbackIndex] : null

              const items = activePayload.length > 0
                ? activePayload
                    .filter((p: any) => p?.value !== null && p?.value !== undefined)
                    .map((p: any) => {
                      const key = String(p.dataKey ?? '')
                      const val = key === 'completionRate' ? `${p.value}%` : `${p.value}`
                      return {
                        name: metricLabel[key] ?? key,
                        value: val,
                        color: String(p.color ?? '#e2e8f0'),
                      }
                    })
                : (fallbackPoint ? [
                    { name: 'Assigned', value: String(fallbackPoint.assigned ?? 0), color: '#f59e0b' },
                    { name: 'Completed (On-time)', value: String(fallbackPoint.onTimeCompleted ?? 0), color: '#22c55e' },
                    { name: 'Completed (Late)', value: String(fallbackPoint.lateCompleted ?? 0), color: '#ef4444' },
                    { name: 'Overdue Open', value: String(fallbackPoint.overdueOpen ?? 0), color: '#0ea5e9' },
                    { name: 'Completion Rate', value: `${fallbackPoint.completionRate ?? 0}%`, color: '#64748b' },
                  ] : [])

              if (items.length === 0) {
                setTooltipState(null)
                return
              }

              const left = rect.left + (state.activeCoordinate?.x ?? 0) + 14
              const top = rect.top + (state.activeCoordinate?.y ?? 0) - 12
              const pointLabel =
                String(activePayload?.[0]?.payload?.month ?? fallbackPoint?.month ?? state.activeLabel ?? '')

              setTooltipState({
                left,
                top,
                label: pointLabel,
                items,
              })
            }}
            onMouseLeave={() => setTooltipState(null)}
          >
            <XAxis
              type="number"
              dataKey="idx"
              domain={[-xEdgePad, Math.max(0, chartData.length - 1) + xEdgePad]}
              ticks={chartData.map(d => d.idx)}
              tickFormatter={(v: number) => chartData[v]?.month ?? ''}
              tick={{ fontSize: 8, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              minTickGap={8}
            />
            <YAxis yAxisId="tasks" width={22} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis yAxisId="rate" width={24} orientation="right" domain={[0, 100]} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip content={() => null} cursor={false} />
            <Bar yAxisId="tasks" dataKey="assigned" name="Assigned" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="tasks" stackId="completed" dataKey="onTimeCompleted" name="Completed (On-time)" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="tasks" stackId="completed" dataKey="lateCompleted" name="Completed (Late)" fill="#ef4444" radius={[3, 3, 0, 0]} />
            <Line yAxisId="tasks" dataKey="overdueOpen" type="monotone" stroke="#0ea5e9" strokeWidth={1.5} dot={false} name="overdueOpen" />
            <Line yAxisId="rate" dataKey="completionRate" type="monotone" stroke="#64748b" strokeWidth={1.5} dot={false} name="completionRate" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      </div>
      <div className="mt-1 overflow-x-auto">
        <div className="inline-flex min-w-max items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 bg-amber-500 inline-block" />Assigned</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 bg-red-500 inline-block" />Completed (Late)</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 bg-green-500 inline-block" />Completed (On-time)</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-[2px] bg-slate-500" />Completion Rate</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-[2px] bg-sky-500" />Overdue Open</span>
        </div>
      </div>
      {mounted && tooltipState && createPortal(
        <div
          style={{
            position: 'fixed',
            left: `${Math.max(8, Math.min(window.innerWidth - 220, tooltipState.left))}px`,
            top: `${Math.max(8, tooltipState.top)}px`,
            transform: 'translateY(-100%)',
            zIndex: 9999,
            pointerEvents: 'none',
            minWidth: 180,
          }}
          className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs text-slate-200 shadow-2xl"
        >
          <div className="mb-1 font-semibold text-slate-100">{tooltipState.label}</div>
          <div className="space-y-1">
            {tooltipState.items.map((it, idx) => (
              <div key={`${it.name}-${idx}`} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-slate-300">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: it.color }} />
                  {it.name}
                </span>
                <span className="font-semibold text-slate-100">{it.value}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

type MonthlyTaskFlow = NonNullable<Project['monthlyData']>[number]

function recentTaskMonths(data: MonthlyTaskFlow[]) {
  if (data.length <= 4) return data

  const now = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`

  let endIndex = -1
  for (let i = data.length - 1; i >= 0; i -= 1) {
    if ((data[i].monthKey ?? '') <= prevMonthKey) {
      endIndex = i
      break
    }
  }

  // If project starts in current/future month, fall back to earliest 4 project months.
  if (endIndex < 0) endIndex = Math.min(data.length - 1, 3)

  const startIndex = Math.max(0, endIndex - 3)
  return data.slice(startIndex, endIndex + 1)
}

function TaskCompletionTable({ data }: { data: MonthlyTaskFlow[] }) {
  const months = recentTaskMonths(data)
  if (months.length === 0) {
    return <p className="text-[10px] text-slate-600 dark:text-slate-300 italic">No completion data</p>
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              {months.map(m => (
                <th
                  key={m.month}
                  className="border border-slate-200 dark:border-navy-700 first:rounded-tl-lg last:rounded-tr-lg bg-white dark:bg-navy-800 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                >
                  {m.month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {months.map((m, idx) => {
                const rate = m.assigned > 0 ? Math.round((m.completed / m.assigned) * 100) : null
                return (
                  <td
                    key={m.month}
                    className={`border-x border-b border-slate-200 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-900/40 px-2 py-2 ${idx === 0 ? 'rounded-bl-lg' : ''} ${idx === months.length - 1 ? 'rounded-br-lg' : ''}`}
                  >
                    <div className={`text-sm font-semibold ${
                      rate == null ? 'text-slate-600 dark:text-slate-300' :
                        rate >= 80 ? 'text-green-600 dark:text-green-400' :
                          rate >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-500 dark:text-red-400'
                    }`}>
                      {rate != null ? `${rate}%` : '-'}
                    </div>
                    <div className="mt-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                      {m.assigned}/{m.completed} completed
                    </div>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="relative group mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
        <span>Tasks Assigned vs Completion</span>
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-[10px] font-semibold text-slate-700 dark:text-slate-200 cursor-help"
          title="Assigned is tasks due in the month. Completed is tasks finished in the month. Completion Rate = completed / assigned. Net Flow = completed - assigned. Backlog Trend follows cumulative net flow. On-time Completion compares completed tasks against due dates."
        >
          ?
        </span>
        <div className="pointer-events-none hidden group-hover:block absolute left-0 top-5 z-40 w-80 rounded-md border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-lg p-2 text-[10px] leading-relaxed text-slate-700 dark:text-slate-200">
          <p><span className="font-semibold">Assigned:</span> tasks due in the month.</p>
          <p><span className="font-semibold">Completed:</span> tasks finished in the month.</p>
          <p className="mt-1"><span className="font-semibold">Completion Rate:</span> completed divided by assigned.</p>
          <p><span className="font-semibold">Net Flow:</span> completed minus assigned.</p>
          <p><span className="font-semibold">Backlog Trend:</span> whether cumulative net flow is shrinking, growing, or stable.</p>
          <p><span className="font-semibold">On-time Completion:</span> completed tasks finished on or before due date.</p>
        </div>
      </div>
    </div>
  )
}

// ── Projects List Tab ──────────────────────────────────────────────
function ProjectsTab({ onNewProject }: { onNewProject: () => void }) {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([])
  const [projectFilterOpen, setProjectFilterOpen] = useState(false)
  const projectFilterRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => { setProjects(d); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!projectFilterOpen) return
    function handleClick(e: MouseEvent) {
      if (projectFilterRef.current && !projectFilterRef.current.contains(e.target as Node)) {
        setProjectFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [projectFilterOpen])

  if (loading) return <p className="text-slate-400 py-8 text-center text-sm">Loading...</p>

  if (projects.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 text-sm mb-4">No projects yet.</p>
        <button onClick={onNewProject} className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold">
          + Create First Project
        </button>
      </div>
    )
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
  const fmtSignedPct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}%`
  const getPlannedProgress = (startDate: string, deadlineDate: string) => {
    const start = new Date(startDate)
    const deadline = new Date(deadlineDate)
    const totalMs = deadline.getTime() - start.getTime()
    if (totalMs <= 0) return 0

    const elapsedMs = now.getTime() - start.getTime()
    if (elapsedMs <= 0) return 0
    if (elapsedMs >= totalMs) return 100
    return Math.round((elapsedMs / totalMs) * 100)
  }
  const now = new Date()
  const selectedProjectSet = new Set(selectedProjectIds)
  const visibleProjects = selectedProjectIds.length === 0
    ? projects
    : projects.filter(p => selectedProjectSet.has(p.id))
  const filterLabel = selectedProjectIds.length === 0
    ? 'All projects'
    : `${selectedProjectIds.length} selected`

  function toggleProjectFilter(id: number) {
    setSelectedProjectIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div ref={projectFilterRef} className="relative">
            <button
              type="button"
              onClick={() => setProjectFilterOpen(v => !v)}
              className="min-w-[180px] max-w-[280px] bg-white dark:bg-navy-900 border border-slate-300 dark:border-navy-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between gap-3"
              aria-haspopup="listbox"
              aria-expanded={projectFilterOpen}
            >
              <span className="truncate">{filterLabel}</span>
              <span className="text-slate-400 dark:text-slate-500">▾</span>
            </button>
            {projectFilterOpen && (
              <div className="absolute left-0 top-9 z-40 w-72 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl py-1 max-h-80 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedProjectIds([])}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700"
                >
                  <input type="checkbox" readOnly checked={selectedProjectIds.length === 0} className="rounded accent-blue-600" />
                  <span className="font-medium">All projects</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-navy-700" />
                {projects.map(p => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.includes(p.id)}
                      onChange={() => toggleProjectFilter(p.id)}
                      className="rounded accent-blue-600 shrink-0"
                    />
                    <span className="truncate">{p.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
            Showing {visibleProjects.length}/{projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={onNewProject} className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold">
          + New Project
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-x-hidden overflow-y-visible">
        {/* Table header */}
        <div className="grid bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500"
          style={{ gridTemplateColumns: '2fr 1fr 160px 72px 1fr 100px 110px 60px 72px' }}>
          <span>Project</span>
          <span>Status</span>
          <span>Progress</span>
          <span>SV</span>
          <span>Team</span>
          <span>Start</span>
          <span>Deadline</span>
          <span>Issues</span>
          <span></span>
        </div>

        {/* Rows */}
        {visibleProjects.map((p, i) => {
          const deadline = new Date(p.deadline)
          const progress = p.computedProgress ?? 0
          const plannedProgress = getPlannedProgress(p.start_date, p.deadline)
          const scheduleVariance = progress - plannedProgress
          const flowData = p.monthlyData ?? []
          const totalAssigned = flowData.reduce((sum, m) => sum + (m.assigned ?? 0), 0)
          const totalCompleted = flowData.reduce((sum, m) => sum + (m.completed ?? 0), 0)
          // Use server-computed completionRate (done/total) which handles old projects correctly
          const completionRate = p.completionRate ?? (totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : null)
          const netFlow = totalCompleted - totalAssigned
          const backlogTrend = netFlow > 0 ? 'Shrinking' : netFlow < 0 ? 'Growing' : 'Stable'
          const overdue = p.computedStatus !== 'Done' && deadline < now
          const latestOverdueOpen = flowData.length > 0 ? (flowData[flowData.length - 1].overdueOpen ?? 0) : 0
          const displayHealthStatus: 'on_track' | 'at_risk' | 'delayed' | 'overdue' | null = (
            p.computedHealthStatus ?? (
              p.computedStatus === 'Done'
                ? null
                : overdue
                  ? 'overdue'
                  : (scheduleVariance <= -20 || latestOverdueOpen >= 3)
                    ? 'delayed'
                    : (
                      scheduleVariance <= -5 ||
                      netFlow < 0 ||
                      latestOverdueOpen > 0 ||
                      (completionRate !== null && completionRate < 80)
                    )
                      ? 'at_risk'
                      : 'on_track'
            )
          )
          const isLast = i === visibleProjects.length - 1

          return (
            <div
              key={p.id}
              className={`${!isLast ? 'border-b border-slate-100 dark:border-navy-700' : ''}`}
            >
              <div
                className="grid items-center px-4 py-3 gap-3 hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors"
                style={{ gridTemplateColumns: '2fr 1fr 160px 72px 1fr 100px 110px 60px 72px' }}
              >
                {/* Project title + description */}
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white truncate leading-snug">{p.title}</p>
                  {p.description && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{p.description}</p>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-start">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLOR[p.computedStatus] ?? STATUS_COLOR.Pending}`}>
                    {STATUS_LABEL[p.computedStatus] ?? p.computedStatus}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-slate-400">{progress}%</span>
                    {overdue && <span className="text-red-400 font-medium text-[10px]">Overdue</span>}
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${overdue ? 'bg-red-500' : progress >= 100 ? 'bg-green-500' : 'bg-primary'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Schedule variance */}
                <div className="text-xs font-semibold">
                  <span className={
                    scheduleVariance > 0
                      ? 'text-green-600 dark:text-green-400'
                      : scheduleVariance < 0
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-slate-500 dark:text-slate-400'
                  }>
                    {fmtSignedPct(scheduleVariance)}
                  </span>
                </div>

                {/* Team avatars */}
                <div className="flex -space-x-1.5">
                  {p.assignees.slice(0, 5).map(a => (
                    <div
                      key={a.user.id}
                      title={a.user.name}
                      className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-navy-800 shrink-0"
                    >
                      {a.user.name[0].toUpperCase()}
                    </div>
                  ))}
                  {p.assignees.length > 5 && (
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-600 text-slate-500 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-navy-800 shrink-0">
                      +{p.assignees.length - 5}
                    </div>
                  )}
                  {p.assignees.length === 0 && (
                    <span className="text-xs text-slate-300 dark:text-slate-600 italic">—</span>
                  )}
                </div>

                {/* Start date */}
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{fmtDate(p.start_date)}</span>

                {/* Deadline */}
                <span className={`text-xs whitespace-nowrap font-medium ${overdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                  {fmtDate(p.deadline)}
                </span>

                {/* Issues */}
                <div>
                  {p._count.issues > 0 ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
                      <span>⚠</span>{p._count.issues}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                  )}
                </div>

                {/* Action */}
                <button
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  View
                </button>
              </div>

              <div className="px-4 pb-3">
                <div className="rounded-lg border border-slate-100 dark:border-navy-700 bg-slate-50/80 dark:bg-navy-900/50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-3 text-xs mb-2">
                    <span className="text-slate-700 dark:text-slate-200 uppercase tracking-wide font-semibold">Project Performance</span>
                    {displayHealthStatus && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                        displayHealthStatus === 'on_track' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        displayHealthStatus === 'at_risk' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        displayHealthStatus === 'delayed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                      }`}>
                        {displayHealthStatus === 'on_track' ? '🟢 On Track' :
                         displayHealthStatus === 'at_risk' ? '🟡 At Risk' :
                         displayHealthStatus === 'delayed' ? '🔴 Delayed' : '⚫ Overdue'}
                      </span>
                    )}
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      Planned {plannedProgress}% vs Actual {progress}% (SV {fmtSignedPct(scheduleVariance)})
                    </span>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px] items-start">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)] min-w-0">
                      <div className="min-w-0">
                        <div className="relative group mb-1 inline-flex items-center gap-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300 font-semibold">Burndown Chart</p>
                          <span
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-[10px] font-semibold text-slate-700 dark:text-slate-200 cursor-help"
                            title="Burndown measures remaining tasks over time from project start to deadline. Ideal is a straight line from total tasks to zero. Actual uses real task completion dates."
                          >
                            ?
                          </span>
                          <div className="pointer-events-none hidden group-hover:block absolute left-0 top-5 z-40 w-80 rounded-md border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-lg p-2 text-[10px] leading-relaxed text-slate-700 dark:text-slate-200">
                            <p><span className="font-semibold">Remaining:</span> total tasks minus tasks completed by each date.</p>
                            <p><span className="font-semibold">Ideal:</span> straight-line target from total tasks to zero by deadline.</p>
                            <p><span className="font-semibold">Actual:</span> calculated from each done task's actual completion date.</p>
                            <p className="mt-1"><span className="font-semibold">Reading:</span> actual above ideal means behind schedule; at/below ideal means on track or faster.</p>
                          </div>
                        </div>
                        <BurndownChart
                          tasks={p.burndownTasks ?? []}
                          projectStart={p.start_date}
                          projectDeadline={p.deadline}
                          compact
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-300 font-semibold mb-1">Task Completion - Last 4 Months</p>
                        <TaskCompletionTable data={flowData} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                      <KPIInfoCard
                        label="Completion Rate"
                        value={completionRate != null ? `${completionRate}%` : '—'}
                        valueClassName={
                          completionRate == null
                            ? 'text-slate-700 dark:text-slate-200'
                            : completionRate >= 80
                              ? 'text-green-700 dark:text-green-300'
                              : completionRate >= 50
                                ? 'text-yellow-700 dark:text-yellow-300'
                                : 'text-red-600 dark:text-red-300'
                        }
                        tone={
                          completionRate == null
                            ? 'neutral'
                            : completionRate >= 80
                              ? 'good'
                              : completionRate >= 50
                                ? 'warning'
                                : 'danger'
                        }
                        generalExplanation="Completed tasks as a percentage of assigned tasks. Higher means better delivery throughput."
                        currentExplanation={
                          completionRate == null ? 'No assigned tasks yet.' :
                            completionRate >= 100 ? 'All assigned tasks have been completed.' :
                            completionRate >= 80 ? 'Healthy throughput with manageable carry-over.' :
                            'Completion is lagging behind assignment; backlog risk is increasing.'
                        }
                      />
                      <KPIInfoCard
                        label="Net Flow"
                        value={`${netFlow > 0 ? '+' : ''}${netFlow}`}
                        valueClassName={netFlow > 0 ? 'text-green-600 dark:text-green-400' : netFlow < 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}
                        tone={netFlow > 0 ? 'good' : netFlow < 0 ? 'danger' : 'neutral'}
                        generalExplanation="Completed minus assigned tasks. Positive means backlog is shrinking; negative means it is growing."
                        currentExplanation={
                          netFlow > 0 ? 'Team is burning down backlog faster than new scope arrives.' :
                            netFlow < 0 ? 'New scope is arriving faster than completion.' :
                            'Flow is balanced; backlog size is stable.'
                        }
                      />
                      <KPIInfoCard
                        label="Backlog Trend"
                        value={backlogTrend}
                        valueClassName={backlogTrend === 'Shrinking' ? 'text-green-600 dark:text-green-400' : backlogTrend === 'Growing' ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}
                        tone={backlogTrend === 'Shrinking' ? 'good' : backlogTrend === 'Growing' ? 'danger' : 'neutral'}
                        generalExplanation="Direction of outstanding work based on cumulative net flow over time."
                        currentExplanation={
                          backlogTrend === 'Shrinking' ? 'Outstanding tasks are trending down.' :
                            backlogTrend === 'Growing' ? 'Outstanding tasks are trending up and need intervention.' :
                            'Outstanding tasks are roughly flat.'
                        }
                      />
                      <KPIInfoCard
                        label="On-time Completion"
                        value={p.onTimeCompletionRate != null ? `${p.onTimeCompletionRate}%` : '—'}
                        valueClassName={
                          (p.onTimeCompletionRate ?? -1) >= 90
                            ? 'text-green-600 dark:text-green-400'
                            : (p.onTimeCompletionRate ?? -1) >= 75
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-500 dark:text-red-400'
                        }
                        tone={
                          p.onTimeCompletionRate == null
                            ? 'neutral'
                            : p.onTimeCompletionRate >= 90
                              ? 'good'
                              : p.onTimeCompletionRate >= 75
                                ? 'warning'
                                : 'danger'
                        }
                        generalExplanation="Share of completed tasks finished on or before due date."
                        currentExplanation={
                          p.onTimeCompletionRate == null ? 'No completed tasks with due-date timing yet.' :
                            p.onTimeCompletionRate >= 90 ? 'Delivery timing is very reliable.' :
                            p.onTimeCompletionRate >= 75 ? 'Timing is acceptable but has slippage risk.' :
                            'Frequent late completions; schedule control needs attention.'
                        }
                      />
                      <KPIInfoCard
                        label="Scope Volatility"
                        value={p.scopeVolatility != null ? `${p.scopeVolatility}%` : '—'}
                        valueClassName={
                          (p.scopeVolatility ?? 0) <= 15
                            ? 'text-green-600 dark:text-green-400'
                            : (p.scopeVolatility ?? 0) <= 30
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-500 dark:text-red-400'
                        }
                        tone={
                          p.scopeVolatility == null
                            ? 'neutral'
                            : p.scopeVolatility <= 15
                              ? 'good'
                              : p.scopeVolatility <= 30
                                ? 'warning'
                                : 'danger'
                        }
                        generalExplanation="Percentage of tasks added after the first 14 days of project baseline."
                        currentExplanation={
                          p.scopeVolatility == null ? 'No task baseline yet to measure scope change.' :
                            p.scopeVolatility <= 15 ? 'Scope is stable and predictable.' :
                            p.scopeVolatility <= 30 ? 'Moderate scope drift; monitor planning closely.' :
                            'High scope churn; likely impact to schedule and flow.'
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── New Project Tab ────────────────────────────────────────────────
function NewProjectTab({
  showToast, onCreated,
}: {
  showToast: (t: 'success' | 'error', m: string) => void
  onCreated: () => void
}) {
  const [members, setMembers] = useState<any[]>([])
  const [form, setForm] = useState({
    title: '', description: '', assignee_ids: [] as number[],
    start_date: '', deadline: '', status: 'Pending', category: 'NonClaimable',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/users?include_managers=true').then(r => r.json()).then(setMembers)
  }, [])

  function toggleAssignee(id: number) {
    setForm(prev => ({
      ...prev,
      assignee_ids: prev.assignee_ids.includes(id)
        ? prev.assignee_ids.filter(x => x !== id)
        : [...prev.assignee_ids, id],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.assignee_ids.length === 0) { setError('Please select at least one assignee.'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      showToast('success', 'Project created')
      setForm({ title: '', description: '', assignee_ids: [], start_date: '', deadline: '', status: 'Pending', category: 'NonClaimable' })
      onCreated()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to create project')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className={labelClass}>Project Title *</label>
            <input type="text" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={`${inputClass} h-24 resize-none`} />
          </div>
          <div>
            <label className={labelClass}>Assignees *</label>
            <div className="rounded-lg border border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 divide-y divide-slate-200 dark:divide-navy-700">
              {members.map(m => (
                <label key={m.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.assignee_ids.includes(m.id)}
                    onChange={() => toggleAssignee(m.id)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-800 dark:text-slate-200">{m.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{m.email}</span>
                </label>
              ))}
              {members.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">No members available.</p>}
            </div>
            {form.assignee_ids.length > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">{form.assignee_ids.length} assignee(s) selected</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Date *</label>
              <input type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Deadline *</label>
              <input type="date" required value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Initial Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputClass}>
                <option value="Pending">Pending</option>
                <option value="InProgress">In Progress</option>
                <option value="Done">Done</option>
                <option value="OnHold">On Hold</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Project Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputClass}>
                <option value="Claimable">Claimable / External</option>
                <option value="NonClaimable">Non-claimable / Internal</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Features Tab ──────────────────────────────────────────────────
function FeaturesTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', mandays: '1' })

  useEffect(() => {
    setLoading(true)
    fetch('/api/features').then(r => r.json()).then(data => { setFeatures(Array.isArray(data) ? data : []); setLoading(false) })
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/features', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title, description: form.description || null, mandays: Number(form.mandays),
      }),
    })
    setSaving(false)
    if (res.ok) {
      const fresh = await fetch('/api/features').then(r => r.json())
      setFeatures(Array.isArray(fresh) ? fresh : [])
      setForm({ title: '', description: '', mandays: '1' })
      setShowForm(false)
      showToast('success', 'Feature created')
    } else {
      showToast('error', (await res.json()).error || 'Failed to create feature')
    }
  }

  const featureStatusColor: Record<string, string> = {
    Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    OnHold: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={() => setShowForm(v => !v)} className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold">
          + New Feature
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-5 mb-5">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm">New Feature</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className={labelClass}>Title *</label>
              <input required className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea className={`${inputClass} resize-none`} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Estimated Mandays</label>
              <input type="number" min="1" className={inputClass} value={form.mandays} onChange={e => setForm(f => ({ ...f, mandays: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? 'Saving...' : 'Add Feature'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && <p className="text-slate-400 text-sm py-8 text-center">Loading...</p>}
      {!loading && features.length === 0 && <p className="text-slate-400 text-sm py-8 text-center">No features yet.</p>}
      {!loading && features.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden bg-white dark:bg-navy-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Feature</th>
                <th className="text-left px-5 py-3 font-medium">Linked Projects</th>
                <th className="text-left px-5 py-3 font-medium">Mandays</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {features.map(f => (
                <tr key={f.id} className="border-b border-slate-100 dark:border-navy-700 last:border-0 hover:bg-slate-50 dark:hover:bg-navy-700">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{f.title}</p>
                    {f.description && <p className="text-xs text-slate-400 truncate max-w-xs">{f.description}</p>}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {f.project_links && f.project_links.length > 0
                      ? f.project_links.map(l => l.project.title).join(', ')
                      : <span className="italic text-slate-300 dark:text-slate-600">Unlinked</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs">{f.mandays}d</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${featureStatusColor[f.status] ?? featureStatusColor.Pending}`}>{f.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Deliverables Tab ──────────────────────────────────────────────
const DELIV_TYPES = ['database', 'backend', 'frontend', 'testing', 'documentation'] as const
type DelivType = typeof DELIV_TYPES[number]

type TaskDraft = { name: string; est_mandays: string }
type DelivDraft = { name: string; type: DelivType; tasks: TaskDraft[] }

function DeliverablesTab({ showToast }: { showToast: (t: 'success' | 'error', m: string) => void }) {
  const [templates, setTemplates] = useState<ModuleTemplate[]>([])
  const [loading, setLoading] = useState(false)

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplIcon, setTplIcon] = useState('')
  const [tplDesc, setTplDesc] = useState('')
  const [delivDrafts, setDelivDrafts] = useState<DelivDraft[]>([
    { name: '', type: 'frontend', tasks: [] },
  ])

  // Edit template metadata
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // Task actions within edit mode
  const [taskActionMenuId, setTaskActionMenuId] = useState<number | null>(null)
  const [taskEditModal, setTaskEditModal] = useState<{ id: number; name: string; md: string } | null>(null)
  const [addTaskModal, setAddTaskModal] = useState<{ deliverableId: number; deliverableName: string } | null>(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskMd, setNewTaskMd] = useState('')
  const [taskSaving, setTaskSaving] = useState(false)
  const [draftTaskModal, setDraftTaskModal] = useState<{ draftIndex: number; categoryName: string } | null>(null)
  const [draftTaskName, setDraftTaskName] = useState('')
  const [draftTaskMd, setDraftTaskMd] = useState('')

  function fetchTemplates() {
    setLoading(true)
    fetch('/api/module-templates').then(r => r.json()).then(data => {
      const list: ModuleTemplate[] = Array.isArray(data) ? data : []
      setTemplates(list)
      setLoading(false)
    })
  }

  useEffect(() => { fetchTemplates() }, [])

  // ── Deliverable drafts helpers ────────────────────────────────
  function addDelivRow() {
    setDelivDrafts(prev => [...prev, { name: '', type: 'frontend', tasks: [] }])
  }
  function removeDelivRow(i: number) {
    setDelivDrafts(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateDeliv(i: number, patch: Partial<DelivDraft>) {
    setDelivDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d))
  }
  function removeTaskRow(di: number, ti: number) {
    setDelivDrafts(prev => prev.map((d, idx) => idx === di
      ? { ...d, tasks: d.tasks.filter((_, j) => j !== ti) }
      : d))
  }

  // ── Create ────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!tplName.trim()) return
    setSaving(true)
    const res = await fetch('/api/module-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: tplName,
        icon: tplIcon || null,
        description: tplDesc || null,
        deliverables: delivDrafts.filter(d => d.name.trim()).map(d => ({
          name: d.name.trim(),
          type: d.type,
          tasks: d.tasks.filter(t => t.name.trim()).map(t => ({
            name: t.name.trim(),
            est_mandays: t.est_mandays ? Number(t.est_mandays) : null,
          })),
        })),
      }),
    })
    setSaving(false)
    if (res.ok) {
      setShowForm(false)
      setTplName(''); setTplIcon(''); setTplDesc('')
      setDelivDrafts([{ name: '', type: 'frontend', tasks: [] }])
      fetchTemplates()
      showToast('success', 'Template created')
    } else {
      showToast('error', (await res.json()).error || 'Failed to create')
    }
  }

  // ── Edit (name/icon/desc only) ────────────────────────────────
  function openEdit(tpl: ModuleTemplate) {
    setEditingId(tpl.id)
    setEditName(tpl.display_name)
    setEditIcon(tpl.icon ?? '')
    setEditDesc(tpl.description ?? '')
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim() || editingId == null) return
    setSaving(true)
    const res = await fetch(`/api/module-templates/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: editName, icon: editIcon || null, description: editDesc || null }),
    })
    setSaving(false)
    if (res.ok) {
      setEditingId(null)
      fetchTemplates()
      showToast('success', 'Template updated')
    } else {
      showToast('error', 'Failed to update')
    }
  }

  // ── Task CRUD (within edit mode) ─────────────────────────────
  function startEditTask(task: TemplateTask) {
    setTaskActionMenuId(null)
    setTaskEditModal({
      id: task.id,
      name: task.name,
      md: task.est_mandays != null ? String(task.est_mandays) : '',
    })
  }

  async function saveTaskEdit(taskId: number) {
    setTaskSaving(true)
    const res = await fetch(`/api/template-tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: taskEditModal?.name ?? '',
        est_mandays: taskEditModal && taskEditModal.md !== '' ? Number(taskEditModal.md) : null,
      }),
    })
    setTaskSaving(false)
    if (res.ok) { setTaskEditModal(null); fetchTemplates() }
    else showToast('error', 'Failed to update task')
  }

  async function deleteTask(taskId: number) {
    if (!confirm('Delete this task?')) return
    const res = await fetch(`/api/template-tasks/${taskId}`, { method: 'DELETE' })
    if (res.ok) fetchTemplates()
    else showToast('error', 'Failed to delete task')
  }

  async function addTask(delivId: number) {
    if (!newTaskName.trim()) return
    setTaskSaving(true)
    const res = await fetch('/api/template-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_deliverable_id: delivId, name: newTaskName, est_mandays: newTaskMd !== '' ? Number(newTaskMd) : null }),
    })
    setTaskSaving(false)
    if (res.ok) { setAddTaskModal(null); setNewTaskName(''); setNewTaskMd(''); fetchTemplates() }
    else showToast('error', 'Failed to add task')
  }

  function addDraftTask(draftIndex: number) {
    if (!draftTaskName.trim()) return
    setDelivDrafts(prev => prev.map((d, idx) => idx === draftIndex
      ? {
        ...d,
        tasks: [
          ...d.tasks,
          { name: draftTaskName.trim(), est_mandays: draftTaskMd.trim() },
        ],
      }
      : d))
    setDraftTaskModal(null)
    setDraftTaskName('')
    setDraftTaskMd('')
  }

  // ── Delete ────────────────────────────────────────────────────
  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete template "${name}"? This will remove all its deliverables and tasks.`)) return
    const res = await fetch(`/api/module-templates/${id}`, { method: 'DELETE' })
    if (res.ok) { fetchTemplates(); showToast('success', 'Deleted') }
    else showToast('error', 'Failed to delete')
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400 flex-1">
          Template library with pre-defined task categories and tasks.
        </p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="btn-primary px-4 py-1.5 rounded-lg text-sm font-semibold"
        >
          + New Template
        </button>
      </div>

      {/* ── Create form ── */}
      {showForm && (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-5 mb-5 space-y-4">
          <h3 className="font-semibold text-slate-800 dark:text-white text-sm">New Template</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Icon (emoji)</label>
                <input className={inputClass} value={tplIcon} onChange={e => setTplIcon(e.target.value)} placeholder="📦" maxLength={4} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Template Name *</label>
                <input required className={inputClass} value={tplName} onChange={e => setTplName(e.target.value)} placeholder="e.g. Simple CRUD" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input className={inputClass} value={tplDesc} onChange={e => setTplDesc(e.target.value)} placeholder="Optional description" />
            </div>

            {/* Deliverables */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass}>Task Categories</label>
                <button type="button" onClick={addDelivRow} className="text-xs text-blue-500 hover:text-blue-700">+ Add category</button>
              </div>
              <div className="space-y-3">
                {delivDrafts.map((d, di) => (
                  <div key={di} className="rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 p-3 space-y-2">
                    <div className="flex gap-2">
                      <select
                        className={`${inputClass} w-36 shrink-0`}
                        value={d.type}
                        onChange={e => updateDeliv(di, { type: e.target.value as DelivType })}
                      >
                        {DELIV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        className={inputClass}
                        value={d.name}
                        onChange={e => updateDeliv(di, { name: e.target.value })}
                        placeholder="Task category name, e.g. Backend API"
                      />
                      <button type="button" onClick={() => removeDelivRow(di)} className="text-red-400 hover:text-red-600 text-xs shrink-0 px-1">✕</button>
                    </div>
                    <div className="ml-2 space-y-2">
                      {d.tasks.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {d.tasks.map((t, ti) => (
                            <span
                              key={ti}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 text-xs text-slate-700 dark:text-slate-300"
                            >
                              <span>{t.name}</span>
                              <span className="text-slate-400">{t.est_mandays ? `expected ${t.est_mandays} md` : 'expected —'}</span>
                              <button
                                type="button"
                                onClick={() => removeTaskRow(di, ti)}
                                className="text-slate-400 hover:text-red-500"
                                aria-label="Remove draft task"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setDraftTaskModal({ draftIndex: di, categoryName: d.name || `Category ${di + 1}` })}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        + Add task
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? 'Saving...' : 'Create Template'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Edit form ── */}
      {editingId != null && (() => {
        const editingTpl = templates.find(t => t.id === editingId)
        return (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5 mb-5 space-y-4">
            <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Edit Template</h3>

            {/* Metadata */}
            <form onSubmit={handleEdit} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Icon</label>
                  <input className={inputClass} value={editIcon} onChange={e => setEditIcon(e.target.value)} placeholder="📦" maxLength={4} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Name *</label>
                  <input required className={inputClass} value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <input className={inputClass} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => { setEditingId(null); setTaskEditModal(null); setTaskActionMenuId(null); setAddTaskModal(null) }} className="px-5 py-2 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg">
                  Cancel
                </button>
              </div>
            </form>

            {/* Deliverables + tasks editor */}
            {editingTpl && editingTpl.deliverables.length > 0 && (
              <div className="space-y-3 pt-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Task Categories & Tasks</p>
                {editingTpl.deliverables.map(d => (
                  <div key={d.id} className="rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 overflow-hidden">
                    {/* Deliverable header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-navy-700">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[d.type] ?? TYPE_BADGE.frontend}`}>{d.type}</span>
                      <span className="text-sm font-medium text-slate-800 dark:text-white flex-1">{d.name}</span>
                      <button
                        type="button"
                        onClick={() => { setAddTaskModal({ deliverableId: d.id, deliverableName: d.name }); setNewTaskName(''); setNewTaskMd('') }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        + Add task
                      </button>
                    </div>

                    {/* Task badges */}
                    <div className="p-3 border-t border-slate-100 dark:border-navy-700">
                      {d.tasks.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {d.tasks.map(task => (
                            <div key={task.id} className="relative group">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-900 text-xs text-slate-700 dark:text-slate-300">
                                <span>{task.name}</span>
                                <span className="text-slate-400">{task.est_mandays != null ? `${task.est_mandays} md` : '—'}</span>
                                <button
                                  type="button"
                                  className="ml-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => setTaskActionMenuId(prev => prev === task.id ? null : task.id)}
                                  aria-label="Task options"
                                >
                                  ⋯
                                </button>
                              </span>
                              {taskActionMenuId === task.id && (
                                <div className="absolute right-0 top-8 z-20 w-28 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-lg py-1">
                                  <button
                                    type="button"
                                    onClick={() => startEditTask(task)}
                                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700"
                                  >
                                    Update
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setTaskActionMenuId(null); deleteTask(task.id) }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No tasks — click "+ Add task" to add one.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {loading && <p className="text-slate-400 text-sm py-8 text-center">Loading...</p>}
      {!loading && templates.length === 0 && (
        <p className="text-slate-400 text-sm py-8 text-center">No task category templates yet.</p>
      )}
      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map(tpl => {
            const totalTasks = tpl.deliverables.reduce((s, d) => s + d.tasks.length, 0)
            return (
              <div key={tpl.id} className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
                {/* Template header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl leading-none">{tpl.icon ?? '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{tpl.display_name}</p>
                      {tpl.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{tpl.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {tpl.deliverables.length} {tpl.deliverables.length === 1 ? 'category' : 'categories'} · {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(tpl)} className="text-xs px-2 py-1 border border-slate-200 dark:border-navy-600 rounded hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-600 dark:text-slate-300">Edit</button>
                    <button onClick={() => handleDelete(tpl.id, tpl.display_name)} className="text-xs px-2 py-1 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">Delete</button>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-navy-700 p-4 space-y-3">
                  <div className="space-y-2">
                    {tpl.deliverables.map(d => (
                      <div
                        key={d.id}
                        className="rounded-lg border border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/30 p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[d.type] ?? TYPE_BADGE.frontend}`}>
                            {d.type}
                          </span>
                          <span className="text-sm font-medium text-slate-800 dark:text-white flex-1">{d.name}</span>
                          <button
                            type="button"
                            onClick={() => { setAddTaskModal({ deliverableId: d.id, deliverableName: d.name }); setNewTaskName(''); setNewTaskMd('') }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            + Add task
                          </button>
                        </div>

                        {d.tasks.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {d.tasks.map(task => (
                              <div key={task.id} className="relative group">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 text-xs text-slate-700 dark:text-slate-200">
                                  <span>{task.name}</span>
                                  <span className="text-slate-400">
                                    expected {task.est_mandays != null ? `${task.est_mandays} md` : '—'}
                                  </span>
                                  <button
                                    type="button"
                                    className="ml-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setTaskActionMenuId(prev => prev === task.id ? null : task.id)}
                                    aria-label="Task options"
                                  >
                                    ⋯
                                  </button>
                                </span>
                                {taskActionMenuId === task.id && (
                                  <div className="absolute right-0 top-8 z-20 w-28 rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-lg py-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditTask(task)}
                                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700"
                                    >
                                      Update
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setTaskActionMenuId(null); deleteTask(task.id) }}
                                      className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No tasks in this category.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {addTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl p-5">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Add Task</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Category: <span className="font-medium text-slate-700 dark:text-slate-300">{addTaskModal.deliverableName}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Task Name *</label>
                <input
                  className={inputClass}
                  value={newTaskName}
                  onChange={e => setNewTaskName(e.target.value)}
                  placeholder="e.g. Implement list endpoint"
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>Expected Mandays</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  className={inputClass}
                  value={newTaskMd}
                  onChange={e => setNewTaskMd(e.target.value)}
                  placeholder="e.g. 1.5"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setAddTaskModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => addTask(addTaskModal.deliverableId)}
                disabled={taskSaving || !newTaskName.trim()}
                className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {taskSaving ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {taskEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl p-5">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Update Task</h4>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Task Name *</label>
                <input
                  className={inputClass}
                  value={taskEditModal.name}
                  onChange={e => setTaskEditModal(prev => prev ? { ...prev, name: e.target.value } : prev)}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>Expected Mandays</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  className={inputClass}
                  value={taskEditModal.md}
                  onChange={e => setTaskEditModal(prev => prev ? { ...prev, md: e.target.value } : prev)}
                  placeholder="e.g. 1.5"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setTaskEditModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveTaskEdit(taskEditModal.id)}
                disabled={taskSaving || !taskEditModal.name.trim()}
                className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {taskSaving ? 'Saving...' : 'Update Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {draftTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-xl p-5">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Add Task</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Category: <span className="font-medium text-slate-700 dark:text-slate-300">{draftTaskModal.categoryName}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Task Name *</label>
                <input
                  className={inputClass}
                  value={draftTaskName}
                  onChange={e => setDraftTaskName(e.target.value)}
                  placeholder="e.g. Implement list endpoint"
                  autoFocus
                />
              </div>
              <div>
                <label className={labelClass}>Expected Mandays</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  className={inputClass}
                  value={draftTaskMd}
                  onChange={e => setDraftTaskMd(e.target.value)}
                  placeholder="e.g. 1.5"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setDraftTaskModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => addDraftTask(draftTaskModal.draftIndex)}
                disabled={!draftTaskName.trim()}
                className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('Projects')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const visibleTabs = TABS

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.replace('/dashboard')
  }, [session, status, router])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  return (
    <AppLayout>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Projects</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage projects and features</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-navy-700">
        {visibleTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Projects' && <ProjectsTab onNewProject={() => setActiveTab('New Project')} />}
      {activeTab === 'New Project' && <NewProjectTab showToast={showToast} onCreated={() => setActiveTab('Projects')} />}
      {activeTab === 'Features' && <FeaturesTab showToast={showToast} />}
      {activeTab === 'Task Categories' && <DeliverablesTab showToast={showToast} />}
    </AppLayout>
  )
}
