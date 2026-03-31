import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTaskAssigned } from '@/lib/email'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const featureId = searchParams.get('feature_id')
  const deliverableId = searchParams.get('deliverable_id')

  if (!featureId && !deliverableId) {
    return NextResponse.json({ error: 'feature_id or deliverable_id required' }, { status: 400 })
  }

  const where = featureId
    ? { feature_id: Number(featureId) }
    : { deliverable_id: Number(deliverableId) }

  const tasks = await prisma.task.findMany({
    where,
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
  const { feature_id, deliverable_id, title, description, assigned_to } = body

  if ((!feature_id && !deliverable_id) || !title) {
    return NextResponse.json({ error: 'feature_id or deliverable_id, and title are required' }, { status: 400 })
  }

  const resolvedAssignee = user.role === 'manager'
    ? (assigned_to ? Number(assigned_to) : null)
    : Number(user.id)

  const whereClause = feature_id ? { feature_id: Number(feature_id) } : { deliverable_id: Number(deliverable_id) }

  const maxOrderResult = await prisma.task.aggregate({
    where: whereClause,
    _max: { order: true },
  })
  const nextOrder = (maxOrderResult._max.order ?? 0) + 1

  const task = await prisma.task.create({
    data: {
      ...(feature_id ? { feature_id: Number(feature_id) } : { deliverable_id: Number(deliverable_id) }),
      title,
      description: description || null,
      assigned_to: resolvedAssignee,
      order: nextOrder,
      is_predefined: false,
      status: 'Todo',
    },
    include: {
      assignee: { select: { id: true, name: true } },
    },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'CREATE',
      target_type: 'Task',
      target_id: task.id,
      metadata: { title: task.title, feature_id: task.feature_id, deliverable_id: task.deliverable_id },
    },
  })

  // Notify the assignee when a manager creates and assigns a task
  if (user.role === 'manager' && resolvedAssignee) {
    const assignee = await prisma.user.findUnique({
      where: { id: resolvedAssignee },
      select: { email: true, name: true },
    })
    if (assignee) {
      sendTaskAssigned(assignee.email, assignee.name, task.title).catch(() => { })
    }
  }

  return NextResponse.json(task, { status: 201 })
}
