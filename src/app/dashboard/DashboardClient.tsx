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
  _count: { issues: number; deliverables?: number }
  computedProgress: number
  totalDeliverables?: number
  totalTasks?: number
  doneTasks?: number
}

interface TeamSummary {
  assignedProjectCount: number
  activeProjectCount: number
  doneProjectCount: number
  avgProjectProgress: number
  totalTasks: number
  todoTasks: number
  inProgressTasks: number
  reviewTasks: number
  blockedTasks: number
  doneTasks: number
  overdueTasks: number
  estimatedMandays: number
  completionRate: number | null
  onTimeRate: number | null
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

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl p-4 sm:p-5 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
      <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">{label}</p>
      <p className={`text-2xl sm:text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

export default function DashboardClient({
  projects,
  teamProjects,
  teamSummary,
  session,
}: {
  projects: Project[]
  teamProjects: Project[]
  teamSummary: TeamSummary
  session: any
}) {
  const isManager = session.user.role === 'manager'
  const [localProjects] = useState(projects)
  const [localTeamProjects] = useState(teamProjects)

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
        ].map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {localTeamProjects.length > 0 && (
        <section className="mb-6 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-navy-700 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Team Dashboard</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Your assigned projects and personal delivery analytics.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-semibold">
              Assignee view
            </span>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              {[
                { label: 'Assigned Projects', value: teamSummary.assignedProjectCount, color: 'text-blue-600 dark:text-blue-400' },
                { label: 'Active Projects', value: teamSummary.activeProjectCount, color: 'text-orange-600 dark:text-orange-400' },
                { label: 'Avg Progress', value: `${teamSummary.avgProjectProgress}%`, color: 'text-cyan-600 dark:text-cyan-400' },
                { label: 'Assigned Tasks', value: teamSummary.totalTasks, color: 'text-violet-600 dark:text-violet-400' },
                { label: 'Done Tasks', value: teamSummary.doneTasks, color: 'text-green-600 dark:text-green-400' },
                { label: 'In Review', value: teamSummary.reviewTasks, color: 'text-yellow-600 dark:text-yellow-400' },
                { label: 'Overdue', value: teamSummary.overdueTasks, color: 'text-red-600 dark:text-red-400' },
                { label: 'Est. Mandays', value: teamSummary.estimatedMandays, color: 'text-slate-700 dark:text-slate-200' },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">{s.label}</p>
                  <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Assigned Projects</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{localTeamProjects.length} project{localTeamProjects.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {localTeamProjects.map(project => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40 p-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{project.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {project.doneTasks ?? 0}/{project.totalTasks ?? 0} tasks done · {project.totalDeliverables ?? 0} deliverables
                          </p>
                        </div>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400 shrink-0">{project.computedProgress}%</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${project.computedProgress}%` }} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/40 p-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Developer Analytics</h3>
                <div className="mt-3 space-y-3">
                  {[
                    { label: 'Task Completion', value: teamSummary.completionRate, suffix: '%', tone: (teamSummary.completionRate ?? 0) >= 80 ? 'bg-green-500' : (teamSummary.completionRate ?? 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500' },
                    { label: 'On-time Completion', value: teamSummary.onTimeRate, suffix: '%', tone: (teamSummary.onTimeRate ?? 0) >= 90 ? 'bg-green-500' : (teamSummary.onTimeRate ?? 0) >= 75 ? 'bg-yellow-500' : 'bg-red-500' },
                    { label: 'Active Workload', value: teamSummary.totalTasks > 0 ? Math.round(((teamSummary.todoTasks + teamSummary.inProgressTasks + teamSummary.reviewTasks) / teamSummary.totalTasks) * 100) : null, suffix: '%', tone: teamSummary.blockedTasks > 0 || teamSummary.overdueTasks > 0 ? 'bg-red-500' : 'bg-blue-500' },
                  ].map(metric => (
                    <div key={metric.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{metric.label}</span>
                        <span className="font-semibold text-slate-800 dark:text-white">{metric.value != null ? `${metric.value}${metric.suffix}` : '—'}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                        <div className={`h-full rounded-full ${metric.tone}`} style={{ width: `${Math.min(100, metric.value ?? 0)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-2 py-2">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Todo</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{teamSummary.todoTasks}</p>
                  </div>
                  <div className="rounded-md bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-2 py-2">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Progress</p>
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{teamSummary.inProgressTasks}</p>
                  </div>
                  <div className="rounded-md bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 px-2 py-2">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Blocked</p>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{teamSummary.blockedTasks}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {localProjects.map(project => {
            const progress = project.computedProgress ?? 0
            const sv = project.scheduleVariance ?? 0
            return (
              <div key={project.id} className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 flex flex-col overflow-hidden hover:shadow-md transition-shadow min-h-[372px]">
                {/* Card header */}
                <div className="p-4 flex items-start gap-3 min-h-[92px]">
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
                <div className="px-4 min-h-[38px]">
                  {project.description ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{project.description}</p>
                  ) : (
                    <p className="text-xs text-slate-300 dark:text-slate-600 italic">No description</p>
                  )}
                </div>

                {/* Assignees + Dates */}
                <div className="px-4 pt-3 pb-1 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="truncate">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Team: </span>
                    {project.assignees.length > 0 ? project.assignees.map(a => a.user.name).join(', ') : '—'}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <p>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Start: </span>
                      {new Date(project.start_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Deadline: </span>
                      {new Date(project.deadline).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Deliverables: </span>
                      {project.totalDeliverables ?? 0}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Tasks: </span>
                      {project.doneTasks ?? 0}/{project.totalTasks ?? 0}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Open Issues: </span>
                      {project._count.issues}
                    </p>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="px-4 pt-3 pb-3">
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
