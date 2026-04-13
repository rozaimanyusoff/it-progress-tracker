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

  if (projectId) {
    // Return features linked to a project, with module_id from ProjectFeature
    const links = await prisma.projectFeature.findMany({
      where: { project_id: Number(projectId) },
      include: {
        feature: {
          include: {
            developers: { include: { user: { select: { id: true, name: true, email: true } } } },
            tasks: { select: { status: true } },
            created_by: { select: { id: true, name: true } },
          },
        },
        module: { select: { id: true, title: true } },
      },
      orderBy: { feature: { order: 'asc' } },
    })

    const features = links.map(l => ({
      ...l.feature,
      module_id: l.module_id,
      module: l.module,
    }))
    return NextResponse.json(features)
  }

  // Return all standalone features (catalog)
  const features = await prisma.feature.findMany({
    include: {
      developers: { include: { user: { select: { id: true, name: true, email: true } } } },
      tasks: { select: { status: true } },
      created_by: { select: { id: true, name: true } },
      project_links: { include: { project: { select: { id: true, title: true } } } },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(features)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const body = await req.json()
  const { title, description, mandays, developer_ids = [] } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const maxOrderResult = await prisma.feature.aggregate({ _max: { order: true } })
  const nextOrder = (maxOrderResult._max.order ?? 0) + 1

  const feature = await prisma.$transaction(async (tx) => {
    const created = await tx.feature.create({
      data: {
        title,
        description: description || null,
        mandays: Number(mandays) || 0,
        order: nextOrder,
        created_by_id: Number(user.id),
      },
    })

    if (developer_ids.length > 0) {
      await tx.featureDeveloper.createMany({
        data: developer_ids.map((uid: number) => ({ feature_id: created.id, user_id: Number(uid) })),
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
      metadata: { title: feature.title },
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
