import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Resend activation email
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sendActivationEmail } = await import('@/lib/email')
  const crypto = await import('crypto')

  const userId = Number(params.id)
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
