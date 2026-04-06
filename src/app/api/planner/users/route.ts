import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Returns all active users (member + manager) for planner attendee/PIC selection
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const users = await prisma.user.findMany({
    where: { is_active: true },
    select: { id: true, name: true, initials: true, avatar_url: true, role: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}
