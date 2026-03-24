import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const where = user.role === 'manager' ? {} : { owner_id: Number(user.id) }

  const projects = await prisma.project.findMany({
    where,
    include: {
      unit: true,
      owner: { select: { id: true, name: true, email: true } },
      updates: { orderBy: { created_at: 'desc' }, take: 1 },
      _count: { select: { issues: { where: { resolved: false } } } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, description, category, unit_id, owner_id, start_date, deadline, status, member_ids = [] } = body

  if (!title || !unit_id || !owner_id || !start_date || !deadline) {
    return NextResponse.json({ error: 'title, unit_id, owner_id, start_date, deadline are required' }, { status: 400 })
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        title,
        description: description || null,
        category: category || null,
        unit_id: Number(unit_id),
        owner_id: Number(owner_id),
        start_date: new Date(start_date),
        deadline: new Date(deadline),
        status: status || 'Pending',
      },
    })

    if (member_ids.length > 0) {
      await tx.projectMember.createMany({
        data: member_ids.map((uid: number) => ({
          project_id: created.id,
          user_id: Number(uid),
        })),
        skipDuplicates: true,
      })
    }

    return created
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'CREATE',
      target_type: 'Project',
      target_id: project.id,
      metadata: { title: project.title, category: project.category },
    },
  })

  return NextResponse.json(project, { status: 201 })
}
