import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({
    where: { id: Number(id) },
    include: {
      unit: true,
      owner: { select: { id: true, name: true, email: true } },
      updates: { include: { user: { select: { name: true } } }, orderBy: { created_at: 'desc' } },
      issues: { include: { user: { select: { name: true } } }, orderBy: { created_at: 'desc' } },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const project = await prisma.project.update({
    where: { id: Number(id) },
    data: {
      title: body.title,
      description: body.description,
      status: body.status,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
    },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'UPDATE',
      target_type: 'Project',
      target_id: project.id,
      metadata: { changes: body },
    },
  })

  return NextResponse.json(project)
}
