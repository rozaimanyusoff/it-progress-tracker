import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendActivationEmail } from '@/lib/email'
import crypto from 'crypto'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      is_active: true,
      created_at: true,
      unit_id: true,
      dept_id: true,
      company_id: true,
      unit: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, email, role } = await req.json()
  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role: role ?? 'member',
      is_active: false,
      activation_token: token,
      activation_token_expiry: expiry,
    },
  })

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const activationUrl = `${baseUrl}/activate/${token}`

  await sendActivationEmail(email, name, activationUrl)

  await prisma.auditLog.create({
    data: {
      user_id: Number((session.user as any).id),
      action: 'CREATE_USER',
      target_type: 'User',
      target_id: user.id,
      metadata: { name, email, role: role ?? 'member' },
    },
  })

  return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 })
}
