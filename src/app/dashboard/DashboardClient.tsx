'use client'
import { useState } from 'react'
import Link from 'next/link'
import DeveloperAnalytics from '@/components/DeveloperAnalytics'

interface Project {
  id: number
  title: string
  description: string | null
  status: string
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
  const size = 52
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
    inProgress: localProjects.filter(p => p.status === 'InProgress').length,
    done: localProjects.filter(p => p.status === 'Done').length,
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
        <Link href="/projects/new" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
          + New Project
        </Link>
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

      {/* Projects */}
      <div className="rounded-xl border overflow-hidden bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 mb-6">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Projects</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-navy-700">
          {localProjects.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">No projects found.</div>
          )}
          {localProjects.map(project => {
            const progress = project.computedProgress ?? 0
            return (
              <div key={project.id} className="px-4 sm:px-6 py-4 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="pt-0.5">
                    <CircleProgress value={progress} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link href={`/projects/${project.id}`} className="font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm sm:text-base">
                        {project.title}
                      </Link>
                      <StatusBadge status={project.status} />
                    </div>
                    {project.description && (
                      <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm truncate mb-1">{project.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-slate-400 dark:text-slate-500">
                      {project.assignees.length > 0 && (
                        <span>Assignees: {project.assignees.map(a => a.user.name).join(', ')}</span>
                      )}
                      <span>Deadline: {new Date(project.deadline).toLocaleDateString()}</span>
                      {project._count.issues > 0 && (
                        <span className="text-red-500 dark:text-red-400">{project._count.issues} open issue(s)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <Link
                      href={`/projects/${project.id}`}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors whitespace-nowrap text-center"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Developer Analytics */}
      <DeveloperAnalytics />
    </div>
  )
}
