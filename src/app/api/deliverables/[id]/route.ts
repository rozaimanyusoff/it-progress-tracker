import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      title: true,
      mandays: true,
      tasks: { select: { est_mandays: true } },
    },
  })

  if (!deliverable) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const used_mandays = deliverable.tasks.reduce(
    (sum, t) => sum + (t.est_mandays ? Number(t.est_mandays) : 0),
    0
  )

  return NextResponse.json({
    id: deliverable.id,
    title: deliverable.title,
    mandays: deliverable.mandays,
    used_mandays,
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, description, mandays, status, module_id, planned_start, planned_end, actual_start, actual_end, is_actual_override, order } = body

  const updated = await prisma.deliverable.update({
    where: { id: Number(id) },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(mandays !== undefined && { mandays: Number(mandays) }),
      ...(status !== undefined && { status }),
      ...(module_id !== undefined && { module_id: module_id ? Number(module_id) : null }),
      ...(planned_start !== undefined && { planned_start: planned_start ? new Date(planned_start) : null }),
      ...(planned_end !== undefined && { planned_end: planned_end ? new Date(planned_end) : null }),
      ...(actual_start !== undefined && { actual_start: actual_start ? new Date(actual_start) : null }),
      ...(actual_end !== undefined && { actual_end: actual_end ? new Date(actual_end) : null }),
      ...(is_actual_override !== undefined && { is_actual_override }),
      ...(order !== undefined && { order: Number(order) }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const deliverableId = Number(id)

  const deliverable = await prisma.deliverable.findUnique({ where: { id: deliverableId }, select: { title: true, project_id: true } })
  if (!deliverable) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const taskCount = await prisma.task.count({ where: { deliverable_id: deliverableId } })
  if (taskCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete deliverable "${deliverable.title}" — it still has ${taskCount} task(s). Remove all tasks first.` },
      { status: 409 }
    )
  }

  await prisma.deliverable.delete({ where: { id: deliverableId } })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'DELETE',
      target_type: 'Deliverable',
      target_id: deliverableId,
      metadata: { title: deliverable.title, project_id: deliverable.project_id },
    },
  })

  return NextResponse.json({ ok: true })
}
