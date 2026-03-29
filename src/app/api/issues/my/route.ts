import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const issues = await prisma.issue.findMany({
    where: { assignee_id: Number(user.id), resolved: false },
    include: { project: { select: { id: true, title: true } } },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(issues)
}
