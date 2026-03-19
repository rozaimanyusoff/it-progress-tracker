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

  const featureId = Number(id)
  const body = await req.json()
  const { developer_ids = [] } = body

  const existing = await prisma.feature.findUnique({ where: { id: featureId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    // Nullify tasks assigned to developers being removed
    const currentDevs = await tx.featureDeveloper.findMany({
      where: { feature_id: featureId },
      select: { user_id: true },
    })
    const removedDevIds = currentDevs
      .map((d) => d.user_id)
      .filter((id) => !developer_ids.includes(id))

    if (removedDevIds.length > 0) {
      await tx.task.updateMany({
        where: { feature_id: featureId, assigned_to: { in: removedDevIds } },
        data: { assigned_to: null },
      })
    }

    // Replace developer assignments
    await tx.featureDeveloper.deleteMany({ where: { feature_id: featureId } })

    if (developer_ids.length > 0) {
      await tx.featureDeveloper.createMany({
        data: developer_ids.map((uid: number) => ({
          feature_id: featureId,
          user_id: Number(uid),
        })),
      })
    }
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'UPDATE_DEVELOPERS',
      target_type: 'Feature',
      target_id: featureId,
      metadata: { developer_ids },
    },
  })

  const updated = await prisma.feature.findUnique({
    where: { id: featureId },
    include: {
      developers: { include: { user: { select: { id: true, name: true } } } },
    },
  })

  return NextResponse.json(updated)
}
