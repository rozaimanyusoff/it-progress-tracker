import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const issue = await prisma.issue.findUnique({ where: { id: Number(id) }, include: ISSUE_INCLUDE })
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(issue)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  const userId = Number(user.id)
  const isManager = user.role === 'manager'

  const body = await req.json()
  const data: any = {}
  const historyEntries: Array<{ action: string; from_value?: string; to_value?: string; note?: string }> = []

  if (body.issue_status !== undefined) {
    const current = await prisma.issue.findUnique({
      where: { id: Number(id) },
      select: { issue_status: true },
    })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const from = current.issue_status
    const to = body.issue_status

    const allowed =
      (to === 'in_progress' && from === 'open') ||
      (to === 'resolved' && from === 'in_progress') ||
      (to === 'closed' && from === 'resolved' && isManager) ||
      (to === 'open' && from === 'resolved' && isManager)

    if (!allowed) return NextResponse.json({ error: `Cannot transition from ${from} to ${to}` }, { status: 422 })

    if (to === 'resolved') {
      const note = body.resolution_note?.trim()
      if (!note || note.length < 10) return NextResponse.json({ error: 'resolution_note required (min 10 chars)' }, { status: 422 })
      data.resolution_note = note
      data.resolved_at = new Date()
      data.resolved_by_id = userId
      data.resolved = true
    }
    if (to === 'open' && from === 'resolved') {
      data.resolved_at = null
      data.resolved_by_id = null
      data.resolved = false
    }
    if (to === 'closed' && body.resolution_note) data.resolution_note = body.resolution_note.trim()

    data.issue_status = to
    historyEntries.push({ action: 'status_changed', from_value: from, to_value: to })
    if (to === 'open' && body.reopen_reason) historyEntries.push({ action: 'reopened', note: body.reopen_reason })
  }

  if ('assignee_id' in body) {
    const current = await prisma.issue.findUnique({ where: { id: Number(id) }, select: { assignee_id: true } })
    const newId = body.assignee_id ? Number(body.assignee_id) : null
    if (current?.assignee_id !== newId) {
      historyEntries.push({ action: 'reassigned', from_value: current?.assignee_id ? String(current.assignee_id) : undefined, to_value: newId ? String(newId) : undefined })
    }
    data.assignee_id = newId
  }
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description ?? null
  if (body.issue_severity !== undefined) data.issue_severity = body.issue_severity
  if (body.issue_type !== undefined) data.issue_type = body.issue_type
  if (body.due_date !== undefined) data.due_date = body.due_date ? new Date(body.due_date) : null
  if (body.resolved !== undefined) data.resolved = body.resolved
  if (body.severity !== undefined) data.severity = body.severity
  if ('deliverable_id' in body) data.deliverable_id = body.deliverable_id ? Number(body.deliverable_id) : null
  if ('task_id' in body) data.task_id = body.task_id ? Number(body.task_id) : null

  const issue = await prisma.issue.update({ where: { id: Number(id) }, data, include: ISSUE_INCLUDE })

  for (const entry of historyEntries) {
    await prisma.issueHistory.create({ data: { issue_id: issue.id, changed_by: userId, ...entry } })
  }

  await prisma.auditLog.create({
    data: { user_id: userId, action: 'UPDATE', target_type: 'Issue', target_id: issue.id, metadata: { issue_status: issue.issue_status } },
  })

  return NextResponse.json(issue)
}
