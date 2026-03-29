import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Returns all tasks for a project grouped by module > feature
// Used by developer Kanban to browse and self-assign
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  // Verify user is assigned to this project (or is manager)
  if (user.role !== 'manager') {
    const assignment = await prisma.projectAssignee.findUnique({
      where: { project_id_user_id: { project_id: Number(projectId), user_id: Number(user.id) } },
    })
    if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const modules = await prisma.module.findMany({
    where: { project_id: Number(projectId) },
    include: {
      features: {
        include: {
          tasks: {
            include: { assignee: { select: { id: true, name: true } } },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  })

  // Also get ungrouped features (no module_id)
  const ungrouped = await prisma.feature.findMany({
    where: { project_id: Number(projectId), module_id: null },
    include: {
      tasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json({ modules, ungrouped })
}
