import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const issues = await prisma.issue.findMany({
    where: { assignee_id: Number(user.id), issue_status: { notIn: ['resolved', 'closed'] } },
    include: {
      project: { select: { id: true, title: true } },
      deliverable: { select: { id: true, title: true } },
      task: { select: { id: true, title: true } },
    },
    orderBy: [{ issue_severity: 'asc' }, { created_at: 'desc' }],
  })

  return NextResponse.json(issues)
}
