import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/tasks/by-assignee?user_id=X&project_id=Y
// Returns active (non-Done) tasks assigned to a user within a project
// Manager-only endpoint used for workload rearrangement
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const projectId = searchParams.get('project_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const projectFilter = projectId
    ? {
        OR: [
          { feature: { project_links: { some: { project_id: Number(projectId) } } } },
          { deliverable: { project_id: Number(projectId) } },
        ],
      }
    : {}

  const tasks = await prisma.task.findMany({
    where: {
      assignees: { some: { user_id: Number(userId) } },
      status: { notIn: ['Done'] },
      ...projectFilter,
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      est_mandays: true,
      due_date: true,
      assignees: {
        select: { user: { select: { id: true, name: true } } },
      },
      deliverable: { select: { id: true, title: true } },
      feature: { select: { id: true, title: true } },
    },
    orderBy: [{ status: 'asc' }, { order: 'asc' }],
  })

  return NextResponse.json(tasks)
}
