import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ROLE_OVERRIDES_KEY = 'user_role_overrides'

async function getRoleOverrides() {
  const row = await prisma.appSetting.findUnique({ where: { key: ROLE_OVERRIDES_KEY } })
  if (!row?.value) return {} as Record<string, string>
  try {
    const parsed = JSON.parse(row.value)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const userId = Number(id)
  const selfId = Number((session.user as any).id)

  if (userId === selfId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  // Remove custom role override if any.
  const overrides = await getRoleOverrides()
  if (overrides[String(userId)]) {
    delete overrides[String(userId)]
    await prisma.appSetting.upsert({
      where: { key: ROLE_OVERRIDES_KEY },
      create: { key: ROLE_OVERRIDES_KEY, value: JSON.stringify(overrides) },
      update: { value: JSON.stringify(overrides) },
    })
  }

  await prisma.user.delete({ where: { id: userId } })

  await prisma.auditLog.create({
    data: {
      user_id: selfId,
      action: 'DELETE_USER',
      target_type: 'User',
      target_id: userId,
    },
  })

  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Resend activation email
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sendActivationEmail } = await import('@/lib/email')
  const crypto = await import('crypto')

  const { id } = await params
  const userId = Number(id)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (user.is_active) return NextResponse.json({ error: 'User already active' }, { status: 400 })

  const token = crypto.randomBytes(32).toString('hex')
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: userId },
    data: { activation_token: token, activation_token_expiry: expiry },
  })

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  await sendActivationEmail(user.email, user.name, `${baseUrl}/activate/${token}`)

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const userId = Number(id)
  const body = await req.json()

  const data: Record<string, any> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.role !== undefined) {
    const requestedRole = String(body.role)
    const systemRole = requestedRole === 'manager' || requestedRole === 'member' ? requestedRole : 'member'
    data.role = systemRole

    const overrides = await getRoleOverrides()
    if (requestedRole === 'manager' || requestedRole === 'member') {
      delete overrides[String(userId)]
    } else {
      overrides[String(userId)] = requestedRole
    }
    await prisma.appSetting.upsert({
      where: { key: ROLE_OVERRIDES_KEY },
      create: { key: ROLE_OVERRIDES_KEY, value: JSON.stringify(overrides) },
      update: { value: JSON.stringify(overrides) },
    })
  }
  if (body.is_active !== undefined) data.is_active = body.is_active
  if (body.initials !== undefined) data.initials = body.initials || null
  if (body.contact_number !== undefined) data.contact_number = body.contact_number || null
  if ('unit_id' in body) data.unit_id = body.unit_id ?? null
  if ('dept_id' in body) data.dept_id = body.dept_id ?? null
  if ('company_id' in body) data.company_id = body.company_id ?? null

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, name: true, email: true, role: true, is_active: true,
      unit_id: true, dept_id: true, company_id: true,
      unit: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
  })

  const roleOverrides = await getRoleOverrides()

  await prisma.auditLog.create({
    data: {
      user_id: Number((session.user as any).id),
      action: 'UPDATE_USER',
      target_type: 'User',
      target_id: userId,
      metadata: data,
    },
  })

  return NextResponse.json({
    ...updated,
    role: roleOverrides[String(updated.id)] || updated.role,
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
    select: { initials: true, contact_number: true },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(user)
}
