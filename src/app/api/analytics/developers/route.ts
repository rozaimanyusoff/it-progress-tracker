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

  const taskWhere = projectId
    ? { feature: { project_links: { some: { project_id: Number(projectId) } } } }
    : {}

  const featureAssignWhere = projectId
    ? { feature: { project_links: { some: { project_id: Number(projectId) } } } }
    : {}

  // Members can only see their own analytics
  const userWhere =
    user.role === 'manager'
      ? { role: 'member' as const, is_active: true }
      : { id: Number(user.id), is_active: true }

  const now = new Date()

  // Build 4 week boundaries (most recent week last)
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const end = new Date(now)
    end.setDate(now.getDate() - i * 7)
    const start = new Date(end)
    start.setDate(end.getDate() - 7)
    return { start, end, label: `W${4 - i}` }
  }).reverse()

  const users = await prisma.user.findMany({
    where: userWhere,
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
          created_at: true,
          feature: {
            select: { mandays: true },
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

    // 4-week trend: tasks assigned per week
    const weeklyTasksTrend = weeks.map((w) => ({
      week: w.label,
      count: u.assigned_tasks.filter((t) => {
        const created = new Date(t.created_at)
        return created >= w.start && created < w.end
      }).length,
    }))

    // 4-week trend: time spent per week (hours)
    const weeklyTimeTrend = weeks.map((w) => ({
      week: w.label,
      hours: Math.round(
        u.assigned_tasks
          .filter((t) => t.actual_start && t.actual_end && new Date(t.actual_start) >= w.start && new Date(t.actual_start) < w.end)
          .reduce((sum, t) => {
            const diff = new Date(t.actual_end!).getTime() - new Date(t.actual_start!).getTime()
            return sum + diff / (1000 * 60 * 60)
          }, 0) * 10
      ) / 10,
    }))

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      tasksAssigned: tasks.length,
      tasksDone,
      tasksInProgress,
      estimatedMandays,
      totalSpentDays: Math.round(totalSpentDays * 10) / 10,
      weeklyTasksTrend,
      weeklyTimeTrend,
    }
  })

  return NextResponse.json({ developers })
}
