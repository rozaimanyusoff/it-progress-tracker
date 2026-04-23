import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  const weeksParam = Number(searchParams.get('weeks') ?? 4)
  const offsetWeeksParam = Number(searchParams.get('offset_weeks') ?? 0)
  const weeksCount = Number.isFinite(weeksParam) ? Math.min(Math.max(Math.trunc(weeksParam), 4), 52) : 4
  const offsetWeeksRequested = Number.isFinite(offsetWeeksParam) ? Math.max(Math.trunc(offsetWeeksParam), 0) : 0

  // Include tasks linked via feature OR via deliverable (kanban-created tasks land on deliverables)
  const taskWhere = projectId
    ? {
        OR: [
          { feature: { project_links: { some: { project_id: Number(projectId) } } } },
          { deliverable: { project_id: Number(projectId) } },
        ],
      }
    : {}

  const featureAssignWhere = projectId
    ? { feature: { project_links: { some: { project_id: Number(projectId) } } } }
    : {}

  // Managers: include all active assignees in the scoped project (including managers).
  // Non-managers: only see their own analytics.
  const userWhere =
    user.role === 'manager'
      ? (projectId
          ? {
              is_active: true,
              role: { in: [Role.member, Role.manager] },
              OR: [
                // Users explicitly assigned at project level
                { project_assignments: { some: { project_id: Number(projectId) } } },
                // Users assigned to at least one task scoped to this project
                { task_assignees: { some: { task: taskWhere } } },
              ],
            }
          : { is_active: true, role: { in: [Role.member, Role.manager] } })
      : { id: Number(user.id), is_active: true }

  const now = new Date()

  function fmtWeekRange(start: Date, endExclusive: Date) {
    const endInclusive = new Date(endExclusive)
    endInclusive.setDate(endInclusive.getDate() - 1)
    const s = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    const e = endInclusive.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    return `${s} - ${e}`
  }

  let projectStartDate: Date | null = null
  if (projectId) {
    const project = await prisma.project.findUnique({
      where: { id: Number(projectId) },
      select: { start_date: true },
    })
    projectStartDate = project?.start_date ?? null
  }

  const timelineStart = projectStartDate ? new Date(projectStartDate) : (() => {
    const d = new Date(now)
    d.setDate(now.getDate() - 180)
    return d
  })()
  timelineStart.setHours(0, 0, 0, 0)

  const timelineEnd = new Date(now)
  timelineEnd.setHours(0, 0, 0, 0)

  const allWeeks: Array<{ start: Date; end: Date; label: string }> = []
  const cursor = new Date(timelineStart)
  while (cursor <= timelineEnd) {
    const start = new Date(cursor)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    allWeeks.push({ start, end, label: fmtWeekRange(start, end) })
    cursor.setDate(cursor.getDate() + 7)
  }

  const totalWeeks = Math.max(allWeeks.length, 1)
  const effectiveWeeksCount = Math.min(weeksCount, totalWeeks)
  const maxOffsetWeeks = Math.max(totalWeeks - effectiveWeeksCount, 0)
  const offsetWeeks = Math.min(offsetWeeksRequested, maxOffsetWeeks)
  const startIdx = Math.max(totalWeeks - effectiveWeeksCount - offsetWeeks, 0)
  const endIdx = startIdx + effectiveWeeksCount
  const weeks = allWeeks.slice(startIdx, endIdx)

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      task_assignees: {
        where: { task: taskWhere },
        select: {
          task: {
            select: {
              id: true,
              status: true,
              actual_start: true,
              actual_end: true,
              completed_at: true,
              created_at: true,
              est_mandays: true,
              feature: {
                select: { mandays: true },
              },
            },
          },
        },
      },
      feature_assignments: {
        where: featureAssignWhere,
        select: {
          feature: { select: { mandays: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const today = new Date()

  const developers = users.map((u) => {
    const tasks = u.task_assignees.map((ta) => ta.task)
    const tasksDone = tasks.filter((t) => t.status === 'Done').length
    const tasksInProgress = tasks.filter(
      (t) => t.status === 'InProgress' || t.status === 'InReview'
    ).length

    // Sum task-level est_mandays (new granular estimate); fall back to feature-level mandays if no task-level data
    const taskEstMandays = tasks.reduce(
      (sum: number, t) => sum + (t.est_mandays != null ? Number(t.est_mandays) : 0),
      0
    )
    const featureEstMandays = u.feature_assignments.reduce(
      (sum: number, fa) => sum + fa.feature.mandays,
      0
    )
    const estimatedMandays = taskEstMandays > 0 ? taskEstMandays : featureEstMandays

    const totalSpentDays = tasks
      .filter((t) => t.actual_start && t.actual_end)
      .reduce((sum: number, t) => {
        const diff =
          new Date(t.actual_end!).getTime() - new Date(t.actual_start!).getTime()
        return sum + diff / (1000 * 60 * 60 * 24)
      }, 0)

    // Weekly trend: tasks assigned/started per week (prefer backdated actual_start).
    const weeklyTasksTrend = weeks.map((w) => ({
      week: w.label,
      count: tasks.filter((t) => {
        const started = t.actual_start ? new Date(t.actual_start) : new Date(t.created_at)
        return started >= w.start && started < w.end
      }).length,
    }))

    // Weekly trend: tasks completed per week (prefer actual_end because it carries backdated completion date).
    const weeklyCompletedTrend = weeks.map((w) => ({
      week: w.label,
      count: tasks.filter((t) => {
        const completedDate = t.actual_end ? new Date(t.actual_end) : (t.completed_at ? new Date(t.completed_at) : null)
        return t.status === 'Done' && completedDate && completedDate >= w.start && completedDate < w.end
      }).length,
    }))

    // Weekly trend: time spent per week (hours), distributed by overlap with each week window.
    const weeklyTimeTrend = weeks.map((w) => ({
      week: w.label,
      hours: Math.round(
        tasks
          .filter((t) => t.actual_start && t.actual_end)
          .reduce((sum: number, t) => {
            const start = new Date(t.actual_start!)
            const end = new Date(t.actual_end!)
            const overlapStart = Math.max(start.getTime(), w.start.getTime())
            const overlapEnd = Math.min(end.getTime(), w.end.getTime())
            if (overlapEnd <= overlapStart) return sum
            const diff = overlapEnd - overlapStart
            return sum + diff / (1000 * 60 * 60)
          }, 0) * 10
      ) / 10,
    }))

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      tasksAssigned: tasks.length,
      tasksDone,
      tasksInProgress,
      estimatedMandays,
      totalSpentDays: Math.round(totalSpentDays * 10) / 10,
      weeklyTasksTrend,
      weeklyCompletedTrend,
      weeklyTimeTrend,
    }
  })

  void today

  return NextResponse.json({
    developers,
    weeks_count: effectiveWeeksCount,
    offset_weeks: offsetWeeks,
    max_offset_weeks: maxOffsetWeeks,
    has_older: startIdx > 0,
    has_newer: endIdx < totalWeeks,
    project_start_date: projectStartDate ? projectStartDate.toISOString() : null,
    timeline_start_date: timelineStart.toISOString(),
    timeline_end_date: timelineEnd.toISOString(),
  })
}
