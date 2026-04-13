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
    return { ...p, computedProgress, computedStatus, monthlyData }
  })

  return (
    <AppLayout>
      <DashboardClient projects={JSON.parse(JSON.stringify(projectsWithProgress))} session={JSON.parse(JSON.stringify(session))} />
    </AppLayout>
  )
}
