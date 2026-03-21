import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const user = await prisma.user.findUnique({
    where: { activation_token: token },
    select: { id: true, name: true, email: true, is_active: true, activation_token_expiry: true },
  })

  if (!user) return NextResponse.json({ error: 'Invalid or expired activation link' }, { status: 404 })
  if (user.is_active) return NextResponse.json({ error: 'Account already activated' }, { status: 400 })
  if (user.activation_token_expiry && user.activation_token_expiry < new Date()) {
    return NextResponse.json({ error: 'Activation link has expired' }, { status: 410 })
  }

  return NextResponse.json({ name: user.name, email: user.email })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { password } = await req.json()

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { activation_token: token },
  })

  if (!user) return NextResponse.json({ error: 'Invalid or expired activation link' }, { status: 404 })
  if (user.is_active) return NextResponse.json({ error: 'Account already activated' }, { status: 400 })
  if (user.activation_token_expiry && user.activation_token_expiry < new Date()) {
    return NextResponse.json({ error: 'Activation link has expired' }, { status: 410 })
  }

  const password_hash = await bcrypt.hash(password, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash,
      is_active: true,
      activation_token: null,
      activation_token_expiry: null,
    },
  })

  return NextResponse.json({ ok: true })
}
