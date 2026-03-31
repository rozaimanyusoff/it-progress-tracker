import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const issues = await prisma.issue.findMany({
    where: { project_id: Number(id) },
    include: {
      user: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      deliverable: {
        select: {
          id: true,
          title: true,
          module: { select: { id: true, title: true } },
          tasks: {
            select: {
              id: true,
              title: true,
              assignee: { select: { id: true, name: true } },
            },
          },
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          assignee: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(issues)
}
