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
  const userId = (session.user as any).id
  const body = await req.json()
  const { notes, media_urls = [], mark_complete } = body

  // Fetch current task
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (task.assigned_to !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Determine new status
  let newStatus = task.status
  if (mark_complete) {
    newStatus = 'InReview'
  } else if (task.status === 'Todo') {
    newStatus = 'InProgress'
  }

  // Create update record
  const update = await prisma.taskUpdate.create({
    data: { task_id: taskId, user_id: userId, notes, media_urls },
    include: { user: { select: { id: true, name: true } } },
  })

  // Update task status if changed
  if (newStatus !== task.status) {
    const now = new Date()
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: newStatus as any,
        actual_start: task.actual_start ?? (newStatus === 'InProgress' ? now : undefined),
        actual_end: newStatus === 'InReview' || newStatus === 'Done' ? now : undefined,
      },
    })
  }

  return NextResponse.json({ update, newStatus })
}
