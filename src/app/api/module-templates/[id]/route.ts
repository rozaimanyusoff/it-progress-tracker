import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { display_name, description, icon } = await req.json()
  if (!display_name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const template = await prisma.moduleTemplate.update({
    where: { id: Number(id) },
    data: {
      display_name: display_name.trim(),
      description: description?.trim() || null,
      icon: icon?.trim() || null,
    },
    include: {
      deliverables: { orderBy: { sort_order: 'asc' }, include: { tasks: { orderBy: { sort_order: 'asc' } } } },
    },
  })

  return NextResponse.json(template)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.moduleTemplate.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
