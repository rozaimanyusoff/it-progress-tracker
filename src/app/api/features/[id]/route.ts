import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const featureId = Number(id)

  const existing = await prisma.feature.findUnique({ where: { id: featureId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updateData: any = {}
  if (body.title !== undefined) updateData.title = body.title
  if (body.description !== undefined) updateData.description = body.description || null
  if (body.mandays !== undefined) updateData.mandays = Number(body.mandays)
  if (body.status !== undefined) updateData.status = body.status
  if (body.planned_start !== undefined) updateData.planned_start = new Date(body.planned_start)
  if (body.planned_end !== undefined) updateData.planned_end = new Date(body.planned_end)

  const feature = await prisma.feature.update({
    where: { id: featureId },
    data: updateData,
    include: {
      developers: { include: { user: { select: { id: true, name: true } } } },
      tasks: { select: { status: true } },
    },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'UPDATE',
      target_type: 'Feature',
      target_id: feature.id,
      metadata: { changes: body },
    },
  })

  return NextResponse.json(feature)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const featureId = Number(params.id)
  const existing = await prisma.feature.findUnique({ where: { id: featureId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.feature.delete({ where: { id: featureId } })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'DELETE',
      target_type: 'Feature',
      target_id: featureId,
      metadata: { title: existing.title },
    },
  })

  return NextResponse.json({ success: true })
}
