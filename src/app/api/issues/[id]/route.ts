import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const body = await req.json()
  const data: any = {}
  if (body.resolved !== undefined) data.resolved = body.resolved
  if ('assignee_id' in body) data.assignee_id = body.assignee_id ?? null
  if (body.title !== undefined) data.title = body.title
  if (body.description !== undefined) data.description = body.description ?? null
  if (body.severity !== undefined) data.severity = body.severity
  if ('deliverable_id' in body) data.deliverable_id = body.deliverable_id ? Number(body.deliverable_id) : null
  if ('task_id' in body) data.task_id = body.task_id ? Number(body.task_id) : null

  const issue = await prisma.issue.update({
    where: { id: Number(id) },
    data,
    include: {
      assignee: { select: { id: true, name: true } },
      deliverable: {
        select: {
          id: true, title: true,
          module: { select: { id: true, title: true } },
        },
      },
      task: { select: { id: true, title: true } },
    },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'UPDATE',
      target_type: 'Issue',
      target_id: issue.id,
      metadata: { title: issue.title, severity: issue.severity, resolved: issue.resolved },
    },
  })

  return NextResponse.json(issue)
}
