import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH — update task name and/or est_mandays
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, est_mandays } = await req.json()
  const data: any = {}
  if (name !== undefined) data.name = name.trim()
  if (est_mandays !== undefined) data.est_mandays = est_mandays != null && est_mandays !== '' ? Number(est_mandays) : null

  const task = await prisma.templateTask.update({
    where: { id: Number(id) },
    data,
  })

  return NextResponse.json(task)
}

// DELETE — remove a task
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.templateTask.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
