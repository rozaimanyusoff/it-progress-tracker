import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const tasks = await prisma.task.findMany({
    where: { assignees: { some: { user_id: Number(user.id) } } },
    include: {
      assignees: { include: { user: { select: { id: true, name: true } } } },
      feature: {
        select: {
          id: true,
          title: true,
          project_links: {
            select: { project: { select: { id: true, title: true } }, module: { select: { id: true, title: true } } },
            take: 1,
          },
        },
      },
      deliverable: {
        select: {
          id: true,
          title: true,
          mandays: true,
          project: { select: { id: true, title: true } },
        },
      },
      _count: { select: { issues: { where: { issue_status: { notIn: ['resolved', 'closed'] } } } } },
    },
    orderBy: [{ status: 'asc' }, { order: 'asc' }],
  })

  const taskIds = tasks.map(t => t.id)
  const deliverableIds = Array.from(new Set(tasks.map(t => t.deliverable_id).filter((id): id is number => id != null)))

  const createLogs = taskIds.length > 0
    ? await prisma.auditLog.findMany({
        where: {
          target_type: 'Task',
          action: 'CREATE',
          target_id: { in: taskIds },
        },
        select: {
          target_id: true,
          created_at: true,
          user: { select: { name: true } },
        },
        orderBy: { created_at: 'asc' },
      })
    : []
  const creatorByTaskId = new Map<number, string>()
  for (const log of createLogs) {
    if (!creatorByTaskId.has(log.target_id)) {
      creatorByTaskId.set(log.target_id, log.user.name)
    }
  }

  const usedMandaysRows = deliverableIds.length > 0
    ? await prisma.task.groupBy({
        by: ['deliverable_id'],
        where: { deliverable_id: { in: deliverableIds }, is_predefined: false },
        _sum: { est_mandays: true },
      })
    : []
  const usedMandaysByDeliverable = new Map<number, number>()
  for (const row of usedMandaysRows) {
    if (row.deliverable_id != null) usedMandaysByDeliverable.set(row.deliverable_id, Number(row._sum.est_mandays ?? 0))
  }

  // Normalize: lift project and module to top level regardless of task origin
  const normalized = tasks.map(t => {
    const link = t.feature?.project_links?.[0]
    const creatorName = creatorByTaskId.get(t.id) ?? null
    const deliverableBudgetMandays = t.deliverable ? Number(t.deliverable.mandays ?? 0) : null
    const deliverableUsedMandays = t.deliverable_id != null
      ? Number(usedMandaysByDeliverable.get(t.deliverable_id) ?? 0)
      : null
    return {
      ...t,
      created_by_name: creatorName,
      deliverable_budget_mandays: deliverableBudgetMandays,
      deliverable_used_mandays: deliverableUsedMandays,
      project: link?.project ?? t.deliverable?.project ?? null,
      module: link?.module ?? null,
    }
  })

  return NextResponse.json(normalized)
}
