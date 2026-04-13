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
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(modules)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const body = await req.json()
  const { project_id, title, description, start_date, end_date } = body
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
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'CREATE',
      target_type: 'Module',
      target_id: module.id,
      metadata: { title: module.title },
    },
  })

  return NextResponse.json(module, { status: 201 })
}
