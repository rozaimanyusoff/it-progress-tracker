'use client'
import { useMemo, useState, useRef, useEffect } from 'react'
import {
   LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
   Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

interface Task {
   id: number
   status: string
   actual_end: string | null
}

interface Props {
   tasks: Task[]
   projectStart: string
   projectDeadline: string
   compact?: boolean
}

function fmt(d: Date): string {
   return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function BurndownChart({ tasks, projectStart, projectDeadline, compact = false }: Props) {
   const [showHelp, setShowHelp] = useState(false)
   const helpRef = useRef<HTMLDivElement>(null)

   useEffect(() => {
      if (!showHelp) return
      function handleClick(e: MouseEvent) {
         if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
            setShowHelp(false)
         }
      }
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
   }, [showHelp])
   const { data, todayLabel } = useMemo(() => {
      const start = new Date(projectStart)
      start.setHours(0, 0, 0, 0)
      const deadline = new Date(projectDeadline)
      deadline.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const total = tasks.length
      if (total === 0) return { data: [], todayLabel: '' }

      const totalDays = Math.max(1, (deadline.getTime() - start.getTime()) / 86400000)
      // Extend chart to whichever is later: today or deadline
      const endDate = today > deadline ? new Date(today) : new Date(deadline)

      // Build date -> completions map using actual_end of Done tasks
      const completionsByDate = new Map<string, number>()
      for (const task of tasks) {
         if (task.status === 'Done' && task.actual_end) {
            const d = new Date(task.actual_end)
            d.setHours(0, 0, 0, 0)
            const key = d.toISOString().slice(0, 10)
            completionsByDate.set(key, (completionsByDate.get(key) ?? 0) + 1)
         }
      }

      const points: { date: string; Ideal: number | null; Actual: number | null }[] = []
      let cumulativeDone = 0
      const cur = new Date(start)

      while (cur <= endDate) {
         const dayIndex = (cur.getTime() - start.getTime()) / 86400000
         const key = cur.toISOString().slice(0, 10)

         // Ideal: linear from total → 0 between start and deadline only
         const Ideal = dayIndex <= totalDays
            ? Math.round((total * (1 - dayIndex / totalDays)) * 10) / 10
            : null

         // Actual: cumulative completions up to today
         let Actual: number | null = null
         if (cur.getTime() <= today.getTime()) {
            cumulativeDone += completionsByDate.get(key) ?? 0
            Actual = total - cumulativeDone
         }

         points.push({ date: fmt(cur), Ideal, Actual })
         cur.setDate(cur.getDate() + 1)
      }

      // Guarantee today is always present with a valid Actual value so the
      // actual line always renders as a line (≥2 points) and never as a dot.
      const todayFmt = fmt(today)
      const todayIdx = points.findIndex(p => p.date === todayFmt)
      if (todayIdx === -1) {
         // today not in array (start_date is in the future) — append it
         points.push({ date: todayFmt, Ideal: null, Actual: total - cumulativeDone })
      } else if (points[todayIdx].Actual === null) {
         // today in array but Actual was null — fix it
         points[todayIdx] = { ...points[todayIdx], Actual: total - cumulativeDone }
      }

      return { data: points, todayLabel: fmt(today) }
   }, [tasks, projectStart, projectDeadline])

   if (tasks.length === 0) {
      return (
         <div className={`${compact ? 'py-4' : 'p-8'} text-center text-slate-400 dark:text-slate-500 text-sm`}>
            No tasks found. Add tasks to deliverables to see the burndown chart.
         </div>
      )
   }

   // Reduce X-axis label density: show at most ~10 evenly-spaced ticks
   const tickInterval = Math.max(1, Math.floor(data.length / (compact ? 4 : 10)))

   return (
      <div className={compact ? 'px-0 py-1' : 'p-6'}>
         {!compact && (
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
               <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Burndown Chart</h3>
               {/* Help popover */}
               <div className="relative" ref={helpRef}>
                  <button
                     onClick={() => setShowHelp(v => !v)}
                     className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center border border-blue-400 dark:border-blue-500 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                     aria-label="Burndown chart help"
                  >
                     ?
                  </button>
                  {showHelp && (
                     <div className="absolute left-0 top-7 z-50 w-80 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-xl p-4 text-xs text-slate-600 dark:text-slate-300 space-y-3">
                        {/* Arrow */}
                        <div className="absolute -top-2 left-3 w-3 h-3 rotate-45 bg-white dark:bg-navy-800 border-l border-t border-slate-200 dark:border-navy-600" />

                        <div>
                           <p className="font-semibold text-slate-800 dark:text-white mb-1">What is a Burndown Chart?</p>
                           <p className="leading-relaxed">A burndown chart tracks remaining work (tasks) over time. It shows whether the project is on pace to finish all tasks by the deadline.</p>
                        </div>

                        <div>
                           <p className="font-semibold text-slate-800 dark:text-white mb-1">How to read it</p>
                           <ul className="space-y-1 leading-relaxed">
                              <li className="flex gap-2"><span className="shrink-0 mt-0.5 inline-block w-4 border-t-2 border-dashed border-slate-400" /><span><strong>Ideal</strong> — the pace needed to finish exactly on the deadline, linearly decreasing from total tasks to zero.</span></li>
                              <li className="flex gap-2"><span className="shrink-0 mt-0.5 inline-block w-4 border-t-2 border-blue-500" /><span><strong>Actual</strong> — real remaining tasks based on completed (Done) tasks each day.</span></li>
                              <li className="flex gap-2"><span className="shrink-0 w-4 text-amber-500 font-bold text-center">|</span><span><strong>Today</strong> — amber dashed line marking the current date.</span></li>
                           </ul>
                        </div>

                        <div>
                           <p className="font-semibold text-slate-800 dark:text-white mb-1">Example</p>
                           <p className="leading-relaxed">Project has <strong>10 tasks</strong>, 20-day duration. Ideal pace = 0.5 tasks/day. If only 2 tasks are done by day 10, Actual = 8 — above the Ideal line of 5 — meaning the project is <strong>behind schedule</strong>.</p>
                        </div>

                        <div>
                           <p className="font-semibold text-slate-800 dark:text-white mb-1">Best Practices</p>
                           <ul className="space-y-1 leading-relaxed list-disc list-inside">
                              <li>Mark tasks as <strong>Done</strong> with an accurate <em>actual end date</em> for a reliable chart.</li>
                              <li>If Actual is consistently above Ideal, re-scope or redistribute work early.</li>
                              <li>A flat Actual line means no tasks were completed — investigate blockers.</li>
                              <li>Aim to keep Actual at or below the Ideal line throughout the project.</li>
                           </ul>
                        </div>

                        <button
                           onClick={() => setShowHelp(false)}
                           className="mt-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                        >
                           Close
                        </button>
                     </div>
                  )}
               </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
               <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 border-t-2 border-dashed border-slate-400" />
                  Ideal
               </span>
               <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 border-t-2 border-blue-500" />
                  Actual
               </span>
            </div>
         </div>
         )}
         <ResponsiveContainer width="100%" height={compact ? 150 : 280}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
               <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
               <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  interval={tickInterval}
                  tickLine={false}
               />
               <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Tasks', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: '#94a3b8' } }}
               />
               <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  labelStyle={{ fontWeight: 600 }}
               />
               <ReferenceLine
                  x={todayLabel}
                  stroke="#f59e0b"
                  strokeDasharray="4 2"
                  label={compact ? undefined : { value: 'Today', position: 'top', fontSize: 10, fill: '#f59e0b' }}
               />
               <Line
                  type="linear"
                  dataKey="Ideal"
                  stroke="#94a3b8"
                  strokeDasharray="6 3"
                  dot={false}
                  strokeWidth={1.5}
                  connectNulls={false}
               />
               <Line
                  type="monotone"
                  dataKey="Actual"
                  stroke="#3b82f6"
                  dot={false}
                  strokeWidth={2}
                  connectNulls={false}
               />
            </LineChart>
         </ResponsiveContainer>
         {!compact && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
               {tasks.length} total tasks · {tasks.filter(t => t.status === 'Done').length} completed
            </p>
         )}
      </div>
   )
}
