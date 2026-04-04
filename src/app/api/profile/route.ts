import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: Number((session.user as any).id) },
    select: { id: true, name: true, email: true, role: true, initials: true, contact_number: true },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, initials, contact_number, current_password, new_password } = body

  const userId = Number((session.user as any).id)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, unknown> = {}

  if (name !== undefined) {
    if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    data.name = name.trim()
  }
  if (initials !== undefined) {
    data.initials = initials?.trim()?.slice(0, 3).toUpperCase() || null
  }
  if (contact_number !== undefined) {
    data.contact_number = contact_number?.trim() || null
  }

  if (new_password) {
    if (!current_password) return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
    if (!user.password_hash) return NextResponse.json({ error: 'No password set' }, { status: 400 })
    const valid = await bcrypt.compare(current_password, user.password_hash)
    if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    if (new_password.length < 8) return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
    data.password_hash = await bcrypt.hash(new_password, 10)
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, role: true, initials: true, contact_number: true },
  })

  await prisma.auditLog.create({
    data: {
      user_id: userId,
      action: 'UPDATE',
      target_type: 'User',
      target_id: userId,
      metadata: { fields: Object.keys(data).filter(k => k !== 'password_hash'), ...(new_password ? { password_changed: true } : {}) },
    },
  }).catch(() => {})

  return NextResponse.json(updated)
}
