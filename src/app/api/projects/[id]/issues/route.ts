import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const typeFilter = searchParams.get('issue_type')
  const severityFilter = searchParams.get('issue_severity')
  const statusFilter = searchParams.get('issue_status')
  const assigneeFilter = searchParams.get('assignee_id')
  const deliverableFilter = searchParams.get('deliverable_id')

  const where: any = { project_id: Number(id) }
  if (typeFilter) where.issue_type = typeFilter
  if (severityFilter) where.issue_severity = severityFilter
  if (statusFilter) where.issue_status = statusFilter
  if (assigneeFilter) where.assignee_id = Number(assigneeFilter)
  if (deliverableFilter) where.deliverable_id = Number(deliverableFilter)

  const issues = await prisma.issue.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      resolved_by: { select: { id: true, name: true } },
      deliverable: {
        select: {
          id: true,
          title: true,
          module: { select: { id: true, title: true } },
        },
      },
      task: { select: { id: true, title: true } },
    },
    orderBy: [{ issue_severity: 'asc' }, { created_at: 'desc' }],
  })

  return NextResponse.json(issues)
}
