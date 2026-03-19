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

interface GanttFeature {
  id: number
  title: string
  status: string
  mandays: number
  planned_start: string
  planned_end: string
  actual_start: string | null
  actual_end: string | null
  isDelayed: boolean
  tasks: GanttTask[]
}

interface GanttProject {
  id: number
  title: string
  start_date: string
  deadline: string
}

interface Props {
  project: GanttProject
  features: GanttFeature[]
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
  const barStart = start
  const barEnd = end ?? fallbackEnd ?? new Date()
  const left = dateToPercent(barStart, rangeStart, totalDays)
  const right = dateToPercent(barEnd, rangeStart, totalDays)
  const width = Math.max(0.5, right - left)
  return { left: `${left}%`, width: `${width}%` }
}

function actualBarColor(
  actualStart: string | null,
  actualEnd: string | null,
  plannedEnd: string
): string {
  if (!actualStart) return ''
  const today = new Date()
  const pEnd = new Date(plannedEnd)
  if (actualEnd) {
    return new Date(actualEnd) <= pEnd ? 'bg-green-500' : 'bg-red-500'
  }
  return today > pEnd ? 'bg-pink-400' : 'bg-emerald-400'
}

function taskBarColor(
  actualStart: string | null,
  actualEnd: string | null,
  featurePlannedEnd: string
): string {
  if (!actualStart) return ''
  const today = new Date()
  const pEnd = new Date(featurePlannedEnd)
  if (actualEnd) {
    return new Date(actualEnd) <= pEnd ? 'bg-green-400' : 'bg-red-400'
  }
  return today > pEnd ? 'bg-pink-300' : 'bg-emerald-300'
}

function computeRange(features: GanttFeature[], projectDeadline: string) {
  const today = new Date()
  const allDates: Date[] = [today, new Date(projectDeadline)]

  for (const f of features) {
    allDates.push(new Date(f.planned_start), new Date(f.planned_end))
    if (f.actual_start) allDates.push(new Date(f.actual_start))
    if (f.actual_end) allDates.push(new Date(f.actual_end))
    for (const t of f.tasks) {
      if (t.actual_start) allDates.push(new Date(t.actual_start))
      if (t.actual_end) allDates.push(new Date(t.actual_end))
    }
  }

  const minTime = Math.min(...allDates.map((d) => d.getTime()))
  const maxTime = Math.max(...allDates.map((d) => d.getTime()))
  const pad = (maxTime - minTime) * 0.05 || MS_PER_DAY * 2

  const rangeStart = new Date(minTime - pad)
  const rangeEnd = new Date(maxTime + pad)
  const totalDays = (rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY

  return { rangeStart, rangeEnd, totalDays }
}

function generateTicks(
  rangeStart: Date,
  rangeEnd: Date,
  totalDays: number
): { date: Date; left: number; label: string | null }[] {
  const ticks: { date: Date; left: number; label: string | null }[] = []
  const useWeeks = totalDays >= 30

  if (useWeeks) {
    // Start from the Monday on or after rangeStart
    const current = new Date(rangeStart)
    const day = current.getDay()
    const daysToMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day
    current.setDate(current.getDate() + daysToMonday)
    current.setHours(0, 0, 0, 0)

    while (current <= rangeEnd) {
      ticks.push({
        date: new Date(current),
        left: dateToPercent(current, rangeStart, totalDays),
        label: current.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' }),
      })
      current.setDate(current.getDate() + 7)
    }
  } else {
    const current = new Date(rangeStart)
    current.setDate(current.getDate() + 1)
    current.setHours(0, 0, 0, 0)
    let dayCount = 0

    while (current <= rangeEnd) {
      ticks.push({
        date: new Date(current),
        left: dateToPercent(current, rangeStart, totalDays),
        label:
          dayCount % 7 === 0
            ? current.toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })
            : null,
      })
      current.setDate(current.getDate() + 1)
      dayCount++
    }
  }

  return ticks
}

const STATUS_BADGE: Record<string, string> = {
  Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  InProgress: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  OnHold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

export default function GanttChart({ project, features }: Props) {
  const [expandedFeatures, setExpandedFeatures] = useState<Set<number>>(new Set())

  function toggleFeature(id: number) {
    setExpandedFeatures((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (features.length === 0) {
    return (
      <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400">No features added to this project yet.</p>
      </div>
    )
  }

  const { rangeStart, rangeEnd, totalDays } = computeRange(features, project.deadline)
  const ticks = generateTicks(rangeStart, rangeEnd, totalDays)
  const today = new Date()
  const todayLeft = dateToPercent(today, rangeStart, totalDays)
  const deadlineLeft = dateToPercent(new Date(project.deadline), rangeStart, totalDays)

  const LABEL_W = 200 // px — fixed left column width

  return (
    <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
      {/* Legend */}
      <div className="flex items-center gap-5 px-5 py-3 border-b border-slate-200 dark:border-navy-700 flex-wrap">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Work Timeline — Planned vs Actual</span>
        <div className="flex items-center gap-4 ml-auto flex-wrap">
          {[
            { color: 'bg-amber-400', label: 'Planned' },
            { color: 'bg-green-500', label: 'Actual (On Time)' },
            { color: 'bg-red-500', label: 'Delayed (Done Late)' },
            { color: 'bg-pink-400', label: 'Still Running (Past Deadline)' },
            { color: 'bg-emerald-400', label: 'In Progress' },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className={`inline-block w-4 h-3 rounded-sm ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Scrollable Gantt body */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: '900px' }}>

          {/* Header: label col + tick marks */}
          <div className="flex border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
            {/* Label column header */}
            <div
              className="shrink-0 flex items-end px-3 pb-2 text-xs font-medium text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-navy-700"
              style={{ width: LABEL_W }}
            >
              Feature / Task
            </div>

            {/* Tick marks area */}
            <div className="flex-1 relative h-10">
              {ticks.map((tick, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full flex flex-col items-center"
                  style={{ left: `${tick.left}%` }}
                >
                  <div className="w-px h-2 bg-slate-300 dark:bg-slate-600 mt-1" />
                  {tick.label && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap mt-0.5 -translate-x-1/2">
                      {tick.label}
                    </span>
                  )}
                </div>
              ))}

              {/* Today marker in header */}
              {todayLeft >= 0 && todayLeft <= 100 && (
                <div
                  className="absolute top-0 bottom-0 flex flex-col items-center"
                  style={{ left: `${todayLeft}%` }}
                >
                  <div className="w-px h-full bg-blue-500 opacity-60" />
                </div>
              )}

              {/* Deadline marker label in header */}
              {deadlineLeft >= 0 && deadlineLeft <= 100 && (
                <div
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: `${deadlineLeft}%` }}
                >
                  <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap -translate-x-1/2 mt-0.5 font-medium">
                    Deadline
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Feature rows */}
          {features.map((feature) => {
            const isExpanded = expandedFeatures.has(feature.id)
            const plannedStyle = barStyle(
              new Date(feature.planned_start),
              new Date(feature.planned_end),
              rangeStart,
              totalDays
            )
            const actualColor = actualBarColor(
              feature.actual_start,
              feature.actual_end,
              feature.planned_end
            )
            const actualStyle = barStyle(
              feature.actual_start ? new Date(feature.actual_start) : null,
              feature.actual_end ? new Date(feature.actual_end) : null,
              rangeStart,
              totalDays,
              today
            )

            return (
              <div key={feature.id}>
                {/* Feature row */}
                <div className="flex border-b border-slate-100 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-700/30 transition-colors">
                  {/* Label */}
                  <div
                    className="shrink-0 flex items-center gap-2 px-3 py-1 border-r border-slate-200 dark:border-navy-700"
                    style={{ width: LABEL_W }}
                  >
                    <button
                      onClick={() => toggleFeature(feature.id)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs w-4 shrink-0"
                      title={isExpanded ? 'Collapse tasks' : 'Expand tasks'}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{feature.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`inline-block px-1.5 py-px rounded text-xs font-medium ${STATUS_BADGE[feature.status]}`}>
                          {feature.status === 'InProgress' ? 'In Progress' : feature.status}
                        </span>
                        <span className="text-xs text-slate-400">{feature.mandays}md</span>
                      </div>
                    </div>
                  </div>

                  {/* Bar area */}
                  <div className="flex-1 relative" style={{ height: 56 }}>
                    {/* Planned bar */}
                    {plannedStyle && (
                      <div
                        className="absolute bg-amber-400 rounded-sm flex items-center"
                        style={{ ...plannedStyle, top: 8, height: 12 }}
                        title={`Planned: ${new Date(feature.planned_start).toLocaleDateString()} → ${new Date(feature.planned_end).toLocaleDateString()}`}
                      >
                        <span className="text-xs text-amber-900 px-1 truncate select-none" style={{ fontSize: 9 }}>Planned</span>
                      </div>
                    )}

                    {/* Actual bar */}
                    {actualStyle && actualColor && (
                      <div
                        className={`absolute ${actualColor} rounded-sm flex items-center`}
                        style={{ ...actualStyle, top: 26, height: 12 }}
                        title={`Actual: ${feature.actual_start ? new Date(feature.actual_start).toLocaleDateString() : 'Not started'} → ${feature.actual_end ? new Date(feature.actual_end).toLocaleDateString() : 'In progress'}`}
                      >
                        <span className="text-xs px-1 truncate text-white select-none" style={{ fontSize: 9 }}>Actual</span>
                      </div>
                    )}

                    {/* Delayed badge */}
                    {feature.isDelayed && (
                      <div
                        className="absolute flex items-center"
                        style={{ top: 20, left: actualStyle ? `calc(${actualStyle.left} + ${actualStyle.width} + 4px)` : `${deadlineLeft}%` }}
                      >
                        <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-px rounded font-medium whitespace-nowrap">
                          ⚠ Delayed
                        </span>
                      </div>
                    )}

                    {/* Today vertical line */}
                    {todayLeft >= 0 && todayLeft <= 100 && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-blue-500 opacity-40 z-10"
                        style={{ left: `${todayLeft}%` }}
                      />
                    )}

                    {/* Deadline vertical line */}
                    {deadlineLeft >= 0 && deadlineLeft <= 100 && (
                      <div
                        className="absolute top-0 bottom-0 z-10"
                        style={{ left: `${deadlineLeft}%`, width: 1, borderLeft: '1px dashed #94a3b8' }}
                      />
                    )}
                  </div>
                </div>

                {/* Task sub-rows */}
                {isExpanded &&
                  feature.tasks.map((task) => {
                    const tColor = taskBarColor(
                      task.actual_start,
                      task.actual_end,
                      feature.planned_end
                    )
                    const tStyle = barStyle(
                      task.actual_start ? new Date(task.actual_start) : null,
                      task.actual_end ? new Date(task.actual_end) : null,
                      rangeStart,
                      totalDays,
                      today
                    )

                    return (
                      <div
                        key={task.id}
                        className="flex border-b border-slate-100 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-900/20"
                      >
                        {/* Task label */}
                        <div
                          className="shrink-0 flex items-center gap-2 px-3 py-1 border-r border-slate-200 dark:border-navy-700"
                          style={{ width: LABEL_W }}
                        >
                          <span className="w-4 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{task.title}</p>
                            {task.assignee && (
                              <p className="text-xs text-slate-400 truncate">{task.assignee.name}</p>
                            )}
                          </div>
                        </div>

                        {/* Task bar area */}
                        <div className="flex-1 relative" style={{ height: 40 }}>
                          {tStyle && tColor && (
                            <div
                              className={`absolute ${tColor} rounded-sm`}
                              style={{ ...tStyle, top: 14, height: 8 }}
                              title={`${task.title}: ${task.actual_start ? new Date(task.actual_start).toLocaleDateString() : 'Not started'} → ${task.actual_end ? new Date(task.actual_end).toLocaleDateString() : task.actual_start ? 'In progress' : '—'}`}
                            />
                          )}

                          {/* Today line */}
                          {todayLeft >= 0 && todayLeft <= 100 && (
                            <div
                              className="absolute top-0 bottom-0 w-px bg-blue-500 opacity-30 z-10"
                              style={{ left: `${todayLeft}%` }}
                            />
                          )}

                          {/* Deadline line */}
                          {deadlineLeft >= 0 && deadlineLeft <= 100 && (
                            <div
                              className="absolute top-0 bottom-0 z-10"
                              style={{ left: `${deadlineLeft}%`, width: 1, borderLeft: '1px dashed #94a3b8' }}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )
          })}

          {/* Footer: summary line */}
          <div className="flex border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900">
            <div
              className="shrink-0 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-navy-700"
              style={{ width: LABEL_W }}
            >
              {features.length} feature{features.length !== 1 ? 's' : ''} · {features.reduce((s, f) => s + f.tasks.length, 0)} tasks
            </div>
            <div className="flex-1 relative py-2 px-3">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Project deadline: {new Date(project.deadline).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
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
