import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/org/[id]  { type, name }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { type, name } = await req.json()
  if (!type || !name?.trim()) return NextResponse.json({ error: 'type and name are required' }, { status: 400 })

  try {
    if (type === 'unit') {
      const item = await prisma.orgUnit.update({ where: { id: Number(id) }, data: { name: name.trim() } })
      return NextResponse.json(item)
    }
    if (type === 'dept') {
      const item = await prisma.department.update({ where: { id: Number(id) }, data: { name: name.trim() } })
      return NextResponse.json(item)
    }
    if (type === 'company') {
      const item = await prisma.company.update({ where: { id: Number(id) }, data: { name: name.trim() } })
      return NextResponse.json(item)
    }
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: 'Name already exists' }, { status: 409 })
    throw e
  }
}

// DELETE /api/org/[id]?type=unit|dept|company
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'unit') {
    await prisma.orgUnit.delete({ where: { id: Number(id) } })
  } else if (type === 'dept') {
    await prisma.department.delete({ where: { id: Number(id) } })
  } else if (type === 'company') {
    await prisma.company.delete({ where: { id: Number(id) } })
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
