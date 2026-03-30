import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = Number(id)

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, start_date: true, deadline: true },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [modules, deliverables] = await Promise.all([
    prisma.module.findMany({
      where: { project_id: projectId },
      orderBy: { order: 'asc' },
      select: { id: true, title: true },
    }),
    prisma.deliverable.findMany({
      where: { project_id: projectId },
      include: {
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    }),
  ])

  return NextResponse.json({
    project: {
      id: project.id,
      title: project.title,
      start_date: project.start_date.toISOString(),
      deadline: project.deadline.toISOString(),
    },
    modules,
    deliverables: deliverables.map(d => ({
      id: d.id,
      title: d.title,
      status: d.status,
      mandays: d.mandays,
      planned_start: d.planned_start?.toISOString() ?? null,
      planned_end: d.planned_end?.toISOString() ?? null,
      actual_start: d.actual_start?.toISOString() ?? null,
      actual_end: d.actual_end?.toISOString() ?? null,
      module_id: d.module_id ?? null,
      tasks: d.tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        actual_start: t.actual_start?.toISOString() ?? null,
        actual_end: t.actual_end?.toISOString() ?? null,
        assigned_to: t.assigned_to,
        assignee: t.assignee,
      })),
    })),
  })
}
