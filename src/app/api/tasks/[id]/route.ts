import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function recalculateFeatureDates(featureId: number) {
  const allTasks = await prisma.task.findMany({ where: { feature_id: featureId } })

  const starts = allTasks.map((t) => t.actual_start).filter(Boolean) as Date[]
  const newActualStart =
    starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null

  const allDone = allTasks.every((t) => t.status === 'Done')
  const ends = allTasks.map((t) => t.actual_end).filter(Boolean) as Date[]
  const newActualEnd =
    allDone && ends.length === allTasks.length
      ? new Date(Math.max(...ends.map((d) => d.getTime())))
      : null

  await prisma.feature.update({
    where: { id: featureId },
    data: { actual_start: newActualStart, actual_end: newActualEnd },
  })
}

async function recalculateDeliverableDates(deliverableId: number) {
  const allTasks = await prisma.task.findMany({ where: { deliverable_id: deliverableId } })
  if (allTasks.length === 0) return

  const starts = allTasks.map((t) => t.actual_start).filter(Boolean) as Date[]
  const newActualStart = starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null

  const allDone = allTasks.every((t) => t.status === 'Done')
  const anyActive = allTasks.some((t) => t.status === 'InProgress' || t.status === 'InReview')
  const ends = allTasks.map((t) => t.actual_end).filter(Boolean) as Date[]
  const newActualEnd =
    allDone && ends.length === allTasks.length
      ? new Date(Math.max(...ends.map((d) => d.getTime())))
      : null

  const newStatus = allDone ? 'Done' : anyActive ? 'InProgress' : 'Pending'

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { actual_start: newActualStart, actual_end: newActualEnd, status: newStatus },
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const taskId = Number(id)
  const body = await req.json()

  const existing = await prisma.task.findUnique({ where: { id: taskId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Member can only update status on their own assigned task
  if (user.role === 'member') {
    if (existing.assigned_to !== Number(user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const allowedKeys = ['status']
    const disallowedKeys = Object.keys(body).filter((k) => !allowedKeys.includes(k))
    if (disallowedKeys.length > 0) {
      return NextResponse.json({ error: 'Members can only update task status' }, { status: 403 })
    }
  }

  const updateData: any = {}

  if (user.role === 'manager') {
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description || null
    if ('assigned_to' in body) updateData.assigned_to = body.assigned_to ? Number(body.assigned_to) : null
    if (body.order !== undefined) updateData.order = Number(body.order)
  }

  if (body.status !== undefined) {
    updateData.status = body.status
    const prevStatus = existing.status
    const newStatus = body.status

    // ── Time tracking ──────────────────────────────────────────────
    // Entering InProgress: start the timer
    if (newStatus === 'InProgress' && prevStatus !== 'InProgress') {
      updateData.time_started_at = new Date()
    }

    // Leaving InProgress: accumulate elapsed seconds and clear start
    if (prevStatus === 'InProgress' && newStatus !== 'InProgress' && existing.time_started_at) {
      const elapsed = Math.floor((Date.now() - existing.time_started_at.getTime()) / 1000)
      updateData.time_spent_seconds = (existing.time_spent_seconds ?? 0) + elapsed
      updateData.time_started_at = null
    }

    // ── actual_start / actual_end (for feature date roll-up) ───────
    if (newStatus === 'InProgress' && !existing.actual_start) {
      updateData.actual_start = new Date()
    }
    if (newStatus === 'Done' && !existing.actual_end) {
      updateData.actual_end = new Date()
    }
    if (prevStatus === 'Done' && newStatus !== 'Done') {
      updateData.actual_end = null
    }
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
    include: { assignee: { select: { id: true, name: true } } },
  })

  // Recalculate parent dates after task status change
  if (body.status !== undefined) {
    if (task.feature_id != null) await recalculateFeatureDates(task.feature_id)
    if (task.deliverable_id != null) await recalculateDeliverableDates(task.deliverable_id)
  }

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'UPDATE',
      target_type: 'Task',
      target_id: task.id,
      metadata: {
        old_status: existing.status,
        new_status: body.status ?? existing.status,
      },
    },
  })

  return NextResponse.json(task)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const taskId = Number(id)
  const existing = await prisma.task.findUnique({ where: { id: taskId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (existing.is_predefined) {
    return NextResponse.json({ error: 'Predefined SDLC tasks cannot be deleted' }, { status: 400 })
  }

  if (existing.status !== 'Todo') {
    return NextResponse.json({ error: 'Only Todo tasks can be deleted' }, { status: 403 })
  }

  if (user.role !== 'manager' && existing.assigned_to !== Number(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.task.delete({ where: { id: taskId } })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'DELETE',
      target_type: 'Task',
      target_id: taskId,
      metadata: { title: existing.title },
    },
  })

  return NextResponse.json({ success: true })
}
