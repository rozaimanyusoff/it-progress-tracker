'use client'

import { useState, useEffect } from 'react'

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
}

interface Props {
  initialData?: DeveloperStat[]
  projectId?: number
}

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

  const maxTasks = Math.max(...devStats.map((d) => d.tasksAssigned), 1)

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-5">Developer Analytics</h2>

      {/* Workload balance visual bars */}
      <div className="mb-6">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Workload Balance
        </p>
        <div className="space-y-3">
          {devStats.map((dev) => {
            const workloadPct = (dev.tasksAssigned / maxTasks) * 100
            const completionPct =
              dev.tasksAssigned > 0
                ? Math.min(100, (dev.tasksDone / dev.tasksAssigned) * 100)
                : 0

            return (
              <div key={dev.id} className="flex items-center gap-3">
                {/* Developer name */}
                <div className="w-32 shrink-0">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{dev.name}</p>
                </div>

                {/* Stacked bar: blue = assigned, green overlay = done */}
                <div className="flex-1 relative h-3 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                  {/* Blue: assigned workload proportion */}
                  <div
                    className="absolute top-0 left-0 h-full bg-blue-200 dark:bg-blue-900/50 rounded-full"
                    style={{ width: `${workloadPct}%` }}
                  />
                  {/* Green: completed portion */}
                  <div
                    className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(completionPct / 100) * workloadPct}%` }}
                  />
                </div>

                {/* Stats pill */}
                <div className="flex items-center gap-2 shrink-0 w-44 text-xs">
                  <span className="text-green-600 dark:text-green-400 font-medium">{dev.tasksDone} done</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-600 dark:text-slate-300">{dev.tasksAssigned} assigned</span>
                  {dev.tasksDelayed > 0 && (
                    <span className="text-red-500 font-medium">{dev.tasksDelayed} delayed</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 dark:border-navy-700 mb-5" />

      {/* Developer stats table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-navy-700 text-left">
              {[
                'Developer',
                'Assigned',
                'Done',
                'In Progress',
                'Delayed',
                'Est. Mandays',
                'Time Spent (days)',
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-navy-700">
            {devStats.map((dev) => (
              <tr
                key={dev.id}
                className="hover:bg-slate-50 dark:hover:bg-navy-700/30 transition-colors"
              >
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-800 dark:text-white">{dev.name}</p>
                  <p className="text-xs text-slate-400">{dev.email}</p>
                </td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-medium">
                  {dev.tasksAssigned}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`font-medium ${
                      dev.tasksDone > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {dev.tasksDone}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`font-medium ${
                      dev.tasksInProgress > 0
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {dev.tasksInProgress}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {dev.tasksDelayed > 0 ? (
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                      <span>⚠</span>
                      {dev.tasksDelayed}
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                  {dev.estimatedMandays > 0 ? (
                    <span>{dev.estimatedMandays} md</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                  {dev.totalSpentDays > 0 ? (
                    <span>{dev.totalSpentDays} days</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
        Time spent = sum of (task actual_end − actual_start) for completed tasks.
        Delayed = tasks where actual completion exceeded feature planned end date.
      </p>
    </div>
  )
}
