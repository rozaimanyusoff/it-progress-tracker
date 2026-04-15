import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  // Include tasks linked via feature OR via deliverable (kanban-created tasks land on deliverables)
  const taskWhere = projectId
    ? {
        OR: [
          { feature: { project_links: { some: { project_id: Number(projectId) } } } },
          { deliverable: { project_id: Number(projectId) } },
        ],
      }
    : {}

  const featureAssignWhere = projectId
    ? { feature: { project_links: { some: { project_id: Number(projectId) } } } }
    : {}

  // Managers: include all active assignees in the scoped project (including managers).
  // Non-managers: only see their own analytics.
  const userWhere =
    user.role === 'manager'
      ? (projectId
          ? { is_active: true, project_assignments: { some: { project_id: Number(projectId) } } }
          : { is_active: true, role: { in: [Role.member, Role.manager] } })
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
      task_assignees: {
        where: { task: taskWhere },
        select: {
          task: {
            select: {
              id: true,
              status: true,
              actual_start: true,
              actual_end: true,
              completed_at: true,
              created_at: true,
              est_mandays: true,
              feature: {
                select: { mandays: true },
              },
            },
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
    const tasks = u.task_assignees.map((ta) => ta.task)
    const tasksDone = tasks.filter((t) => t.status === 'Done').length
    const tasksInProgress = tasks.filter(
      (t) => t.status === 'InProgress' || t.status === 'InReview'
    ).length

    // Sum task-level est_mandays (new granular estimate); fall back to feature-level mandays if no task-level data
    const taskEstMandays = tasks.reduce(
      (sum: number, t) => sum + (t.est_mandays != null ? Number(t.est_mandays) : 0),
      0
    )
    const featureEstMandays = u.feature_assignments.reduce(
      (sum: number, fa) => sum + fa.feature.mandays,
      0
    )
    const estimatedMandays = taskEstMandays > 0 ? taskEstMandays : featureEstMandays

    const totalSpentDays = tasks
      .filter((t) => t.actual_start && t.actual_end)
      .reduce((sum: number, t) => {
        const diff =
          new Date(t.actual_end!).getTime() - new Date(t.actual_start!).getTime()
        return sum + diff / (1000 * 60 * 60 * 24)
      }, 0)

    // 4-week trend: tasks assigned per week (by created_at)
    const weeklyTasksTrend = weeks.map((w) => ({
      week: w.label,
      count: tasks.filter((t) => {
        const created = new Date(t.created_at)
        return created >= w.start && created < w.end
      }).length,
    }))

    // 4-week trend: tasks completed per week (by completed_at or actual_end)
    const weeklyCompletedTrend = weeks.map((w) => ({
      week: w.label,
      count: tasks.filter((t) => {
        const completedDate = t.completed_at ? new Date(t.completed_at) : (t.actual_end ? new Date(t.actual_end) : null)
        return t.status === 'Done' && completedDate && completedDate >= w.start && completedDate < w.end
      }).length,
    }))

    // 4-week trend: time spent per week (hours)
    const weeklyTimeTrend = weeks.map((w) => ({
      week: w.label,
      hours: Math.round(
        tasks
          .filter((t) => t.actual_start && t.actual_end && new Date(t.actual_start) >= w.start && new Date(t.actual_start) < w.end)
          .reduce((sum: number, t) => {
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
      weeklyCompletedTrend,
      weeklyTimeTrend,
    }
  })

  void today

  return NextResponse.json({ developers })
}
