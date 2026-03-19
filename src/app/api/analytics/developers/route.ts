import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  const taskWhere = projectId
    ? { feature: { project_id: Number(projectId) } }
    : {}

  const featureAssignWhere = projectId
    ? { feature: { project_id: Number(projectId) } }
    : {}

  const users = await prisma.user.findMany({
    where: { role: 'member', is_active: true },
    select: {
      id: true,
      name: true,
      email: true,
      assigned_tasks: {
        where: taskWhere,
        select: {
          id: true,
          status: true,
          actual_start: true,
          actual_end: true,
          feature: {
            select: { planned_end: true, mandays: true },
          },
        },
      },
      feature_assignments: {
        where: featureAssignWhere,
        select: {
          feature: { select: { mandays: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  const today = new Date()

  const developers = users.map((u) => {
    const tasks = u.assigned_tasks
    const tasksDone = tasks.filter((t) => t.status === 'Done').length
    const tasksInProgress = tasks.filter(
      (t) => t.status === 'InProgress' || t.status === 'InReview'
    ).length

    const tasksDelayed = tasks.filter((t) => {
      const plannedEnd = new Date(t.feature.planned_end)
      if (t.actual_end) return t.actual_end > plannedEnd
      return today > plannedEnd
    }).length

    const estimatedMandays = u.feature_assignments.reduce(
      (sum, fa) => sum + fa.feature.mandays,
      0
    )

    const totalSpentDays = tasks
      .filter((t) => t.actual_start && t.actual_end)
      .reduce((sum, t) => {
        const diff =
          new Date(t.actual_end!).getTime() - new Date(t.actual_start!).getTime()
        return sum + diff / (1000 * 60 * 60 * 24)
      }, 0)

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      tasksAssigned: tasks.length,
      tasksDone,
      tasksInProgress,
      tasksDelayed,
      estimatedMandays,
      totalSpentDays: Math.round(totalSpentDays * 10) / 10,
    }
  })

  return NextResponse.json({ developers })
}
