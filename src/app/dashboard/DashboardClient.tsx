'use client'
import { useState } from 'react'
import Link from 'next/link'

interface Project {
  id: number
  title: string
  description: string | null
  status: string
  computedStatus: string
  scheduleVariance?: number
  computedHealthStatus?: 'on_track' | 'at_risk' | 'delayed' | 'overdue' | null
  completionRate?: number | null
  netFlow?: number
  backlogTrend?: 'Shrinking' | 'Growing' | 'Stable'
  onTimeCompletionRate?: number | null
  scopeVolatility?: number | null
  deadline: string
  start_date: string
  assignees: { user: { id: number; name: string } }[]
  updates: { progress_pct: number; status: string; created_at: string }[]
  _count: { issues: number }
  computedProgress: number
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Done: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700',
    InProgress: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-400 dark:border-orange-700',
    OnHold: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700',
    Pending: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
  }
  const labels: Record<string, string> = { InProgress: 'In Progress', OnHold: 'On Hold', Done: 'Done', Pending: 'Pending' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] || map.Pending}`}>
      {labels[status] || status}
    </span>
  )
}

function CircleProgress({ value }: { value: number }) {
  const size = 56
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = value >= 80 ? '#22c55e' : value >= 40 ? '#f97316' : '#3b82f6'
  const trackColor = 'var(--circle-track, #e2e8f0)'

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" stroke={trackColor} className="dark:[--circle-track:#162d4a]" />
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" stroke={color} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color }}>{value}%</span>
    </div>
  )
}

export default function DashboardClient({ projects, session }: { projects: Project[]; session: any }) {
  const isManager = session.user.role === 'manager'
  const [localProjects] = useState(projects)

  const stats = {
    total: localProjects.length,
    inProgress: localProjects.filter(p => p.computedStatus === 'InProgress').length,
    done: localProjects.filter(p => p.computedStatus === 'Done').length,
    issues: localProjects.reduce((s, p) => s + p._count.issues, 0),
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {isManager ? 'All projects overview' : 'Your assigned projects'}
          </p>
        </div>
        {isManager && (
          <Link href="/projects/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
            + New Project
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Total Projects', value: stats.total, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-orange-600 dark:text-orange-400' },
          { label: 'Done', value: stats.done, color: 'text-green-600 dark:text-green-400' },
          { label: 'Open Issues', value: stats.issues, color: 'text-red-600 dark:text-red-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 sm:p-5 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">{s.label}</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Projects — card grid */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 dark:text-white">Projects</h2>
        <span className="text-xs text-slate-400">{localProjects.length} project{localProjects.length !== 1 ? 's' : ''}</span>
      </div>

      {localProjects.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-6 py-12 text-center text-slate-400">
          No projects found.
        </div>
      ) : (
        <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
          {localProjects.map(project => {
            const progress = project.computedProgress ?? 0
            const sv = project.scheduleVariance ?? 0
            return (
              <div key={project.id} className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 flex flex-col overflow-hidden hover:shadow-md transition-shadow">
                {/* Card header */}
                <div className="p-4 flex items-start gap-3">
                  <CircleProgress value={progress} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm leading-snug block truncate"
                        title={project.title}
                      >
                        {project.title}
                      </Link>
                      <span className={`text-xs font-semibold whitespace-nowrap ${sv > 0 ? 'text-green-600 dark:text-green-400' :
                          sv < 0 ? 'text-red-500 dark:text-red-400' :
                            'text-slate-500 dark:text-slate-400'
                        }`}>
                        SV {sv > 0 ? '+' : ''}{Math.round(sv)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <StatusBadge status={project.computedStatus} />
                      {project.computedHealthStatus && project.computedStatus !== 'Done' && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${project.computedHealthStatus === 'on_track' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            project.computedHealthStatus === 'at_risk' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              project.computedHealthStatus === 'delayed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                          }`}>
                          {project.computedHealthStatus === 'on_track' ? '🟢 On Track' :
                            project.computedHealthStatus === 'at_risk' ? '🟡 At Risk' :
                              project.computedHealthStatus === 'delayed' ? '🔴 Delayed' : '⚫ Overdue'}
                        </span>
                      )}
                      {project._count.issues > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                          {project._count.issues} issue{project._count.issues > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {project.description && (
                  <p className="px-4 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 -mt-1">{project.description}</p>
                )}

                {/* Assignees + Dates */}
                <div className="px-4 pt-2 pb-1 text-[11px] text-slate-400 dark:text-slate-500 space-y-0.5">
                  {project.assignees.length > 0 && (
                    <p className="truncate">
                      <span className="font-medium text-slate-500 dark:text-slate-400">Team: </span>
                      {project.assignees.map(a => a.user.name).join(', ')}
                    </p>
                  )}
                  <p>
                    <span className="font-medium text-slate-500 dark:text-slate-400">Start: </span>
                    {new Date(project.start_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <p>
                    <span className="font-medium text-slate-500 dark:text-slate-400">Deadline: </span>
                    {new Date(project.deadline).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {/* KPI Cards */}
                <div className="px-4 pt-2 pb-2">
                  <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">
                    Project Performance
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Completion</p>
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                        {project.completionRate != null ? `${project.completionRate}%` : '—'}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Net Flow</p>
                      <p className={`text-[11px] font-semibold mt-0.5 ${(project.netFlow ?? 0) > 0 ? 'text-green-600 dark:text-green-400' :
                          (project.netFlow ?? 0) < 0 ? 'text-red-500 dark:text-red-400' :
                            'text-slate-700 dark:text-slate-200'
                        }`}>
                        {(project.netFlow ?? 0) > 0 ? '+' : ''}{project.netFlow ?? 0}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-500">On-time</p>
                      <p className={`text-[11px] font-semibold mt-0.5 ${(project.onTimeCompletionRate ?? -1) >= 90 ? 'text-green-600 dark:text-green-400' :
                          (project.onTimeCompletionRate ?? -1) >= 75 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-500 dark:text-red-400'
                        }`}>
                        {project.onTimeCompletionRate != null ? `${project.onTimeCompletionRate}%` : '—'}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Scope Volatility</p>
                      <p className={`text-[11px] font-semibold mt-0.5 ${(project.scopeVolatility ?? 0) <= 15 ? 'text-green-600 dark:text-green-400' :
                          (project.scopeVolatility ?? 0) <= 30 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-500 dark:text-red-400'
                        }`}>
                        {project.scopeVolatility != null ? `${project.scopeVolatility}%` : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 mt-auto border-t border-slate-100 dark:border-navy-700 flex justify-end">
                  <Link
                    href={`/projects/${project.id}`}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    View Project
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
