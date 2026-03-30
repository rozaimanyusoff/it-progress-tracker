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
  const { title, description, mandays, status, module_id, planned_start, planned_end } = body

  const updated = await prisma.deliverable.update({
    where: { id: Number(id) },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(mandays !== undefined && { mandays: Number(mandays) }),
      ...(status !== undefined && { status }),
      ...(module_id !== undefined && { module_id: module_id ? Number(module_id) : null }),
      ...(planned_start !== undefined && { planned_start: planned_start ? new Date(planned_start) : null }),
      ...(planned_end !== undefined && { planned_end: planned_end ? new Date(planned_end) : null }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.deliverable.delete({ where: { id: Number(id) } })

  return NextResponse.json({ ok: true })
}
