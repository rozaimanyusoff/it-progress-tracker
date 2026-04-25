import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import AppLayout from '@/components/Layout'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any

  const projects = await prisma.project.findMany({
    where: user.role === 'manager'
      ? {}
      : { assignees: { some: { user_id: Number(user.id) } } },
    include: {
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      updates: { orderBy: { created_at: 'desc' }, take: 1 },
      _count: {
        select: {
          issues: { where: { resolved: false } },
          deliverables: true,
        },
      },
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
                   TO_CHAR(DATE_TRUNC('month', COALESCE(t.completed_at, t.actual_end)), 'YYYY-MM') AS month,
                   COUNT(t.id) AS completed
            FROM "Task" t
            INNER JOIN "Deliverable" d ON t.deliverable_id = d.id
            WHERE t.status = 'Done'
              AND COALESCE(t.completed_at, t.actual_end) IS NOT NULL
              AND d.project_id = ANY(ARRAY[${Prisma.join(projectIds)}]::int[])
            GROUP BY d.project_id, DATE_TRUNC('month', COALESCE(t.completed_at, t.actual_end))
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

  const tasks = projectIds.length > 0
    ? await prisma.task.findMany({
        where: {
          deliverable: { project_id: { in: projectIds } },
        },
        select: {
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
  const projectsWithProgress = projects.map(p => {
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
    const monthlyData = monthLabels.map(m => ({
      month: new Date(m + '-02').toLocaleDateString('en-MY', { month: 'short', year: '2-digit' }),
      assigned: monthlyAssignedMap.get(p.id)?.get(m) ?? 0,
      completed: monthlyCompletedMap.get(p.id)?.get(m) ?? 0,
    }))
    const projectTasks = tasksByProject.get(p.id) ?? []
    const totalAssigned = monthlyData.reduce((s, m) => s + m.assigned, 0)
    const totalCompleted = monthlyData.reduce((s, m) => s + m.completed, 0)
    const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : null
    const netFlow = totalCompleted - totalAssigned
    const backlogTrend = netFlow > 0 ? 'Shrinking' : netFlow < 0 ? 'Growing' : 'Stable'

    const totalOnTimeCompleted = projectTasks.filter(t => {
      if (t.status !== 'Done') return false
      const doneAt = t.actual_end ?? t.completed_at
      if (!doneAt) return false
      if (!t.due_date) return true
      return doneAt <= t.due_date
    }).length
    const totalLateCompleted = projectTasks.filter(t => {
      if (t.status !== 'Done') return false
      const doneAt = t.actual_end ?? t.completed_at
      if (!doneAt || !t.due_date) return false
      return doneAt > t.due_date
    }).length
    const timedCompleted = totalOnTimeCompleted + totalLateCompleted
    const onTimeCompletionRate = timedCompleted > 0 ? Math.round((totalOnTimeCompleted / timedCompleted) * 100) : null

    const baselineCutoff = new Date(p.start_date.getTime() + 14 * 86400000)
    const baselineTaskCount = projectTasks.filter(t => t.created_at <= baselineCutoff).length
    const addedAfterBaselineCount = projectTasks.filter(t => t.created_at > baselineCutoff).length
    const totalScopeCount = baselineTaskCount + addedAfterBaselineCount
    const scopeVolatility = totalScopeCount > 0 ? Math.round((addedAfterBaselineCount / totalScopeCount) * 100) : null

    const latestOverdueOpen = projectTasks.filter(t => {
      if (!t.due_date) return false
      const doneAt = t.actual_end ?? t.completed_at
      return t.due_date <= now && (!doneAt || doneAt > now)
    }).length
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
      totalDeliverables: p._count.deliverables,
      totalTasks: stats ? Number(stats.total) : 0,
      doneTasks: stats ? Number(stats.done) : 0,
      scheduleVariance,
      computedHealthStatus,
      completionRate,
      netFlow,
      backlogTrend,
      onTimeCompletionRate,
      scopeVolatility,
      monthlyData,
    }
  })

  const assignedProjectIds = projects
    .filter((p) => p.assignees.some((a) => a.user_id === Number(user.id)))
    .map((p) => p.id)
  const assignedProjectIdSet = new Set(assignedProjectIds)
  const assignedProjects = projectsWithProgress.filter((p) => assignedProjectIdSet.has(p.id))

  const teamTasks = assignedProjectIds.length > 0
    ? await prisma.task.findMany({
        where: {
          assignees: { some: { user_id: Number(user.id) } },
          OR: [
            { deliverable: { project_id: { in: assignedProjectIds } } },
            { feature: { project_links: { some: { project_id: { in: assignedProjectIds } } } } },
          ],
        },
        select: {
          status: true,
          due_date: true,
          actual_end: true,
          completed_at: true,
          est_mandays: true,
          is_blocked: true,
        },
      })
    : []

  const teamDoneTasks = teamTasks.filter((t) => t.status === 'Done').length
  const teamTimedDoneTasks = teamTasks.filter((t) => t.status === 'Done' && (t.actual_end || t.completed_at))
  const teamOnTimeDoneTasks = teamTimedDoneTasks.filter((t) => {
    const doneAt = t.actual_end ?? t.completed_at
    if (!doneAt) return false
    if (!t.due_date) return true
    return doneAt <= t.due_date
  }).length
  const teamSummary = {
    assignedProjectCount: assignedProjects.length,
    activeProjectCount: assignedProjects.filter((p) => p.computedStatus !== 'Done' && p.computedStatus !== 'OnHold').length,
    doneProjectCount: assignedProjects.filter((p) => p.computedStatus === 'Done').length,
    avgProjectProgress: assignedProjects.length > 0
      ? Math.round(assignedProjects.reduce((sum, p) => sum + (p.computedProgress ?? 0), 0) / assignedProjects.length)
      : 0,
    totalTasks: teamTasks.length,
    todoTasks: teamTasks.filter((t) => t.status === 'Todo').length,
    inProgressTasks: teamTasks.filter((t) => t.status === 'InProgress').length,
    reviewTasks: teamTasks.filter((t) => t.status === 'InReview').length,
    blockedTasks: teamTasks.filter((t) => t.status === 'Blocked' || t.is_blocked).length,
    doneTasks: teamDoneTasks,
    overdueTasks: teamTasks.filter((t) => {
      if (!t.due_date || t.status === 'Done') return false
      return t.due_date < now
    }).length,
    estimatedMandays: Math.round(teamTasks.reduce((sum, t) => sum + (t.est_mandays != null ? Number(t.est_mandays) : 0), 0) * 10) / 10,
    completionRate: teamTasks.length > 0 ? Math.round((teamDoneTasks / teamTasks.length) * 100) : null,
    onTimeRate: teamTimedDoneTasks.length > 0 ? Math.round((teamOnTimeDoneTasks / teamTimedDoneTasks.length) * 100) : null,
  }

  return (
    <AppLayout>
      <DashboardClient
        projects={JSON.parse(JSON.stringify(projectsWithProgress))}
        teamProjects={JSON.parse(JSON.stringify(assignedProjects))}
        teamSummary={JSON.parse(JSON.stringify(teamSummary))}
        session={JSON.parse(JSON.stringify(session))}
      />
    </AppLayout>
  )
}
