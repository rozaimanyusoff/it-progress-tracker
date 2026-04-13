import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTaskAssigned } from '@/lib/email'

const ASSIGNEE_INCLUDE = {
  assignees: { include: { user: { select: { id: true, name: true } } } },
} as const

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
      ...ASSIGNEE_INCLUDE,
      _count: { select: { issues: { where: { issue_status: { notIn: ['resolved', 'closed'] } } } } },
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
  const { feature_id, deliverable_id, title, description, assignee_ids, due_date, est_mandays, priority } = body

  if ((!feature_id && !deliverable_id) || !title) {
    return NextResponse.json({ error: 'feature_id or deliverable_id, and title are required' }, { status: 400 })
  }

  // Managers can assign to anyone; members auto-assign to themselves + any additional partners
  const resolvedIds: number[] = user.role === 'manager'
    ? (assignee_ids ?? []).map(Number)
    : [Number(user.id), ...((assignee_ids ?? []).map(Number).filter((id: number) => id !== Number(user.id)))]

  const whereClause = feature_id ? { feature_id: Number(feature_id) } : { deliverable_id: Number(deliverable_id) }

  const maxOrderResult = await prisma.task.aggregate({
    where: whereClause,
    _max: { order: true },
  })
  const nextOrder = (maxOrderResult._max.order ?? 0) + 1

  // Auto-inherit due_date from deliverable.planned_end if not provided
  let resolvedDueDate: Date | null = null
  if (due_date) {
    resolvedDueDate = new Date(due_date)
  } else if (deliverable_id) {
    const deliv = await prisma.deliverable.findUnique({
      where: { id: Number(deliverable_id) },
      select: { planned_end: true },
    })
    resolvedDueDate = deliv?.planned_end ?? null
  }

  const task = await prisma.task.create({
    data: {
      ...(feature_id ? { feature_id: Number(feature_id) } : { deliverable_id: Number(deliverable_id) }),
      title,
      description: description || null,
      order: nextOrder,
      is_predefined: false,
      status: 'Todo',
      due_date: resolvedDueDate,
      est_mandays: est_mandays != null ? est_mandays : null,
      priority: priority || 'medium',
      assignees: resolvedIds.length > 0
        ? { create: resolvedIds.map(uid => ({ user_id: uid })) }
        : undefined,
    },
    include: {
      ...ASSIGNEE_INCLUDE,
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

  // Notify assignees when manager creates and assigns a task
  if (user.role === 'manager' && resolvedIds.length > 0) {
    for (const uid of resolvedIds) {
      const assignee = await prisma.user.findUnique({
        where: { id: uid },
        select: { email: true, name: true },
      })
      if (assignee) {
        sendTaskAssigned(assignee.email, assignee.name, task.title).catch(() => { })
      }
    }
  }

  return NextResponse.json(task, { status: 201 })
}
