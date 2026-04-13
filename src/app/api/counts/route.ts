import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const userId = Number(user.id)

  const [kanbanTasks, kanbanIssues, openIssues] = await Promise.all([
    // Manager: team Todo tasks (non-predefined) · Member: own Todo tasks
    user.role === 'manager'
      ? prisma.task.count({
        where: {
          status: 'Todo',
          is_predefined: false,
        },
      })
      : prisma.task.count({ where: { assignees: { some: { user_id: userId } }, status: 'Todo', is_predefined: false } }),
    // Open issues assigned to user (members only; managers: 0 since issues badge covers it)
    user.role === 'manager'
      ? Promise.resolve(0)
      : prisma.issue.count({ where: { assignee_id: userId, issue_status: { notIn: ['resolved', 'closed'] } } }),
    // Managers: all open issues · Members: only issues assigned to them
    user.role === 'manager'
      ? prisma.issue.count({ where: { issue_status: { notIn: ['resolved', 'closed'] } } })
      : prisma.issue.count({ where: { assignee_id: userId, issue_status: { notIn: ['resolved', 'closed'] } } }),
  ])

  return NextResponse.json({
    kanban: kanbanTasks + (kanbanIssues as number),
    issues: openIssues,
  })
}
