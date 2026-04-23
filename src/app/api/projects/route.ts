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
    const monthlyData = monthLabels.map(m => ({
      month: new Date(m + '-02').toLocaleDateString('en-MY', { month: 'short', year: '2-digit' }),
      assigned: monthlyAssignedMap.get(p.id)?.get(m) ?? 0,
      completed: monthlyCompletedMap.get(p.id)?.get(m) ?? 0,
    }))
    return { ...p, computedProgress, computedStatus, monthlyData }
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
