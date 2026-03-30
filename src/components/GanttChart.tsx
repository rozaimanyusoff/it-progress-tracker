'use client'

import { useState } from 'react'

interface GanttTask {
  id: number
  title: string
  status: string
  actual_start: string | null
  actual_end: string | null
  assigned_to: number | null
  assignee: { id: number; name: string } | null
}

interface GanttDeliverable {
  id: number
  title: string
  status: string
  mandays: number
  planned_start: string | null
  planned_end: string | null
  actual_start: string | null
  actual_end: string | null
  module_id: number | null
  tasks: GanttTask[]
}

interface GanttModule {
  id: number
  title: string
}

interface GanttProject {
  id: number
  title: string
  start_date: string
  deadline: string
}

interface Props {
  project: GanttProject
  deliverables: GanttDeliverable[]
  modules: GanttModule[]
  embedded?: boolean
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

function dateToPercent(date: Date, rangeStart: Date, totalDays: number): number {
  const diffDays = (date.getTime() - rangeStart.getTime()) / MS_PER_DAY
  return Math.max(0, Math.min(100, (diffDays / totalDays) * 100))
}

function barStyle(
  start: Date | null,
  end: Date | null,
  rangeStart: Date,
  totalDays: number,
  fallbackEnd?: Date
): { left: string; width: string } | null {
  if (!start) return null
  const barEnd = end ?? fallbackEnd ?? new Date()
  const left = dateToPercent(start, rangeStart, totalDays)
  const right = dateToPercent(barEnd, rangeStart, totalDays)
  const width = Math.max(0.5, right - left)
  return { left: `${left}%`, width: `${width}%` }
}

function barColor(actualStart: string | null, actualEnd: string | null, deadline: Date): string {
  if (!actualStart) return ''
  const today = new Date()
  if (actualEnd) return new Date(actualEnd) <= deadline ? 'bg-green-500' : 'bg-red-500'
  return today > deadline ? 'bg-pink-400' : 'bg-emerald-400'
}

function computeRange(deliverables: GanttDeliverable[], projectStart: string, projectDeadline: string) {
  const today = new Date()
  const allDates: Date[] = [today, new Date(projectStart), new Date(projectDeadline)]
  for (const d of deliverables) {
    if (d.planned_start) allDates.push(new Date(d.planned_start))
    if (d.planned_end) allDates.push(new Date(d.planned_end))
    if (d.actual_start) allDates.push(new Date(d.actual_start))
    if (d.actual_end) allDates.push(new Date(d.actual_end))
    for (const t of d.tasks) {
      if (t.actual_start) allDates.push(new Date(t.actual_start))
      if (t.actual_end) allDates.push(new Date(t.actual_end))
    }
  }
  const minTime = Math.min(...allDates.map(d => d.getTime()))
  const maxTime = Math.max(...allDates.map(d => d.getTime()))
  const pad = (maxTime - minTime) * 0.05 || MS_PER_DAY * 7
  return {
    rangeStart: new Date(minTime - pad),
    rangeEnd: new Date(maxTime + pad),
    totalDays: (maxTime - minTime + 2 * pad) / MS_PER_DAY,
  }
}

function generateTicks(rangeStart: Date, rangeEnd: Date, totalDays: number) {
  const ticks: { date: Date; left: number; label: string | null }[] = []
  const useWeeks = totalDays >= 30
  if (useWeeks) {
    const current = new Date(rangeStart)
    const day = current.getDay()
    current.setDate(current.getDate() + (day === 1 ? 0 : day === 0 ? 1 : 8 - day))
    current.setHours(0, 0, 0, 0)
    while (current <= rangeEnd) {
      ticks.push({ date: new Date(current), left: dateToPercent(current, rangeStart, totalDays), label: current.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' }) })
      current.setDate(current.getDate() + 7)
    }
  } else {
    const current = new Date(rangeStart)
    current.setDate(current.getDate() + 1)
    current.setHours(0, 0, 0, 0)
    let i = 0
    while (current <= rangeEnd) {
      ticks.push({ date: new Date(current), left: dateToPercent(current, rangeStart, totalDays), label: i % 7 === 0 ? current.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' }) : null })
      current.setDate(current.getDate() + 1); i++
    }
  }
  return ticks
}

const STATUS_BADGE: Record<string, string> = {
  Pending:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Done:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OnHold:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

function DeliverableRow({
  deliverable, deadline, rangeStart, totalDays, todayLeft, deadlineLeft, indent,
}: {
  deliverable: GanttDeliverable
  deadline: Date
  rangeStart: Date
  totalDays: number
  todayLeft: number
  deadlineLeft: number
  indent?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const today = new Date()
  const color = barColor(deliverable.actual_start, deliverable.actual_end, deadline)
  const actualStyle = barStyle(
    deliverable.actual_start ? new Date(deliverable.actual_start) : null,
    deliverable.actual_end ? new Date(deliverable.actual_end) : null,
    rangeStart, totalDays, today
  )
  const plannedStyle = barStyle(
    deliverable.planned_start ? new Date(deliverable.planned_start) : null,
    deliverable.planned_end ? new Date(deliverable.planned_end) : null,
    rangeStart, totalDays
  )

  const LABEL_W = 240

  return (
    <>
      <div className="flex border-b border-slate-100 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-700/30 transition-colors">
        <div
          className="shrink-0 flex items-center gap-2 px-3 py-2 border-r border-slate-200 dark:border-navy-700"
          style={{ width: LABEL_W, paddingLeft: indent ? 28 : 12 }}
        >
          <button onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs w-4 shrink-0">
            {expanded ? '▼' : '▶'}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{deliverable.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block px-1.5 py-px rounded text-xs font-medium ${STATUS_BADGE[deliverable.status]}`}>
                {deliverable.status === 'InProgress' ? 'In Progress' : deliverable.status}
              </span>
              <span className="text-xs text-slate-400">{deliverable.mandays}md</span>
            </div>
          </div>
        </div>
        <div className="flex-1 relative" style={{ height: 52 }}>
          {/* Planned bar */}
          {plannedStyle && (
            <div
              className="absolute bg-slate-300 dark:bg-slate-600 rounded-sm"
              style={{ ...plannedStyle, top: 8, height: 8 }}
              title={`Planned: ${deliverable.planned_start ? new Date(deliverable.planned_start).toLocaleDateString() : '—'} → ${deliverable.planned_end ? new Date(deliverable.planned_end).toLocaleDateString() : '—'}`}
            />
          )}
          {/* Actual bar */}
          {actualStyle && color && (
            <div
              className={`absolute ${color} rounded-sm flex items-center`}
              style={{ ...actualStyle, top: 22, height: 12 }}
              title={`Actual: ${deliverable.actual_start ? new Date(deliverable.actual_start).toLocaleDateString() : 'Not started'} → ${deliverable.actual_end ? new Date(deliverable.actual_end).toLocaleDateString() : 'In progress'}`}
            >
              <span className="text-xs px-1 truncate text-white select-none" style={{ fontSize: 9 }}>Actual</span>
            </div>
          )}
          {!plannedStyle && !actualStyle && (
            <div className="absolute inset-0 flex items-center pl-3">
              <span className="text-xs text-slate-300 dark:text-slate-600 italic">Not started</span>
            </div>
          )}
          {todayLeft >= 0 && todayLeft <= 100 && <div className="absolute top-0 bottom-0 w-px bg-blue-500 opacity-40 z-10" style={{ left: `${todayLeft}%` }} />}
          {deadlineLeft >= 0 && deadlineLeft <= 100 && <div className="absolute top-0 bottom-0 z-10" style={{ left: `${deadlineLeft}%`, width: 1, borderLeft: '1px dashed #94a3b8' }} />}
        </div>
      </div>

      {expanded && deliverable.tasks.map(task => {
        const tColor = barColor(task.actual_start, task.actual_end, deadline)
        const tStyle = barStyle(
          task.actual_start ? new Date(task.actual_start) : null,
          task.actual_end ? new Date(task.actual_end) : null,
          rangeStart, totalDays, today
        )
        return (
          <div key={task.id} className="flex border-b border-slate-100 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-900/20">
            <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-r border-slate-200 dark:border-navy-700" style={{ width: LABEL_W, paddingLeft: indent ? 44 : 28 }}>
              <span className="w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{task.title}</p>
                {task.assignee && <p className="text-xs text-slate-400 truncate">{task.assignee.name}</p>}
              </div>
            </div>
            <div className="flex-1 relative" style={{ height: 36 }}>
              {tStyle && tColor && (
                <div
                  className={`absolute ${tColor} rounded-sm`}
                  style={{ ...tStyle, top: 14, height: 8 }}
                  title={`${task.actual_start ? new Date(task.actual_start).toLocaleDateString() : 'Not started'} → ${task.actual_end ? new Date(task.actual_end).toLocaleDateString() : task.actual_start ? 'In progress' : '—'}`}
                />
              )}
              {todayLeft >= 0 && todayLeft <= 100 && <div className="absolute top-0 bottom-0 w-px bg-blue-500 opacity-30 z-10" style={{ left: `${todayLeft}%` }} />}
              {deadlineLeft >= 0 && deadlineLeft <= 100 && <div className="absolute top-0 bottom-0 z-10" style={{ left: `${deadlineLeft}%`, width: 1, borderLeft: '1px dashed #94a3b8' }} />}
            </div>
          </div>
        )
      })}
    </>
  )
}

export default function GanttChart({ project, deliverables, modules, embedded }: Props) {
  const [collapsedModules, setCollapsedModules] = useState<Set<number>>(new Set())

  function toggleModule(id: number) {
    setCollapsedModules(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const deadline = new Date(project.deadline)

  if (deliverables.length === 0) {
    return (
      <div className={embedded ? 'p-8 text-center' : 'bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-10 text-center'}>
        <p className="text-slate-400 dark:text-slate-500 text-sm">No deliverables added to this project yet.</p>
        <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">Add deliverables below to populate the Gantt chart.</p>
      </div>
    )
  }

  const { rangeStart, rangeEnd, totalDays } = computeRange(deliverables, project.start_date, project.deadline)
  const ticks = generateTicks(rangeStart, rangeEnd, totalDays)
  const today = new Date()
  const todayLeft = dateToPercent(today, rangeStart, totalDays)
  const deadlineLeft = dateToPercent(deadline, rangeStart, totalDays)

  const LABEL_W = 240

  // Group deliverables by module_id
  const deliverablesByModule = new Map<number, GanttDeliverable[]>()
  const ungrouped: GanttDeliverable[] = []
  for (const d of deliverables) {
    if (d.module_id) {
      if (!deliverablesByModule.has(d.module_id)) deliverablesByModule.set(d.module_id, [])
      deliverablesByModule.get(d.module_id)!.push(d)
    } else {
      ungrouped.push(d)
    }
  }

  const totalTasks = deliverables.reduce((s, d) => s + d.tasks.length, 0)

  return (
    <div className={embedded ? 'overflow-hidden' : 'bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden'}>
      {/* Legend */}
      <div className="flex items-center gap-5 px-5 py-3 border-b border-slate-200 dark:border-navy-700 flex-wrap">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Actual Work Timeline</span>
        <div className="flex items-center gap-4 ml-auto flex-wrap">
          {[
            { color: 'bg-slate-300 dark:bg-slate-600', label: 'Planned' },
            { color: 'bg-green-500',   label: 'Done (On Time)' },
            { color: 'bg-red-500',     label: 'Done (Late)' },
            { color: 'bg-emerald-400', label: 'In Progress' },
            { color: 'bg-pink-400',    label: 'In Progress (Past Deadline)' },
          ].map(item => (
            <span key={item.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className={`inline-block w-4 h-3 rounded-sm ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 900 }}>
          {/* Header ticks */}
          <div className="flex border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
            <div className="shrink-0 flex items-end px-3 pb-2 text-xs font-medium text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-navy-700" style={{ width: LABEL_W }}>
              Module / Deliverable / Task
            </div>
            <div className="flex-1 relative h-10">
              {ticks.map((tick, i) => (
                <div key={i} className="absolute top-0 h-full flex flex-col items-center" style={{ left: `${tick.left}%` }}>
                  <div className="w-px h-2 bg-slate-300 dark:bg-slate-600 mt-1" />
                  {tick.label && <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap mt-0.5 -translate-x-1/2">{tick.label}</span>}
                </div>
              ))}
              {todayLeft >= 0 && todayLeft <= 100 && <div className="absolute top-0 bottom-0 w-px bg-blue-500 opacity-60" style={{ left: `${todayLeft}%` }} />}
              {deadlineLeft >= 0 && deadlineLeft <= 100 && (
                <div className="absolute top-0 flex flex-col items-center" style={{ left: `${deadlineLeft}%` }}>
                  <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap -translate-x-1/2 mt-0.5 font-medium">Deadline</span>
                </div>
              )}
            </div>
          </div>

          {/* Modules with their deliverables */}
          {modules.map(mod => {
            const modDeliverables = deliverablesByModule.get(mod.id) ?? []
            if (modDeliverables.length === 0) return null
            const isCollapsed = collapsedModules.has(mod.id)
            const doneTasks = modDeliverables.reduce((s, d) => s + d.tasks.filter(t => t.status === 'Done').length, 0)
            const totalModTasks = modDeliverables.reduce((s, d) => s + d.tasks.length, 0)

            return (
              <div key={mod.id}>
                {/* Module header row */}
                <div className="flex border-b border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20">
                  <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-r border-blue-200 dark:border-blue-900/50" style={{ width: LABEL_W }}>
                    <button onClick={() => toggleModule(mod.id)} className="text-blue-400 hover:text-blue-600 text-xs w-4 shrink-0">
                      {isCollapsed ? '▶' : '▼'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 truncate">{mod.title}</p>
                      <p className="text-xs text-blue-400">{modDeliverables.length} deliverable{modDeliverables.length !== 1 ? 's' : ''} · {doneTasks}/{totalModTasks} tasks done</p>
                    </div>
                  </div>
                  {/* Module span bar */}
                  <div className="flex-1 relative" style={{ height: 44 }}>
                    {(() => {
                      const starts = modDeliverables.map(d => d.actual_start).filter(Boolean).map(s => new Date(s!).getTime())
                      const ends = modDeliverables.map(d => d.actual_end).filter(Boolean).map(e => new Date(e!).getTime())
                      if (starts.length === 0) return <div className="absolute inset-0 flex items-center pl-3"><span className="text-xs text-slate-300 dark:text-slate-600 italic">Not started</span></div>
                      const spanStart = new Date(Math.min(...starts))
                      const spanEnd = ends.length > 0 ? new Date(Math.max(...ends)) : today
                      const s = barStyle(spanStart, spanEnd, rangeStart, totalDays)
                      return s ? (
                        <div className="absolute bg-blue-300/60 dark:bg-blue-700/40 rounded-sm" style={{ ...s, top: 16, height: 10 }} title={`${spanStart.toLocaleDateString()} → ${spanEnd.toLocaleDateString()}`} />
                      ) : null
                    })()}
                    {todayLeft >= 0 && todayLeft <= 100 && <div className="absolute top-0 bottom-0 w-px bg-blue-500 opacity-40 z-10" style={{ left: `${todayLeft}%` }} />}
                    {deadlineLeft >= 0 && deadlineLeft <= 100 && <div className="absolute top-0 bottom-0 z-10" style={{ left: `${deadlineLeft}%`, width: 1, borderLeft: '1px dashed #94a3b8' }} />}
                  </div>
                </div>

                {/* Deliverables inside module */}
                {!isCollapsed && modDeliverables.map(d => (
                  <DeliverableRow
                    key={d.id}
                    deliverable={d}
                    deadline={deadline}
                    rangeStart={rangeStart}
                    totalDays={totalDays}
                    todayLeft={todayLeft}
                    deadlineLeft={deadlineLeft}
                    indent
                  />
                ))}
              </div>
            )
          })}

          {/* Ungrouped deliverables */}
          {ungrouped.length > 0 && (
            <>
              {modules.length > 0 && (
                <div className="flex border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50">
                  <div className="shrink-0 px-3 py-2 border-r border-slate-200 dark:border-navy-700 text-xs font-medium text-slate-500 dark:text-slate-400" style={{ width: LABEL_W }}>
                    Ungrouped
                  </div>
                  <div className="flex-1" />
                </div>
              )}
              {ungrouped.map(d => (
                <DeliverableRow
                  key={d.id}
                  deliverable={d}
                  deadline={deadline}
                  rangeStart={rangeStart}
                  totalDays={totalDays}
                  todayLeft={todayLeft}
                  deadlineLeft={deadlineLeft}
                />
              ))}
            </>
          )}

          {/* Footer */}
          <div className="flex border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
            <div className="shrink-0 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-navy-700" style={{ width: LABEL_W }}>
              {deliverables.length} deliverable{deliverables.length !== 1 ? 's' : ''} · {totalTasks} task{totalTasks !== 1 ? 's' : ''}
              {modules.length > 0 && ` · ${modules.length} module${modules.length !== 1 ? 's' : ''}`}
            </div>
            <div className="flex-1 py-2 px-3">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Project deadline: {deadline.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                &nbsp;·&nbsp;
                Today: {today.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
