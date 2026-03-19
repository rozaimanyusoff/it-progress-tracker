import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = Number(params.id)

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, start_date: true, deadline: true },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const features = await prisma.feature.findMany({
    where: { project_id: projectId },
    include: {
      tasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  })

  const today = new Date()

  const enrichedFeatures = features.map((f) => {
    const isDelayed = f.actual_end
      ? f.actual_end > f.planned_end
      : today > f.planned_end

    return {
      id: f.id,
      title: f.title,
      status: f.status,
      mandays: f.mandays,
      planned_start: f.planned_start.toISOString(),
      planned_end: f.planned_end.toISOString(),
      actual_start: f.actual_start?.toISOString() ?? null,
      actual_end: f.actual_end?.toISOString() ?? null,
      isDelayed,
      tasks: f.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        actual_start: t.actual_start?.toISOString() ?? null,
        actual_end: t.actual_end?.toISOString() ?? null,
        assigned_to: t.assigned_to,
        assignee: t.assignee,
      })),
    }
  })

  return NextResponse.json({
    project: {
      id: project.id,
      title: project.title,
      start_date: project.start_date.toISOString(),
      deadline: project.deadline.toISOString(),
    },
    features: enrichedFeatures,
  })
}
