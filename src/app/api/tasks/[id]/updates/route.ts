import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const updates = await prisma.taskUpdate.findMany({
    where: { task_id: Number(id) },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(updates)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const taskId = Number(id)
  const userId = Number((session.user as any).id)
  const userRole = (session.user as any).role
  const body = await req.json()
  const { notes, media_urls = [], mark_complete, review_action } = body

  // Fetch current task
  const task = await prisma.task.findUnique({ where: { id: taskId } })
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
    const taskData: any = { status: newStatus }

    if (review_action === 'approve') {
      taskData.actual_end = now
    } else {
      // Rejected → restart timer
      taskData.time_started_at = now
      taskData.actual_start = task.actual_start ?? now
    }

    await prisma.task.update({ where: { id: taskId }, data: taskData })

    const update = await prisma.taskUpdate.create({
      data: { task_id: taskId, user_id: userId, notes, media_urls },
      include: { user: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ update, newStatus })
  }

  // ── Developer update ──────────────────────────────────────────────
  if (task.assigned_to !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
    include: { user: { select: { id: true, name: true } } },
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

    // InProgress → InReview: accumulate elapsed time, stop timer
    if (task.status === 'InProgress' && newStatus === 'InReview') {
      if (task.time_started_at) {
        const elapsed = Math.floor((now.getTime() - task.time_started_at.getTime()) / 1000)
        taskData.time_spent_seconds = (task.time_spent_seconds ?? 0) + elapsed
      }
      taskData.time_started_at = null
    }

    await prisma.task.update({ where: { id: taskId }, data: taskData })
  }

  return NextResponse.json({ update, newStatus })
}
