import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = req.nextUrl.searchParams
  const includeManagers = searchParams.get('include_managers') === 'true'
  const roles = includeManagers ? ['member', 'manager'] : ['member']

  const users = await prisma.user.findMany({
    where: { role: { in: roles }, is_active: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}
