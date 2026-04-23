import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const taskId = Number(id)
  const [updates, reviewTransitions] = await prisma.$transaction([
    prisma.taskUpdate.findMany({
      where: { task_id: taskId },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { created_at: 'desc' },
    }),
    prisma.taskHistory.findMany({
      where: { task_id: taskId, to_status: 'InReview' },
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { created_at: 'desc' },
    }),
  ])

  const timeline = [
    ...updates.map((u) => ({
      ...u,
      entry_type: 'update' as const,
      event_label: null,
      actual_date: null as Date | null,
    })),
    ...reviewTransitions.map((h) => ({
      id: `history-${h.id}`,
      notes: h.note,
      media_urls: [] as string[],
      created_at: h.created_at,
      user: h.user,
      entry_type: 'status' as const,
      event_label: 'Moved to review',
      actual_date: h.actual_date,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json(timeline)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const taskId = Number(id)
  const userId = Number((session.user as any).id)
  const userRole = (session.user as any).role
  const body = await req.json()
  const { notes, media_urls = [], mark_complete, review_action, actual_mandays } = body

  // Fetch current task
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { assignees: true } })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // ── Manager review action ─────────────────────────────────────────
  if (review_action) {
    if (userRole !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (task.status !== 'InReview') return NextResponse.json({ error: 'Task is not in review' }, { status: 400 })
    if (review_action !== 'approve' && review_action !== 'reject') {
      return NextResponse.json({ error: 'Invalid review action' }, { status: 400 })
    }

    const now = new Date()
    const newStatus = review_action === 'approve' ? 'Done' : 'InProgress'
    const taskData: any = { status: newStatus, review_count: { increment: 1 } }

    if (review_action === 'approve') {
      // Preserve backdated completion date submitted when task moved to review.
      // Fallback to now only when no completion date exists yet.
      const effectiveCompletedAt = task.actual_end ?? now
      taskData.actual_end = effectiveCompletedAt
      taskData.completed_at = task.completed_at ?? effectiveCompletedAt
    } else {
      // Rejected → restart timer
      taskData.time_started_at = now
      taskData.actual_start = task.actual_start ?? now
    }

    await prisma.task.update({ where: { id: taskId }, data: taskData })

    const update = await prisma.taskUpdate.create({
      data: { task_id: taskId, user_id: userId, notes, media_urls },
      include: { user: { select: { id: true, name: true, role: true } } },
    })

    // Roll up deliverable status/dates after review
    if (task.deliverable_id != null) await recalculateDeliverableDates(task.deliverable_id)

    return NextResponse.json({ update, newStatus })
  }

  // ── Manager comment on Todo / InProgress tasks ───────────────────
  if (userRole === 'manager' && !review_action && (task.status === 'Todo' || task.status === 'InProgress')) {
    const update = await prisma.taskUpdate.create({
      data: { task_id: taskId, user_id: userId, notes, media_urls },
      include: { user: { select: { id: true, name: true, role: true } } },
    })
    return NextResponse.json({ update, newStatus: task.status })
  }

  // ── Developer update ──────────────────────────────────────────────
  if (!task.assignees.some((a: any) => a.user_id === userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Require actual_mandays when submitting for review
  if (mark_complete && task.status === 'InProgress') {
    if (actual_mandays == null || Number(actual_mandays) <= 0) {
      return NextResponse.json({ error: 'Actual mandays used is required before submitting for review.' }, { status: 400 })
    }
  }

  // Determine new status
  let newStatus = task.status
  if (mark_complete && task.status === 'InProgress') {
    newStatus = 'InReview'
  } else if (task.status === 'Todo') {
    newStatus = 'InProgress'
  }

  // Create update record
  const update = await prisma.taskUpdate.create({
    data: { task_id: taskId, user_id: userId, notes, media_urls },
    include: { user: { select: { id: true, name: true, role: true } } },
  })

  // Update task status + time tracking if status changed
  if (newStatus !== task.status) {
    const now = new Date()
    const taskData: any = {
      status: newStatus,
      actual_start: task.actual_start ?? (newStatus === 'InProgress' ? now : undefined),
    }

    // Todo → InProgress: start timer
    if (newStatus === 'InProgress') {
      taskData.time_started_at = now
    }

    // InProgress → InReview: accumulate elapsed time, stop timer, save actual_mandays
    if (task.status === 'InProgress' && newStatus === 'InReview') {
      if (task.time_started_at) {
        const elapsed = Math.floor((now.getTime() - task.time_started_at.getTime()) / 1000)
        taskData.time_spent_seconds = (task.time_spent_seconds ?? 0) + elapsed
      }
      taskData.time_started_at = null
      taskData.actual_mandays = actual_mandays
    }

    await prisma.task.update({ where: { id: taskId }, data: taskData })

    // Roll up deliverable status/dates after status change
    if (task.deliverable_id != null) await recalculateDeliverableDates(task.deliverable_id)
  }

  return NextResponse.json({ update, newStatus })
}
