import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const assigneeIds: number[] = (body.assignee_ids ?? []).map(Number)

  const project = await prisma.project.create({
    data: {
      title: body.title,
      description: body.description,
      start_date: new Date(body.start_date),
      deadline: new Date(body.deadline),
      status: body.status || 'Pending',
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
