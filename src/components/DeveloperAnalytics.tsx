'use client'

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'

interface WeekPoint {
  week: string
  [name: string]: number | string
}

interface DeveloperStat {
  id: number
  name: string
  email: string
  tasksAssigned: number
  tasksDone: number
  tasksInProgress: number
  tasksDelayed: number
  estimatedMandays: number
  totalSpentDays: number
  weeklyTasksTrend: { week: string; count: number }[]
  weeklyTimeTrend: { week: string; hours: number }[]
}

interface Props {
  initialData?: DeveloperStat[]
  projectId?: number
}

function MiniCircle({ value, size = 36, color }: { value: number; size?: number; color: string }) {
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" stroke="currentColor" className="text-slate-200 dark:text-navy-700" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        strokeWidth={strokeWidth} fill="none"
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}

const DEV_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#14b8a6']

export default function DeveloperAnalytics({ initialData, projectId }: Props) {
  const [devStats, setDevStats] = useState<DeveloperStat[]>(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return
    const url = projectId
      ? `/api/analytics/developers?project_id=${projectId}`
      : '/api/analytics/developers'
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setDevStats(data.developers ?? [])
        setLoading(false)
      })
  }, [projectId])

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
        <p className="text-sm text-slate-400 text-center py-4">No active member accounts found.</p>
      </div>
    )
  }

  // Build chart data: one row per week, one key per developer
  const weeks = devStats[0]?.weeklyTasksTrend.map((w) => w.week) ?? []

  const tasksChartData: WeekPoint[] = weeks.map((week, wi) => {
    const row: WeekPoint = { week }
    devStats.forEach((dev) => {
      row[dev.name] = dev.weeklyTasksTrend[wi]?.count ?? 0
    })
    return row
  })

  const timeChartData: WeekPoint[] = weeks.map((week, wi) => {
    const row: WeekPoint = { week }
    devStats.forEach((dev) => {
      row[dev.name] = dev.weeklyTimeTrend[wi]?.hours ?? 0
    })
    return row
  })

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 sm:p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-5">Developer Analytics</h2>

      {/* 3-metric summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {/* 1. Completed vs Total Tasks */}
        <div className="rounded-lg border border-slate-100 dark:border-navy-700 p-4 bg-slate-50 dark:bg-navy-900/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Completed vs Total Tasks</p>
          <div className="space-y-2">
            {devStats.map((dev) => {
              const pct = dev.tasksAssigned > 0 ? Math.round((dev.tasksDone / dev.tasksAssigned) * 100) : 0
              const color = pct >= 80 ? '#22c55e' : pct >= 40 ? '#f97316' : '#3b82f6'
              return (
                <div key={dev.id} className="flex items-center gap-2">
                  <MiniCircle value={pct} color={color} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{dev.name}</p>
                    <p className="text-xs text-slate-400">{dev.tasksDone}/{dev.tasksAssigned} tasks</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 2. Weekly Tasks Assigned — Line Chart (4 weeks) */}
        <div className="rounded-lg border border-slate-100 dark:border-navy-700 p-4 bg-slate-50 dark:bg-navy-900/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Tasks Assigned Trend</p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={tasksChartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              {devStats.map((dev, i) => (
                <Line
                  key={dev.id}
                  type="monotone"
                  dataKey={dev.name}
                  stroke={DEV_COLORS[i % DEV_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {devStats.map((dev, i) => (
              <span key={dev.id} className="flex items-center gap-1 text-xs text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: DEV_COLORS[i % DEV_COLORS.length] }} />
                {dev.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Last 4 weeks</p>
        </div>

        {/* 3. Weekly Time Spent — Bar Chart (4 weeks) */}
        <div className="rounded-lg border border-slate-100 dark:border-navy-700 p-4 bg-slate-50 dark:bg-navy-900/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Time Spent Trend (hrs)</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={timeChartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              {devStats.map((dev, i) => (
                <Bar
                  key={dev.id}
                  dataKey={dev.name}
                  fill={DEV_COLORS[i % DEV_COLORS.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {devStats.map((dev, i) => (
              <span key={dev.id} className="flex items-center gap-1 text-xs text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: DEV_COLORS[i % DEV_COLORS.length] }} />
                {dev.name}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Last 4 weeks</p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 dark:border-navy-700 mb-4" />

      {/* Workload balance */}
      <div className="mb-5">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Overall Workload Balance
        </p>
        <div className="space-y-3">
          {devStats.map((dev) => {
            const maxTasks = Math.max(...devStats.map((d) => d.tasksAssigned), 1)
            const workloadPct = (dev.tasksAssigned / maxTasks) * 100
            const completionPct =
              dev.tasksAssigned > 0
                ? Math.min(100, (dev.tasksDone / dev.tasksAssigned) * 100)
                : 0

            return (
              <div key={dev.id} className="flex items-center gap-3">
                <div className="w-24 sm:w-32 shrink-0">
                  <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{dev.name}</p>
                </div>
                <div className="flex-1 relative h-3 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-blue-200 dark:bg-blue-900/50 rounded-full"
                    style={{ width: `${workloadPct}%` }}
                  />
                  <div
                    className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(completionPct / 100) * workloadPct}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <span className="text-green-600 dark:text-green-400 font-medium">{dev.tasksDone}✓</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-600 dark:text-slate-300">{dev.tasksAssigned}</span>
                  {dev.tasksDelayed > 0 && (
                    <span className="text-red-500 font-medium">⚠{dev.tasksDelayed}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-navy-700 text-left">
              {['Developer', 'Assigned', 'Done', 'In Progress', 'Delayed', 'Est. Mandays', 'Time Spent'].map((h) => (
                <th key={h} className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-navy-700">
            {devStats.map((dev) => (
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
                <td className="px-3 py-3">
                  {dev.tasksDelayed > 0 ? (
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">⚠ {dev.tasksDelayed}</span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                  {dev.estimatedMandays > 0 ? `${dev.estimatedMandays} md` : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                  {dev.totalSpentDays > 0 ? `${dev.totalSpentDays}d` : <span className="text-slate-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
        Time spent = sum of (task actual_end − actual_start). Delayed = tasks past feature planned end.
      </p>
    </div>
  )
}
