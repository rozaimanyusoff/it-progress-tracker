import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SDLC_TASKS } from '@/lib/sdlc-tasks'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const features = await prisma.feature.findMany({
    where: { project_id: Number(projectId) },
    include: {
      developers: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      tasks: { select: { status: true } },
      created_by: { select: { id: true, name: true } },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(features)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { project_id, title, description, mandays, planned_start, planned_end, developer_ids = [] } = body

  if (!project_id || !title || !planned_start || !planned_end) {
    return NextResponse.json({ error: 'project_id, title, planned_start, planned_end are required' }, { status: 400 })
  }

  const maxOrderResult = await prisma.feature.aggregate({
    where: { project_id: Number(project_id) },
    _max: { order: true },
  })
  const nextOrder = (maxOrderResult._max.order ?? 0) + 1

  const feature = await prisma.$transaction(async (tx) => {
    const created = await tx.feature.create({
      data: {
        project_id: Number(project_id),
        title,
        description: description || null,
        mandays: Number(mandays) || 0,
        planned_start: new Date(planned_start),
        planned_end: new Date(planned_end),
        order: nextOrder,
        created_by_id: Number(user.id),
      },
    })

    if (developer_ids.length > 0) {
      await tx.featureDeveloper.createMany({
        data: developer_ids.map((uid: number) => ({
          feature_id: created.id,
          user_id: Number(uid),
        })),
      })
    }

    await tx.task.createMany({
      data: SDLC_TASKS.map((t) => ({
        feature_id: created.id,
        title: t.title,
        order: t.order,
        is_predefined: true,
        status: 'Todo',
      })),
    })

    return created
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'CREATE',
      target_type: 'Feature',
      target_id: feature.id,
      metadata: { title: feature.title, project_id: feature.project_id },
    },
  })

  const result = await prisma.feature.findUnique({
    where: { id: feature.id },
    include: {
      developers: { include: { user: { select: { id: true, name: true } } } },
      tasks: true,
    },
  })

  return NextResponse.json(result, { status: 201 })
}
