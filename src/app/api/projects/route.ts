import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const where = user.role === 'manager'
    ? {}
    : { assignees: { some: { user_id: Number(user.id) } } }

  const projects = await prisma.project.findMany({
    where,
    include: {
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      updates: { orderBy: { created_at: 'desc' }, take: 1 },
      _count: { select: { issues: { where: { resolved: false } } } },
    },
    orderBy: { created_at: 'desc' },
  })

  // Compute task-based progress for each project (same logic as project detail page)
  type TaskCount = { project_id: number; total: bigint; done: bigint }
  const projectIds = projects.map(p => p.id)
  const taskCounts = projectIds.length > 0
    ? await prisma.$queryRaw<TaskCount[]>(
        Prisma.sql`
          SELECT d.project_id, COUNT(t.id) AS total,
                 COUNT(CASE WHEN t.status = 'Done' THEN 1 END) AS done
          FROM "Deliverable" d
          INNER JOIN "Task" t ON t.deliverable_id = d.id
          WHERE d.project_id = ANY(ARRAY[${Prisma.join(projectIds)}]::int[])
          GROUP BY d.project_id
        `
      )
    : []

  const taskMap = new Map(taskCounts.map(r => [Number(r.project_id), r]))

  // Compute monthly assigned + completed tasks per project (from start_date to deadline)
  type MonthlyAssigned = { project_id: bigint; month: string; assigned: bigint }
  type MonthlyCompleted = { project_id: bigint; month: string; completed: bigint }

  const [monthlyAssignedRows, monthlyCompletedRows] = projectIds.length > 0
    ? await Promise.all([
      prisma.$queryRaw<MonthlyAssigned[]>(
        Prisma.sql`
            SELECT d.project_id,
                   TO_CHAR(DATE_TRUNC('month', t.created_at), 'YYYY-MM') AS month,
                   COUNT(t.id) AS assigned
            FROM "Task" t
            INNER JOIN "Deliverable" d ON t.deliverable_id = d.id
            WHERE d.project_id = ANY(ARRAY[${Prisma.join(projectIds)}]::int[])
            GROUP BY d.project_id, DATE_TRUNC('month', t.created_at)
          `
      ),
      prisma.$queryRaw<MonthlyCompleted[]>(
        Prisma.sql`
            SELECT d.project_id,
                   TO_CHAR(DATE_TRUNC('month', COALESCE(t.actual_end, t.completed_at)), 'YYYY-MM') AS month,
                   COUNT(t.id) AS completed
            FROM "Task" t
            INNER JOIN "Deliverable" d ON t.deliverable_id = d.id
            WHERE t.status = 'Done'
              AND COALESCE(t.actual_end, t.completed_at) IS NOT NULL
              AND d.project_id = ANY(ARRAY[${Prisma.join(projectIds)}]::int[])
            GROUP BY d.project_id, DATE_TRUNC('month', COALESCE(t.actual_end, t.completed_at))
          `
      ),
    ])
    : [[], []]

  const monthlyAssignedMap = new Map<number, Map<string, number>>()
  for (const row of monthlyAssignedRows) {
    const pid = Number(row.project_id)
    if (!monthlyAssignedMap.has(pid)) monthlyAssignedMap.set(pid, new Map())
    monthlyAssignedMap.get(pid)!.set(row.month, Number(row.assigned))
  }

  const monthlyCompletedMap = new Map<number, Map<string, number>>()
  for (const row of monthlyCompletedRows) {
    const pid = Number(row.project_id)
    if (!monthlyCompletedMap.has(pid)) monthlyCompletedMap.set(pid, new Map())
    monthlyCompletedMap.get(pid)!.set(row.month, Number(row.completed))
  }

  function getMonthLabels(start: Date, end: Date): string[] {
    const labels: string[] = []
    const cur = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cur <= last) {
      labels.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
      cur.setMonth(cur.getMonth() + 1)
    }
    return labels
  }

  function getPlannedProgress(start: Date, end: Date, now: Date): number {
    const totalMs = end.getTime() - start.getTime()
    if (totalMs <= 0) return 0
    const elapsedMs = now.getTime() - start.getTime()
    if (elapsedMs <= 0) return 0
    if (elapsedMs >= totalMs) return 100
    return Math.round((elapsedMs / totalMs) * 100)
  }

  function monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  function endOfMonth(month: string): Date {
    const [yy, mm] = month.split('-').map(Number)
    return new Date(yy, mm, 0, 23, 59, 59, 999)
  }

  const tasks = projectIds.length > 0
    ? await prisma.task.findMany({
        where: {
          deliverable: { project_id: { in: projectIds } },
        },
        select: {
          id: true,
          created_at: true,
          due_date: true,
          status: true,
          actual_end: true,
          completed_at: true,
          deliverable: { select: { project_id: true } },
        },
      })
    : []

  const tasksByProject = new Map<number, typeof tasks>()
  for (const t of tasks) {
    const pid = t.deliverable?.project_id
    if (!pid) continue
    if (!tasksByProject.has(pid)) tasksByProject.set(pid, [])
    tasksByProject.get(pid)!.push(t)
  }

  const now = new Date()
  const result = projects.map(p => {
    const stats = taskMap.get(p.id)
    const computedProgress = stats && Number(stats.total) > 0
      ? Math.round(Number(stats.done) / Number(stats.total) * 100)
      : (p.updates[0]?.progress_pct ?? 0)
    const computedStatus = (() => {
      if (p.status === 'OnHold') return 'OnHold'
      if (computedProgress >= 100) return 'Done'
      if (computedProgress > 0) return 'InProgress'
      return p.status
    })()
    const monthLabels = getMonthLabels(p.start_date, p.deadline)
    const monthSet = new Set(monthLabels)
    const projectTasks = tasksByProject.get(p.id) ?? []
    const onTimeCompletedMap = new Map<string, number>()
    const lateCompletedMap = new Map<string, number>()
    const overdueOpenMap = new Map<string, number>()

    for (const t of projectTasks) {
      const doneAt = (t.actual_end ?? t.completed_at) ?? null
      if (t.status === 'Done' && doneAt) {
        const doneMonth = monthKey(doneAt)
        if (!monthSet.has(doneMonth)) continue
        if (t.due_date && doneAt > t.due_date) {
          lateCompletedMap.set(doneMonth, (lateCompletedMap.get(doneMonth) ?? 0) + 1)
        } else {
          onTimeCompletedMap.set(doneMonth, (onTimeCompletedMap.get(doneMonth) ?? 0) + 1)
        }
      }
    }

    for (const m of monthLabels) {
      const monthEnd = endOfMonth(m)
      let overdueOpen = 0
      for (const t of projectTasks) {
        if (!t.due_date) continue
        if (t.created_at > monthEnd) continue
        const doneAt = (t.actual_end ?? t.completed_at) ?? null
        if (t.due_date <= monthEnd && (!doneAt || doneAt > monthEnd)) overdueOpen += 1
      }
      overdueOpenMap.set(m, overdueOpen)
    }

    const monthlyData = monthLabels.map(m => ({
      monthKey: m,
      month: new Date(m + '-02').toLocaleDateString('en-MY', { month: 'short', year: '2-digit' }),
      assigned: monthlyAssignedMap.get(p.id)?.get(m) ?? 0,
      completed: monthlyCompletedMap.get(p.id)?.get(m) ?? 0,
      onTimeCompleted: onTimeCompletedMap.get(m) ?? 0,
      lateCompleted: lateCompletedMap.get(m) ?? 0,
      overdueOpen: overdueOpenMap.get(m) ?? 0,
    }))

    const totalOnTimeCompleted = monthlyData.reduce((s, m) => s + m.onTimeCompleted, 0)
    const totalLateCompleted = monthlyData.reduce((s, m) => s + m.lateCompleted, 0)
    const totalCompletedWithTiming = totalOnTimeCompleted + totalLateCompleted
    const onTimeCompletionRate = totalCompletedWithTiming > 0
      ? Math.round((totalOnTimeCompleted / totalCompletedWithTiming) * 100)
      : null

    // Scope volatility: tasks introduced after a 14-day baseline window from project start.
    const baselineCutoff = new Date(p.start_date.getTime() + 14 * 86400000)
    const baselineTaskCount = projectTasks.filter(t => t.created_at <= baselineCutoff).length
    const addedAfterBaselineCount = projectTasks.filter(t => t.created_at > baselineCutoff).length
    const totalScopeCount = baselineTaskCount + addedAfterBaselineCount
    const scopeVolatility = totalScopeCount > 0
      ? Math.round((addedAfterBaselineCount / totalScopeCount) * 100)
      : null

    const totalAssigned = monthlyData.reduce((s, m) => s + m.assigned, 0)
    const totalCompleted = monthlyData.reduce((s, m) => s + m.completed, 0)
    const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : null
    const netFlow = totalCompleted - totalAssigned
    const latestOverdueOpen = monthlyData.length > 0 ? (monthlyData[monthlyData.length - 1].overdueOpen ?? 0) : 0
    const scheduleVariance = computedProgress - getPlannedProgress(p.start_date, p.deadline, now)
    const isOverdue = computedStatus !== 'Done' && p.deadline < now
    const computedHealthStatus = (() => {
      if (computedStatus === 'Done') return null
      if (isOverdue) return 'overdue'
      if (scheduleVariance <= -20 || latestOverdueOpen >= 3) return 'delayed'
      if (
        scheduleVariance <= -5 ||
        netFlow < 0 ||
        latestOverdueOpen > 0 ||
        (completionRate !== null && completionRate < 80)
      ) return 'at_risk'
      return 'on_track'
    })()

    return {
      ...p,
      computedProgress,
      computedStatus,
      computedHealthStatus,
      onTimeCompletionRate,
      scopeVolatility,
      monthlyData,
      burndownTasks: projectTasks.map(t => ({
        id: t.id,
        status: t.status,
        actual_end: (t.actual_end ?? t.completed_at)?.toISOString() ?? null,
      })),
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const body = await req.json()
  const assigneeIds: number[] = (body.assignee_ids ?? []).map(Number)

  const project = await prisma.project.create({
    data: {
      title: body.title,
      description: body.description,
      start_date: new Date(body.start_date),
      deadline: new Date(body.deadline),
      status: body.status || 'Pending',
      category: body.category || 'NonClaimable',
      unit_id: body.unit_id ?? null,
      dept_id: body.dept_id ?? null,
      company_id: body.company_id ?? null,
      assignees: {
        create: assigneeIds.map(uid => ({ user_id: uid })),
      },
    },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'CREATE',
      target_type: 'Project',
      target_id: project.id,
      metadata: { title: project.title },
    },
  })

  return NextResponse.json(project, { status: 201 })
}
