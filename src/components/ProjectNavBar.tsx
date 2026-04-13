'use client'

import Link from 'next/link'

interface NavProject {
  id: number
  title: string
  computedProgress: number
  computedStatus: string
}

interface Props {
  projects: NavProject[]
  currentId: number
}

const STATUS_DOT: Record<string, string> = {
  Done: 'bg-green-500',
  InProgress: 'bg-orange-400',
  OnHold: 'bg-red-400',
  Pending: 'bg-slate-300 dark:bg-slate-500',
}

export default function ProjectNavBar({ projects, currentId }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 mb-5">
      {/* Left: project switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-1 min-w-0 scrollbar-none">
        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 mr-1">Projects:</span>
        {projects.map(p => {
          const isCurrent = p.id === currentId
          const dotClass = STATUS_DOT[p.computedStatus] ?? STATUS_DOT.Pending
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                isCurrent
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrent ? 'bg-white/70' : dotClass}`} />
              <span className="max-w-[120px] truncate">{p.title}</span>
              <span className={`font-bold tabular-nums ${isCurrent ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                {p.computedProgress}%
              </span>
            </Link>
          )
        })}
      </div>

      {/* Right: Back link */}
      <Link
        href="/dashboard"
        className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0 flex items-center gap-1"
      >
        ← Back
      </Link>
    </div>
  )
}
