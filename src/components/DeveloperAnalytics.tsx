'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { X, ArrowRightLeft } from 'lucide-react'

interface DeveloperStat {
  id: number
  name: string
  email: string
  tasksAssigned: number
  tasksDone: number
  tasksInProgress: number
  estimatedMandays: number
  totalSpentDays: number
  weeklyTasksTrend: { week: string; count: number }[]
  weeklyCompletedTrend: { week: string; count: number }[]
  weeklyTimeTrend: { week: string; hours: number }[]
}

interface AssigneeTask {
  id: number
  title: string
  status: string
  priority: string
  est_mandays: number | null
  due_date: string | null
  assignees: { user: { id: number; name: string } }[]
  deliverable: { id: number; title: string } | null
  feature: { id: number; title: string } | null
}

interface Props {
  initialData?: DeveloperStat[]
  projectId?: number
}

const DEV_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#14b8a6']

function lighten(hex: string) { return hex + '55' }

const STATUS_LABEL: Record<string, string> = {
  Todo: 'Todo', InProgress: 'In Progress', InReview: 'In Review', Blocked: 'Blocked',
}
const STATUS_COLOR: Record<string, string> = {
  Todo: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  InReview: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Blocked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}
const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-600', high: 'text-orange-500', medium: 'text-blue-500', low: 'text-slate-400',
}

// ── Reassign Modal ─────────────────────────────────────────────────────────────
function ReassignModal({
  dev,
  allDevs,
  projectId,
  onClose,
  onDone,
}: {
  dev: DeveloperStat
  allDevs: DeveloperStat[]
  projectId?: number
  onClose: () => void
  onDone: () => void
}) {
  const [tasks, setTasks] = useState<AssigneeTask[]>([])
  const [loading, setLoading] = useState(true)
  const [reassigning, setReassigning] = useState<number | null>(null)
  const [toUserId, setToUserId] = useState<Record<number, string>>({})
  const others = allDevs.filter(d => d.id !== dev.id)

  useEffect(() => {
    const url = projectId
      ? `/api/tasks/by-assignee?user_id=${dev.id}&project_id=${projectId}`
      : `/api/tasks/by-assignee?user_id=${dev.id}`
    fetch(url)
      .then(r => r.json())
      .then(data => { setTasks(Array.isArray(data) ? data : []); setLoading(false) })
  }, [dev.id, projectId])

  async function reassign(taskId: number) {
    const targetId = toUserId[taskId]
    if (!targetId) return
    setReassigning(taskId)
    // Keep existing assignees, replace this dev with new one
    const task = tasks.find(t => t.id === taskId)!
    const currentIds = task.assignees.map(a => a.user.id).filter(id => id !== dev.id)
    const newIds = [...currentIds, Number(targetId)]
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignee_ids: newIds }),
    })
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setReassigning(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-xl bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-navy-700 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-navy-700 shrink-0">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-500" />
              Reassign Tasks — {dev.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Active (non-completed) tasks{projectId ? ' in this project' : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No active tasks assigned to {dev.name}{projectId ? ' in this project' : ''}.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <div key={task.id} className="rounded-lg border border-slate-200 dark:border-navy-700 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{task.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLOR[task.status] ?? STATUS_COLOR.Todo}`}>
                          {STATUS_LABEL[task.status] ?? task.status}
                        </span>
                        <span className={`text-[10px] font-medium ${PRIORITY_COLOR[task.priority] ?? ''}`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {task.deliverable?.title ?? task.feature?.title ?? '—'}
                        {task.est_mandays != null && ` · ${task.est_mandays} md`}
                      </p>
                    </div>
                  </div>
                  {/* Reassign row */}
                  {others.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={toUserId[task.id] ?? ''}
                        onChange={e => setToUserId(p => ({ ...p, [task.id]: e.target.value }))}
                        className="flex-1 text-xs bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300"
                      >
                        <option value="">Move to…</option>
                        {others.map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.tasksAssigned - d.tasksDone} active)</option>
                        ))}
                      </select>
                      <button
                        onClick={() => reassign(task.id)}
                        disabled={!toUserId[task.id] || reassigning === task.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                      >
                        {reassigning === task.id ? (
                          <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ArrowRightLeft className="w-3 h-3" />
                        )}
                        Move
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-navy-700 shrink-0 flex justify-end">
          <button onClick={() => { onDone(); onClose() }} className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-600">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Workload Bar ───────────────────────────────────────────────────────────────
function WorkloadBar({ remaining, max, onClick, isManager }: { remaining: number; max: number; onClick: () => void; isManager: boolean }) {
  const pct = max > 0 ? (remaining / max) * 100 : 0
  const barColor = pct <= 33 ? '#22c55e' : pct <= 66 ? '#f97316' : '#ef4444'
  const label = pct <= 33 ? 'Light' : pct <= 66 ? 'Moderate' : 'Heavy'
  const labelColor = pct <= 33 ? 'text-green-600 dark:text-green-400' : pct <= 66 ? 'text-orange-500 dark:text-orange-400' : 'text-red-500 dark:text-red-400'

  return (
    <div className={`flex items-center gap-2 min-w-[140px] ${isManager ? 'cursor-pointer group' : ''}`} onClick={isManager ? onClick : undefined} title={isManager ? 'Click to reassign tasks' : undefined}>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(4, pct)}%`, background: barColor }}
        />
      </div>
      <span className={`text-[10px] font-semibold shrink-0 ${labelColor}`}>{label}</span>
      {isManager && (
        <ArrowRightLeft className="w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function DeveloperAnalytics({ initialData, projectId }: Props) {
  const [devStats, setDevStats] = useState<DeveloperStat[]>(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [isManager, setIsManager] = useState(false)
  const [reassignDev, setReassignDev] = useState<DeveloperStat | null>(null)
  const [weeksCount, setWeeksCount] = useState(4)
  const [weeksOffset, setWeeksOffset] = useState(0)
  const [maxOffsetWeeks, setMaxOffsetWeeks] = useState(0)
  const [hasOlder, setHasOlder] = useState(false)
  const [hasNewer, setHasNewer] = useState(false)
  const [projectStartDate, setProjectStartDate] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  function buildAnalyticsUrl() {
    const params = new URLSearchParams()
    if (projectId) params.set('project_id', String(projectId))
    params.set('weeks', String(weeksCount))
    params.set('offset_weeks', String(weeksOffset))
    return `/api/analytics/developers?${params.toString()}`
  }

  async function fetchAnalytics() {
    const res = await fetch(buildAnalyticsUrl())
    const data = await res.json()
    setDevStats(data.developers ?? [])
    setMaxOffsetWeeks(Number(data.max_offset_weeks ?? 0))
    setHasOlder(Boolean(data.has_older))
    setHasNewer(Boolean(data.has_newer))
    setProjectStartDate(data.project_start_date ?? null)
    if (typeof data.offset_weeks === 'number' && data.offset_weeks !== weeksOffset) {
      setWeeksOffset(data.offset_weeks)
    }
    setLoading(false)
  }

  useEffect(() => {
    // Check if current user is manager
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      if ((s?.user as any)?.role === 'manager') setIsManager(true)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetchAnalytics().catch(() => setLoading(false))
  }, [projectId, weeksCount, weeksOffset])

  useEffect(() => {
    function handleProjectDetailChanged() {
      fetchAnalytics().catch(() => {})
    }

    window.addEventListener('project-detail-data-changed', handleProjectDetailChanged)
    return () => window.removeEventListener('project-detail-data-changed', handleProjectDetailChanged)
  }, [projectId, weeksCount, weeksOffset])

  function refresh() {
    fetchAnalytics().catch(() => {})
  }

  function shiftWindow(direction: 'older' | 'newer') {
    setWeeksOffset((prev) => {
      if (direction === 'older') return prev + weeksCount
      return Math.max(prev - weeksCount, 0)
    })
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <p className="text-sm text-slate-400 text-center py-4">Loading developer analytics...</p>
      </div>
    )
  }

  if (devStats.length === 0) {
    return (
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Developer Analytics</h2>
        <p className="text-sm text-slate-400 text-center py-4">No active assignees found.</p>
      </div>
    )
  }

  const weeks = devStats[0]?.weeklyTasksTrend.map((w) => w.week) ?? []

  const stackedData = weeks.map((week, wi) => {
    const row: Record<string, string | number> = { week }
    devStats.forEach((dev) => {
      const assigned = dev.weeklyTasksTrend[wi]?.count ?? 0
      const completed = dev.weeklyCompletedTrend?.[wi]?.count ?? 0
      row[`${dev.name}_done`] = completed
      row[`${dev.name}_rem`] = Math.max(0, assigned - completed)
    })
    return row
  })

  const timeChartData = weeks.map((week, wi) => {
    const row: Record<string, string | number> = { week }
    devStats.forEach((dev) => {
      row[dev.name] = dev.weeklyTimeTrend[wi]?.hours ?? 0
    })
    return row
  })

  // Workload: remaining = assigned - done
  const maxRemaining = Math.max(...devStats.map(d => d.tasksAssigned - d.tasksDone), 1)
  const tooltipStyle = {
    fontSize: 11,
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
    borderRadius: 8,
    color: isDark ? '#e2e8f0' : '#0f172a',
    boxShadow: isDark ? '0 4px 16px rgba(2, 6, 23, 0.45)' : '0 4px 16px rgba(15, 23, 42, 0.12)',
  } as const
  const chartMinWidth = Math.max(640, weeks.length * 92)
  const hasOlderWindow = hasOlder
  const hasNewerWindow = hasNewer || weeksOffset > 0
  const projectStartLabel = projectStartDate ? new Date(projectStartDate).toLocaleDateString('en-GB') : null

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Developer Analytics</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Window:</span>
          {[4, 8, 12, 24].map((w) => (
            <button
              key={w}
              onClick={() => { setWeeksCount(w); setWeeksOffset(0) }}
              className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                weeksCount === w
                  ? 'border-blue-500 bg-blue-600 text-white'
                  : 'border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              {w}w
            </button>
          ))}
          <div className="ml-1 flex items-center gap-1">
            <button
              onClick={() => shiftWindow('older')}
              disabled={!hasOlderWindow}
              className="px-2 py-1 rounded-md text-xs border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Show older weeks"
            >
              Older ◀
            </button>
            <button
              onClick={() => shiftWindow('newer')}
              disabled={!hasNewerWindow}
              className="px-2 py-1 rounded-md text-xs border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Back to newer weeks"
            >
              ▶ Newer
            </button>
            <button
              onClick={() => setWeeksOffset(maxOffsetWeeks)}
              disabled={!hasOlderWindow}
              className="px-2 py-1 rounded-md text-xs border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Jump to earliest data"
            >
              Project Start
            </button>
            <button
              onClick={() => setWeeksOffset(0)}
              disabled={!hasNewerWindow}
              className="px-2 py-1 rounded-md text-xs border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Jump to latest data"
            >
              Latest
            </button>
          </div>
        </div>
      </div>
      {projectStartLabel && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-3 mb-4">
          Timeline start: {projectStartLabel}
        </p>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Weekly Tasks Assigned vs Completed — stacked bar */}
        <div className="rounded-lg border border-slate-100 dark:border-navy-700 p-4 bg-slate-50 dark:bg-navy-900/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Weekly Tasks Assigned vs Completed
          </p>
          <div className="overflow-x-auto">
            <div style={{ minWidth: chartMinWidth }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart syncId="dev-analytics-weekly" data={stackedData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }}
                    itemStyle={{ color: isDark ? '#cbd5e1' : '#334155' }}
                    formatter={((value: unknown, name: unknown) => {
                      const n = String(name)
                      const isDone = n.endsWith('_done')
                      const devName = n.replace(/_done$|_rem$/, '')
                      return [value, isDone ? `${devName} (completed)` : `${devName} (remaining)`]
                    }) as any}
                  />
                  {devStats.map((dev, i) => {
                    const color = DEV_COLORS[i % DEV_COLORS.length]
                    return [
                      <Bar key={`${dev.id}_done`} dataKey={`${dev.name}_done`} stackId={dev.name} fill={color} radius={[0, 0, 0, 0]} name={`${dev.name}_done`} />,
                      <Bar key={`${dev.id}_rem`} dataKey={`${dev.name}_rem`} stackId={dev.name} fill={lighten(color)} radius={[3, 3, 0, 0]} name={`${dev.name}_rem`} />,
                    ]
                  })}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {devStats.map((dev, i) => (
              <span key={dev.id} className="flex items-center gap-1 text-xs text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: DEV_COLORS[i % DEV_COLORS.length] }} />
                {dev.name}
              </span>
            ))}
            <span className="flex items-center gap-1 text-xs text-slate-400 ml-1">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              remaining
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Last {weeksCount} weeks{weeksOffset > 0 ? ` (shifted ${weeksOffset}w older)` : ''} · solid = completed, light = remaining
          </p>
        </div>

        {/* Weekly Time Spent */}
        <div className="rounded-lg border border-slate-100 dark:border-navy-700 p-4 bg-slate-50 dark:bg-navy-900/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Time Spent Trend (hrs)</p>
          <div className="overflow-x-auto">
            <div style={{ minWidth: chartMinWidth }}>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart syncId="dev-analytics-weekly" data={timeChartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: isDark ? '#e2e8f0' : '#0f172a' }}
                    itemStyle={{ color: isDark ? '#cbd5e1' : '#334155' }}
                  />
                  {devStats.map((dev, i) => (
                    <Bar key={dev.id} dataKey={dev.name} fill={DEV_COLORS[i % DEV_COLORS.length]} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {devStats.map((dev, i) => (
              <span key={dev.id} className="flex items-center gap-1 text-xs text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: DEV_COLORS[i % DEV_COLORS.length] }} />
                {dev.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Last {weeksCount} weeks{weeksOffset > 0 ? ` (shifted ${weeksOffset}w older)` : ''}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 dark:border-navy-700 mb-4" />

      {/* Overall Workload Balance — table with workload bar */}
      <div className="mb-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Overall Workload Balance
          {isManager && <span className="ml-2 normal-case font-normal text-blue-500">· click bar to reassign tasks</span>}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-navy-700 text-left">
                {['Developer', 'Assigned', 'Completed', 'In Progress', 'Est. Mandays', 'Time Spent', 'Workload'].map((h) => (
                  <th key={h} className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-navy-700">
              {devStats.map((dev) => {
                const remaining = dev.tasksAssigned - dev.tasksDone
                return (
                  <tr key={dev.id} className="hover:bg-slate-50 dark:hover:bg-navy-700/30 transition-colors">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-800 dark:text-white">{dev.name}</p>
                      <p className="text-xs text-slate-400">{dev.email}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-medium">{dev.tasksAssigned}</td>
                    <td className="px-3 py-3">
                      <span className={`font-medium ${dev.tasksDone > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                        {dev.tasksDone}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`font-medium ${dev.tasksInProgress > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`}>
                        {dev.tasksInProgress}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                      {dev.estimatedMandays > 0 ? `${dev.estimatedMandays} md` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                      {dev.totalSpentDays > 0 ? `${dev.totalSpentDays}d` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <WorkloadBar
                        remaining={remaining}
                        max={maxRemaining}
                        onClick={() => setReassignDev(dev)}
                        isManager={isManager}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
        Time spent = sum of (task actual_end − actual_start). Workload = remaining active tasks relative to highest-loaded member.
      </p>

      {/* Reassign modal */}
      {reassignDev && (
        <ReassignModal
          dev={reassignDev}
          allDevs={devStats}
          projectId={projectId}
          onClose={() => setReassignDev(null)}
          onDone={refresh}
        />
      )}
    </div>
  )
}
