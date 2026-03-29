import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const featureId = searchParams.get('feature_id')
  if (!featureId) return NextResponse.json({ error: 'feature_id required' }, { status: 400 })

  const tasks = await prisma.task.findMany({
    where: { feature_id: Number(featureId) },
    include: {
      assignee: { select: { id: true, name: true } },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const body = await req.json()
  const { feature_id, title, description, assigned_to } = body

  if (!feature_id || !title) {
    return NextResponse.json({ error: 'feature_id and title are required' }, { status: 400 })
  }

  // Members can only create tasks assigned to themselves
  const resolvedAssignee = user.role === 'manager'
    ? (assigned_to ? Number(assigned_to) : null)
    : Number(user.id)

  const maxOrderResult = await prisma.task.aggregate({
    where: { feature_id: Number(feature_id) },
    _max: { order: true },
  })
  const nextOrder = (maxOrderResult._max.order ?? 0) + 1

  const task = await prisma.task.create({
    data: {
      feature_id: Number(feature_id),
      title,
      description: description || null,
      assigned_to: resolvedAssignee,
      order: nextOrder,
      is_predefined: false,
      status: 'Todo',
    },
    include: {
      assignee: { select: { id: true, name: true } },
      feature: { select: { id: true, title: true, project: { select: { id: true, title: true } } } },
    },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'CREATE',
      target_type: 'Task',
      target_id: task.id,
      metadata: { title: task.title, feature_id: task.feature_id },
    },
  })

  return NextResponse.json(task, { status: 201 })
}
