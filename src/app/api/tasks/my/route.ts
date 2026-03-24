import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  const tasks = await prisma.task.findMany({
    where: {
      assigned_to: Number(user.id),
      ...(projectId ? { feature: { project_id: Number(projectId) } } : {}),
    },
    include: {
      feature: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { order: 'asc' }],
  })

  return NextResponse.json(tasks)
}
