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
  const module = await prisma.module.update({
    where: { id: Number(id) },
    data: {
      title: body.title,
      description: body.description ?? null,
    },
  })

  return NextResponse.json(module)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Unlink features from module (set module_id = null) before deleting
  await prisma.feature.updateMany({
    where: { module_id: Number(id) },
    data: { module_id: null },
  })

  await prisma.module.delete({ where: { id: Number(id) } })

  return NextResponse.json({ success: true })
}
