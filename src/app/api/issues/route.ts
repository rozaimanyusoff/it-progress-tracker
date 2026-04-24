import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendIssueAssigned } from '@/lib/email'
import { canReceiveNotifications } from '@/lib/role-prefs'

const ISSUE_INCLUDE = {
  project: { select: { id: true, title: true } },
  user: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  resolved_by: { select: { id: true, name: true } },
  deliverable: {
    select: {
      id: true, title: true,
      module: { select: { id: true, title: true } },
    },
  },
  task: { select: { id: true, title: true } },
} as const

export { ISSUE_INCLUDE }

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  const issueType = searchParams.get('issue_type')
  const issueSeverity = searchParams.get('issue_severity')
  const issueStatus = searchParams.get('issue_status')
  const assigneeId = searchParams.get('assignee_id')
  const deliverableId = searchParams.get('deliverable_id')
  // legacy
  const severity = searchParams.get('severity')
  const resolved = searchParams.get('resolved')

  const where: any = {}
  if (projectId) where.project_id = Number(projectId)
  if (issueType) where.issue_type = issueType
  if (issueSeverity) where.issue_severity = issueSeverity
  if (issueStatus) where.issue_status = issueStatus
  if (assigneeId) where.assignee_id = Number(assigneeId)
  if (deliverableId) where.deliverable_id = Number(deliverableId)
  if (severity) where.severity = severity
  if (resolved !== null && resolved !== '') where.resolved = resolved === 'true'

  const issues = await prisma.issue.findMany({
    where,
    include: ISSUE_INCLUDE,
    orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
  })

  return NextResponse.json(issues)
}

function defaultDueDays(severity: string): number {
  const map: Record<string, number> = { critical: 1, major: 3, moderate: 7, minor: 14 }
  return map[severity] ?? 7
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const body = await req.json()
  let { project_id, deliverable_id, task_id, assignee_id } = body

  // Auto-populate project/deliverable from task context
  if (task_id) {
    const task = await prisma.task.findUnique({
      where: { id: Number(task_id) },
      select: { deliverable_id: true, deliverable: { select: { project_id: true } } },
    })
    if (task) {
      if (task.deliverable_id) deliverable_id = task.deliverable_id
      if (task.deliverable?.project_id) project_id = task.deliverable.project_id
    }
  } else if (deliverable_id) {
    const deliv = await prisma.deliverable.findUnique({
      where: { id: Number(deliverable_id) },
      select: { project_id: true },
    })
    if (deliv) project_id = deliv.project_id
  }

  if (!project_id || !body.title?.trim()) {
    return NextResponse.json({ error: 'project_id and title are required' }, { status: 400 })
  }

  const issueSeverity = body.issue_severity || 'moderate'
  const dueDate = body.due_date
    ? new Date(body.due_date)
    : (() => { const d = new Date(); d.setDate(d.getDate() + defaultDueDays(issueSeverity)); return d })()

  const issue = await prisma.issue.create({
    data: {
      project_id: Number(project_id),
      user_id: Number(user.id),
      title: body.title.trim(),
      description: body.description || null,
      severity: 'medium',
      issue_type: body.issue_type || 'bug',
      issue_severity: issueSeverity,
      issue_status: 'open',
      due_date: dueDate,
      media_urls: Array.isArray(body.media_urls) ? body.media_urls : [],
      ...(deliverable_id && { deliverable_id: Number(deliverable_id) }),
      ...(task_id && { task_id: Number(task_id) }),
      ...(assignee_id && { assignee_id: Number(assignee_id) }),
    },
    include: ISSUE_INCLUDE,
  })

  await prisma.issueHistory.create({
    data: { issue_id: issue.id, changed_by: Number(user.id), action: 'created', to_value: 'open' },
  })
  if (assignee_id) {
    await prisma.issueHistory.create({
      data: { issue_id: issue.id, changed_by: Number(user.id), action: 'assigned', to_value: String(assignee_id) },
    })
  }

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'CREATE',
      target_type: 'Issue',
      target_id: issue.id,
      metadata: { title: issue.title, issue_severity: issue.issue_severity, issue_type: issue.issue_type },
    },
  })

  if (assignee_id) {
    const assignee = await prisma.user.findUnique({
      where: { id: Number(assignee_id) },
      select: { email: true, name: true, role: true, display_role: true },
    })
    if (assignee && await canReceiveNotifications(assignee)) sendIssueAssigned(assignee.email, assignee.name, issue.title).catch(() => { })
  }

  return NextResponse.json(issue, { status: 201 })
}
