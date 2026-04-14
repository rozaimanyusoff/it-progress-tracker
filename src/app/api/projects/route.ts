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
    return { ...p, computedProgress, computedStatus }
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
