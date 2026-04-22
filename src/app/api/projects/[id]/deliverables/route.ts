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
        include: {
          assignees: { include: { user: { select: { id: true, name: true } } } },
          _count: { select: { issues: { where: { issue_status: { notIn: ['resolved', 'closed'] } } } } },
        },
        orderBy: { order: 'asc' },
      },
      module: { select: { id: true, title: true } },
      _count: { select: { issues: { where: { issue_status: { notIn: ['resolved', 'closed'] } } } } },
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

  const projectId = Number(id)
  const body = await req.json()
  const { title, description, mandays, planned_start, planned_end, priority } = body

  const trimmedTitle = String(title ?? '').trim()
  if (!trimmedTitle) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!planned_start || !planned_end) {
    return NextResponse.json({ error: 'Planned Start and Planned End are required' }, { status: 400 })
  }

  const plannedStartDate = new Date(planned_start)
  const plannedEndDate = new Date(planned_end)
  if (isNaN(plannedStartDate.getTime()) || isNaN(plannedEndDate.getTime())) {
    return NextResponse.json({ error: 'Invalid planned date format' }, { status: 400 })
  }
  if (plannedStartDate > plannedEndDate) {
    return NextResponse.json({ error: 'Planned Start cannot be after Planned End' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { start_date: true, deadline: true },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  if (plannedStartDate < project.start_date || plannedEndDate > project.deadline) {
    return NextResponse.json({ error: 'Planned dates must be within project start and deadline' }, { status: 400 })
  }

  const maxOrder = await prisma.deliverable.aggregate({
    where: { project_id: projectId },
    _max: { order: true },
  })
  const nextOrder = (maxOrder._max.order ?? 0) + 1

  const deliverable = await prisma.deliverable.create({
    data: {
      project_id: projectId,
      module_id: null,
      title: trimmedTitle,
      description: description || null,
      mandays: Number(mandays) || 0,
      priority: priority || 'medium',
      planned_start: plannedStartDate,
      planned_end: plannedEndDate,
      order: nextOrder,
    },
  })

  return NextResponse.json({ ...deliverable, tasks: [], module: null }, { status: 201 })
}
