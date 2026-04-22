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

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  // Mandays guard — required + budget cap when linked to deliverable
  if (deliverable_id) {
    if (est_mandays == null || Number(est_mandays) <= 0) {
      return NextResponse.json({ error: 'Est. mandays is required when linked to a deliverable.' }, { status: 400 })
    }
    const deliv = await prisma.deliverable.findUnique({
      where: { id: Number(deliverable_id) },
      select: { mandays: true, tasks: { select: { est_mandays: true } } },
    })
    if (deliv && deliv.mandays > 0) {
      const used = deliv.tasks.reduce((s, t) => s + (t.est_mandays ? Number(t.est_mandays) : 0), 0)
      const remaining = deliv.mandays - used
      if (Number(est_mandays) > remaining) {
        return NextResponse.json({
          error: `Est. mandays (${est_mandays} md) exceeds remaining budget (${remaining} of ${deliv.mandays} md available).`,
        }, { status: 422 })
      }
    }
  }

  // Managers can assign to anyone; members auto-assign to themselves + any additional partners
  let resolvedIds: number[] = user.role === 'manager'
    ? (assignee_ids ?? []).map(Number)
    : [Number(user.id), ...((assignee_ids ?? []).map(Number).filter((id: number) => id !== Number(user.id)))]
  if (!feature_id && !deliverable_id && resolvedIds.length === 0) {
    // Ensure standalone tasks still show up for creator when no explicit assignee is selected.
    resolvedIds = [Number(user.id)]
  }

  const whereClause = feature_id
    ? { feature_id: Number(feature_id) }
    : deliverable_id
      ? { deliverable_id: Number(deliverable_id) }
      : { feature_id: null, deliverable_id: null }

  const maxOrderResult = await prisma.task.aggregate({
    where: whereClause,
    _max: { order: true },
  })
  const nextOrder = (maxOrderResult._max.order ?? 0) + 1

  // Linked tasks always inherit predefined values from deliverable.
  // Standalone tasks can define due date / priority manually.
  let resolvedDueDate: Date | null = null
  let resolvedPriority: string = priority || 'medium'
  if (deliverable_id) {
    const deliv = await prisma.deliverable.findUnique({
      where: { id: Number(deliverable_id) },
      select: { planned_end: true, priority: true },
    })
    resolvedDueDate = deliv?.planned_end ?? null
    resolvedPriority = deliv?.priority ?? 'medium'
  } else if (due_date) {
    resolvedDueDate = new Date(due_date)
  }

  const relationData: { feature_id?: number; deliverable_id?: number } = {}
  if (feature_id) relationData.feature_id = Number(feature_id)
  if (deliverable_id) relationData.deliverable_id = Number(deliverable_id)

  const task = await prisma.task.create({
    data: {
      ...relationData,
      title,
      description: description || null,
      order: nextOrder,
      is_predefined: false,
      status: 'Todo',
      due_date: resolvedDueDate,
      est_mandays: est_mandays != null ? est_mandays : null,
      priority: resolvedPriority as any,
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
