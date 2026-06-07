'use client'
import { useMemo, useState, useRef, useEffect } from 'react'
import {
   LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
   ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

interface ProgressUpdate {
   progress_pct: number
   created_at: string
}

interface Task {
   id: number
   status: string
   actual_end: string | null
}

interface Props {
   tasks: Task[]
   progressUpdates: ProgressUpdate[]
   projectStart: string
   projectDeadline: string
   compact?: boolean
}

function fmtDate(d: Date): string {
   return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export default function SCurveChart({ tasks, progressUpdates, projectStart, projectDeadline, compact = false }: Props) {
   const [showHelp, setShowHelp] = useState(false)
   const helpRef = useRef<HTMLDivElement>(null)

   useEffect(() => {
      if (!showHelp) return
      function handler(e: MouseEvent) {
         if (helpRef.current && !helpRef.current.contains(e.target as Node)) setShowHelp(false)
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
   }, [showHelp])

   const { data, todayLabel, variance, actualNow, claimedNow } = useMemo(() => {
      const start = new Date(projectStart)
      start.setHours(0, 0, 0, 0)
      const deadline = new Date(projectDeadline)
      deadline.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const totalMs = Math.max(1, deadline.getTime() - start.getTime())
      const endDate = today > deadline ? new Date(today) : new Date(deadline)
      const total = tasks.length

      const doneDates = tasks
         .filter(t => t.status === 'Done' && t.actual_end)
         .map(t => { const d = new Date(t.actual_end!); d.setHours(0, 0, 0, 0); return d.getTime() })
         .sort((a, b) => a - b)

      const sortedUpdates = [...progressUpdates]
         .map(u => ({ ts: new Date(u.created_at).getTime(), pct: u.progress_pct }))
         .sort((a, b) => a.ts - b.ts)

      function computePoint(ts: number) {
         const elapsed = ts - start.getTime()
         const Planned = ts <= deadline.getTime()
            ? Math.round((elapsed / totalMs) * 1000) / 10
            : null
         const Actual = ts <= today.getTime() && total > 0
            ? Math.round((doneDates.filter(d => d <= ts).length / total) * 1000) / 10
            : null
         const lastUpdate = ts <= today.getTime()
            ? [...sortedUpdates].reverse().find(u => u.ts <= ts)
            : undefined
         const Claimed = lastUpdate ? lastUpdate.pct : null
         return { Planned, Actual, Claimed }
      }

      // Weekly data points
      const pointMap = new Map<number, ReturnType<typeof computePoint>>()
      const cur = new Date(start)
      while (cur <= endDate) {
         pointMap.set(cur.getTime(), computePoint(cur.getTime()))
         cur.setDate(cur.getDate() + 7)
      }
      // Ensure today is present
      if (!pointMap.has(today.getTime())) {
         pointMap.set(today.getTime(), computePoint(today.getTime()))
      }

      const sorted = [...pointMap.entries()]
         .sort((a, b) => a[0] - b[0])
         .map(([ts, p]) => ({ date: fmtDate(new Date(ts)), ...p }))

      const todayFmt = fmtDate(today)
      const todayPoint = sorted.find(p => p.date === todayFmt)
      const varVal = todayPoint?.Actual != null && todayPoint?.Planned != null
         ? Math.round((todayPoint.Actual - todayPoint.Planned) * 10) / 10
         : null

      return {
         data: sorted,
         todayLabel: todayFmt,
         variance: varVal,
         actualNow: todayPoint?.Actual ?? null,
         claimedNow: todayPoint?.Claimed ?? null,
      }
   }, [tasks, progressUpdates, projectStart, projectDeadline])

   const tickInterval = Math.max(1, Math.floor(data.length / (compact ? 4 : 10)))

   if (compact) {
      return (
         <div className="px-2 pt-1 pb-2">
            {/* Compact variance strip */}
            <div className="flex items-center gap-2 mb-1 text-[10px]">
               {actualNow != null && (
                  <span className="text-slate-500 dark:text-slate-400">
                     Actual <span className="font-semibold text-blue-600 dark:text-blue-400">{actualNow}%</span>
                  </span>
               )}
               {claimedNow != null && (
                  <span className="text-slate-500 dark:text-slate-400">
                     Claimed <span className="font-semibold text-emerald-600 dark:text-emerald-400">{claimedNow}%</span>
                  </span>
               )}
               {variance != null && (
                  <span className={`ml-auto px-1.5 py-0.5 rounded font-semibold ${
                     variance >= 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                     {variance >= 0 ? '+' : ''}{variance}%
                  </span>
               )}
            </div>
            <ResponsiveContainer width="100%" height={150}>
               <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={tickInterval} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} width={32} />
                  <Tooltip
                     contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0' }}
                     labelStyle={{ fontWeight: 600 }}
                     formatter={(value: unknown) => [`${value}%`]}
                  />
                  <ReferenceLine x={todayLabel} stroke="#f59e0b" strokeDasharray="4 2" />
                  <Line type="linear" dataKey="Planned" stroke="#94a3b8" strokeDasharray="6 3" dot={false} strokeWidth={1.5} connectNulls={false} />
                  <Line type="monotone" dataKey="Actual" stroke="#3b82f6" dot={false} strokeWidth={2} connectNulls={false} />
                  <Line type="monotone" dataKey="Claimed" stroke="#10b981" dot={false} strokeWidth={2} connectNulls={false} />
               </LineChart>
            </ResponsiveContainer>
         </div>
      )
   }

   return (
      <div className="p-6">
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
               <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">S-Curve</h3>
               <div className="relative" ref={helpRef}>
                  <button
                     onClick={() => setShowHelp(v => !v)}
                     className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center border border-blue-400 dark:border-blue-500 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                     aria-label="S-Curve help"
                  >
                     ?
                  </button>
                  {showHelp && (
                     <div className="absolute left-0 top-7 z-50 w-80 rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-xl p-4 text-xs text-slate-600 dark:text-slate-300 space-y-3">
                        <div className="absolute -top-2 left-3 w-3 h-3 rotate-45 bg-white dark:bg-navy-800 border-l border-t border-slate-200 dark:border-navy-600" />
                        <div>
                           <p className="font-semibold text-slate-800 dark:text-white mb-1">What is an S-Curve?</p>
                           <p className="leading-relaxed">A project management tool that compares planned schedule progress against actual task completion and officially reported (claimed) progress over time.</p>
                        </div>
                        <div>
                           <p className="font-semibold text-slate-800 dark:text-white mb-1">How to read it</p>
                           <ul className="space-y-1 leading-relaxed">
                              <li className="flex gap-2"><span className="shrink-0 mt-0.5 inline-block w-4 border-t-2 border-dashed border-slate-400" /><span><strong>Planned</strong> — baseline schedule: equal progress across the timeline, 0% on start date, 100% on deadline.</span></li>
                              <li className="flex gap-2"><span className="shrink-0 mt-0.5 inline-block w-4 border-t-2 border-blue-500" /><span><strong>Actual</strong> — real task completion rate based on tasks marked Done with their actual end dates.</span></li>
                              <li className="flex gap-2"><span className="shrink-0 mt-0.5 inline-block w-4 border-t-2 border-emerald-500" /><span><strong>Claimed</strong> — progress % as reported by the PM in project updates. May differ from Actual if not all tasks are tracked.</span></li>
                              <li className="flex gap-2"><span className="shrink-0 w-4 text-amber-500 font-bold text-center">|</span><span><strong>Today</strong> — amber dashed line marking the current date.</span></li>
                           </ul>
                        </div>
                        <div>
                           <p className="font-semibold text-slate-800 dark:text-white mb-1">Interpreting variance</p>
                           <ul className="space-y-1 leading-relaxed list-disc list-inside">
                              <li><strong>Actual above Planned</strong> — project is ahead of schedule.</li>
                              <li><strong>Actual below Planned</strong> — project is behind schedule.</li>
                              <li><strong>Claimed above Actual</strong> — reported progress exceeds measured task completion; investigate risk.</li>
                           </ul>
                        </div>
                        <button onClick={() => setShowHelp(false)} className="mt-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline">Close</button>
                     </div>
                  )}
               </div>
            </div>

            {/* Variance summary chips */}
            <div className="flex items-center gap-3 text-xs">
               {actualNow != null && (
                  <span className="text-slate-500 dark:text-slate-400">
                     Actual: <span className="font-semibold text-blue-600 dark:text-blue-400">{actualNow}%</span>
                  </span>
               )}
               {claimedNow != null && (
                  <span className="text-slate-500 dark:text-slate-400">
                     Claimed: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{claimedNow}%</span>
                  </span>
               )}
               {variance != null && (
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${
                     variance >= 0
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                     {variance >= 0 ? '+' : ''}{variance}% variance
                  </span>
               )}
            </div>
         </div>

         <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
               <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
               <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  interval={tickInterval}
                  tickLine={false}
               />
               <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v}%`}
               />
               <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  labelStyle={{ fontWeight: 600 }}
                  formatter={(value: unknown) => [`${value}%`]}
               />
               <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="plainline"
               />
               <ReferenceLine
                  x={todayLabel}
                  stroke="#f59e0b"
                  strokeDasharray="4 2"
                  label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#f59e0b' }}
               />
               <Line
                  type="linear"
                  dataKey="Planned"
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
               <Line
                  type="monotone"
                  dataKey="Claimed"
                  stroke="#10b981"
                  dot={{ r: 3, fill: '#10b981' }}
                  strokeWidth={2}
                  connectNulls={false}
               />
            </LineChart>
         </ResponsiveContainer>

         <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
            {tasks.length} total tasks · {tasks.filter(t => t.status === 'Done').length} completed · {progressUpdates.length} progress report{progressUpdates.length !== 1 ? 's' : ''}
         </p>
      </div>
   )
}
