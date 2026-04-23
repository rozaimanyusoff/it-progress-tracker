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
  const featureId = searchParams.get('feature_id')

  const projectWhere = user.role === 'manager'
    ? (projectId ? { id: Number(projectId) } : {})
    : {
        assignees: { some: { user_id: Number(user.id) } },
        ...(projectId ? { id: Number(projectId) } : {}),
      }

  const projects = await prisma.project.findMany({
    where: projectWhere,
    select: { id: true },
  })
  const projectIds = projects.map((p: { id: number }) => p.id)
  const orConditions: any[] = []
  if (projectIds.length > 0) {
    orConditions.push(
      {
        feature: {
          project_links: { some: { project_id: { in: projectIds } } },
          ...(featureId ? { id: Number(featureId) } : {}),
        },
      },
      {
        deliverable: {
          project_id: { in: projectIds },
        },
      }
    )
  }
  if (!projectId) {
    // Include standalone tasks (no project link) assigned to current user.
    orConditions.push({
      feature_id: null,
      deliverable_id: null,
      assignees: { some: { user_id: Number(user.id) } },
    })
  }
  if (orConditions.length === 0) return NextResponse.json([])

  const tasks = await prisma.task.findMany({
    where: {
      is_predefined: false,
      OR: orConditions,
    },
    include: {
      feature: {
        select: {
          id: true,
          title: true,
          project_links: {
            select: {
              project: { select: { id: true, title: true } },
              module:  { select: { id: true, title: true } },
            },
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
          module:  { select: { id: true, title: true } },
        },
      },
      assignees: { include: { user: { select: { id: true, name: true } } } },
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
    if (row.deliverable_id != null) {
      usedMandaysByDeliverable.set(row.deliverable_id, Number(row._sum.est_mandays ?? 0))
    }
  }

  // Normalize to a common context shape for the Kanban
  const normalized = tasks.map(t => {
    const creatorName = creatorByTaskId.get(t.id) ?? null
    const deliverableBudgetMandays = t.deliverable ? Number(t.deliverable.mandays ?? 0) : null
    const deliverableUsedMandays = t.deliverable_id != null
      ? Number(usedMandaysByDeliverable.get(t.deliverable_id) ?? 0)
      : null

    if (t.feature) {
      const link = t.feature.project_links[0]
      return {
        ...t,
        created_by_name: creatorName,
        deliverable_budget_mandays: deliverableBudgetMandays,
        deliverable_used_mandays: deliverableUsedMandays,
        context: {
          type: 'feature' as const,
          id: t.feature.id,
          title: t.feature.title,
          module: link?.module ?? null,
          project: link?.project ?? { id: 0, title: 'Unknown' },
        },
      }
    }
    if (t.deliverable) {
      return {
        ...t,
        created_by_name: creatorName,
        deliverable_budget_mandays: deliverableBudgetMandays,
        deliverable_used_mandays: deliverableUsedMandays,
        context: {
          type: 'deliverable' as const,
          id: t.deliverable.id,
          title: t.deliverable.title,
          module: t.deliverable.module ?? null,
          project: t.deliverable.project,
        },
      }
    }
    return {
      ...t,
      created_by_name: creatorName,
      deliverable_budget_mandays: null,
      deliverable_used_mandays: null,
      context: {
        type: 'standalone' as const,
        id: t.id,
        title: 'Standalone Task',
        module: null,
        project: null,
      },
    }
  })

  return NextResponse.json(normalized)
}
