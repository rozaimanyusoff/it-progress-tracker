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
  const featureId = searchParams.get('feature_id')

  // Build project scope: manager sees all, others see only their assigned projects
  const projectWhere = user.role === 'manager'
    ? (projectId ? { id: Number(projectId) } : {})
    : {
        assignees: { some: { user_id: Number(user.id) } },
        ...(projectId ? { id: Number(projectId) } : {}),
      }

  const projects = await prisma.project.findMany({
    where: projectWhere,
    select: { id: true },
  })
  const projectIds = projects.map((p: { id: number }) => p.id)

  if (projectIds.length === 0) return NextResponse.json([])

  const tasks = await prisma.task.findMany({
    where: {
      is_predefined: false,
      feature: {
        project_id: { in: projectIds },
        ...(featureId ? { id: Number(featureId) } : {}),
      },
    },
    include: {
      feature: {
        select: {
          id: true,
          title: true,
          module: { select: { id: true, title: true } },
          project: { select: { id: true, title: true } },
        },
      },
      assignee: { select: { id: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { order: 'asc' }],
  })

  return NextResponse.json(tasks)
}
