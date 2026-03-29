import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const modules = await prisma.module.findMany({
    where: { project_id: Number(projectId) },
    include: {
      features: {
        include: {
          developers: { include: { user: { select: { id: true, name: true } } } },
          tasks: {
            include: { assignee: { select: { id: true, name: true } } },
            orderBy: { order: 'asc' },
          },
          created_by: { select: { id: true, name: true } },
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(modules)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { project_id, title, description } = body
  if (!project_id || !title) return NextResponse.json({ error: 'project_id and title required' }, { status: 400 })

  const maxOrder = await prisma.module.aggregate({
    where: { project_id: Number(project_id) },
    _max: { order: true },
  })

  const module = await prisma.module.create({
    data: {
      project_id: Number(project_id),
      title,
      description: description || null,
      order: (maxOrder._max.order ?? 0) + 1,
    },
    include: { features: true },
  })

  return NextResponse.json(module, { status: 201 })
}
