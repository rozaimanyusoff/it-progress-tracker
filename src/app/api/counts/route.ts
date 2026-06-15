import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasAllProjectAccess } from '@/lib/role-prefs'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const userId = Number(user.id)
  const dbUser = await prisma.user.findUnique({ where: { id: Number(user.id) }, select: { display_role: true } })
  const allAccess = await hasAllProjectAccess({ ...user, display_role: dbUser?.display_role ?? null })

  const [kanbanTasks, kanbanIssues, openIssues, plannerPending, projectCount] = await Promise.all([
    // All-project access: team Todo tasks (non-predefined) · Others: own Todo tasks
    allAccess
      ? prisma.task.count({
        where: {
          status: 'Todo',
          is_predefined: false,
        },
      })
      : prisma.task.count({ where: { assignees: { some: { user_id: userId } }, status: 'Todo', is_predefined: false } }),
    // Open issues assigned to user (members only; admins: 0 since issues badge covers it)
    user.role === 'admin'
      ? Promise.resolve(0)
      : prisma.issue.count({ where: { assignee_id: userId, issue_status: { notIn: ['resolved', 'closed'] } } }),
    // Admins: all open issues · Others: only issues assigned to them
    user.role === 'admin'
      ? prisma.issue.count({ where: { issue_status: { notIn: ['resolved', 'closed'] } } })
      : prisma.issue.count({ where: { assignee_id: userId, issue_status: { notIn: ['resolved', 'closed'] } } }),
    // Members: agenda items where user is PIC but has not posted a followup yet
    user.role === 'member'
      ? prisma.meetingAgenda.count({
        where: {
          pics: { some: { user_id: userId } },
          followups: { none: { created_by: userId } },
        },
      })
      : Promise.resolve(0),
    // Non-admin: number of projects where user is an assignee
    allAccess
      ? Promise.resolve(0)
      : prisma.projectAssignee.count({ where: { user_id: userId } }),
  ])

  return NextResponse.json({
    kanban: kanbanTasks + (kanbanIssues as number),
    issues: openIssues,
    planner: plannerPending,
    projects: projectCount,
  })
}
