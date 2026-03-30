import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = Number(id)

  const deliverables = await prisma.deliverable.findMany({
    where: { project_id: projectId },
    include: {
      tasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { order: 'asc' },
      },
      module: { select: { id: true, title: true } },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(deliverables)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const projectId = Number(id)
  const body = await req.json()
  const { title, description, mandays, module_id, planned_start, planned_end } = body

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const maxOrder = await prisma.deliverable.aggregate({
    where: { project_id: projectId },
    _max: { order: true },
  })
  const nextOrder = (maxOrder._max.order ?? 0) + 1

  const deliverable = await prisma.deliverable.create({
    data: {
      project_id: projectId,
      module_id: module_id ? Number(module_id) : null,
      title,
      description: description || null,
      mandays: Number(mandays) || 0,
      planned_start: planned_start ? new Date(planned_start) : null,
      planned_end: planned_end ? new Date(planned_end) : null,
      order: nextOrder,
    },
  })

  return NextResponse.json({ ...deliverable, tasks: [], module: null }, { status: 201 })
}
