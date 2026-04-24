import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  sendTaskSubmittedForReview,
  sendTaskRejected,
  sendTaskApproved,
  sendTaskAssigned,
} from '@/lib/email'
import { filterUsersCanReceiveNotifications, canReceiveNotifications } from '@/lib/role-prefs'

// ── Progress weights ───────────────────────────────────────────────
const PROGRESS_WEIGHT: Record<string, number> = {
  Todo: 0, InProgress: 50, InReview: 80, Done: 100, Blocked: 0,
}

function taskWeightedProgress(status: string): number {
  return PROGRESS_WEIGHT[status] ?? 0
}

async function recalculateFeatureDates(featureId: number) {
  const allTasks = await prisma.task.findMany({ where: { feature_id: featureId } })

  const starts = allTasks.map((t) => t.actual_start).filter(Boolean) as Date[]
  const newActualStart =
    starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null

  const allDone = allTasks.every((t) => t.status === 'Done')
  const ends = allTasks.map((t) => t.actual_end).filter(Boolean) as Date[]
  const newActualEnd =
    allDone && ends.length === allTasks.length
      ? new Date(Math.max(...ends.map((d) => d.getTime())))
      : null

  await prisma.feature.update({
    where: { id: featureId },
    data: { actual_start: newActualStart, actual_end: newActualEnd },
  })
}

async function recalculateDeliverableDates(deliverableId: number) {
  const deliverable = await prisma.deliverable.findUnique({ where: { id: deliverableId } })
  if (!deliverable) return
  const allTasks = await prisma.task.findMany({ where: { deliverable_id: deliverableId } })
  if (allTasks.length === 0) return

  const allDone = allTasks.every((t) => t.status === 'Done')
  const anyActive = allTasks.some((t) => t.status === 'InProgress' || t.status === 'InReview')
  const newStatus = allDone ? 'Done' : anyActive ? 'InProgress' : 'Pending'

  const updateData: any = { status: newStatus }

  // Only auto-derive actual dates when PM has not manually overridden them
  if (!deliverable.is_actual_override) {
    const starts = allTasks.map((t) => t.actual_start).filter(Boolean) as Date[]
    updateData.actual_start = starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null

    const ends = allTasks.map((t) => t.actual_end).filter(Boolean) as Date[]
    updateData.actual_end =
      allDone && ends.length === allTasks.length
        ? new Date(Math.max(...ends.map((d) => d.getTime())))
        : null
  }

  await prisma.deliverable.update({ where: { id: deliverableId }, data: updateData })

  // Recalculate project dates after deliverable update
  if (deliverable.project_id) {
    await recalculateProjectDates(deliverable.project_id)
  }
}

async function recalculateProjectDates(projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return

  const deliverables = await prisma.deliverable.findMany({ where: { project_id: projectId } })

  // Actual start = MIN of deliverable actual_starts
  const delivStarts = deliverables.map((d) => d.actual_start).filter(Boolean) as Date[]
  const newActualStart = delivStarts.length > 0 ? new Date(Math.min(...delivStarts.map((d) => d.getTime()))) : null

  // Actual end = MAX of deliverable actual_ends, only if ALL done
  const allDelivDone = deliverables.length > 0 && deliverables.every((d) => d.status === 'Done')
  const delivEnds = deliverables.map((d) => d.actual_end).filter(Boolean) as Date[]
  const newActualEnd = allDelivDone && delivEnds.length === deliverables.length
    ? new Date(Math.max(...delivEnds.map((d) => d.getTime())))
    : null

  // Health status calculation
  const healthStatus = await computeHealthStatus(projectId, project, newActualStart)

  await prisma.project.update({
    where: { id: projectId },
    data: { actual_start: newActualStart, actual_end: newActualEnd, health_status: healthStatus },
  })
}

async function computeHealthStatus(projectId: number, project: any, actualStart: Date | null): Promise<any> {
  if (project.status === 'Done') return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(project.deadline)
  due.setHours(0, 0, 0, 0)

  if (today > due) return 'overdue'

  const allTasks = await prisma.task.findMany({ where: { deliverable: { project_id: projectId } } })
  const tasksCompleted = allTasks.filter((t) => t.status === 'Done').length
  const tasksRemaining = allTasks.filter((t) => t.status !== 'Done').length

  if (!actualStart || tasksCompleted === 0) return 'on_track'

  const startTs = new Date(actualStart)
  startTs.setHours(0, 0, 0, 0)
  const daysElapsed = Math.max(1, Math.floor((today.getTime() - startTs.getTime()) / 86400000))
  const velocity = tasksCompleted / daysElapsed

  if (velocity <= 0) return 'on_track'

  const daysToComplete = tasksRemaining / velocity
  const projectedMs = today.getTime() + daysToComplete * 86400000
  const projectedCompletion = new Date(projectedMs)

  const dueMs = due.getTime()
  if (projectedCompletion <= due) return 'on_track'
  if (projectedMs <= dueMs + 14 * 86400000) return 'at_risk'
  return 'delayed'
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const taskId = Number(id)
  const body = await req.json()

  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Members can only update tasks they are assigned to; only managers can mark Done
  if (user.role === 'member') {
    const isAssigned = existing.assignees.some((a) => a.user_id === Number(user.id))
    if (!isAssigned) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (body.status === 'Done') {
      return NextResponse.json({ error: 'Only managers can mark tasks as Done' }, { status: 403 })
    }
  }

  const updateData: any = {}

  if (body.title !== undefined) updateData.title = body.title
  if (body.description !== undefined) updateData.description = body.description || null
  if (body.dev_category !== undefined) updateData.dev_category = body.dev_category || null
  if (body.dev_scope !== undefined) updateData.dev_scope = body.dev_scope || null
  if (body.dev_task !== undefined) updateData.dev_task = body.dev_task || null
  if (body.order !== undefined) updateData.order = Number(body.order)
  if (body.due_date !== undefined) updateData.due_date = body.due_date ? new Date(body.due_date) : null
  if (body.actual_start !== undefined) updateData.actual_start = body.actual_start ? new Date(body.actual_start) : null
  if (body.actual_end !== undefined && user.role === 'manager') {
    updateData.actual_end = body.actual_end ? new Date(body.actual_end) : null
    // If overriding actual_end for a Done task, also update completed_at
    if (body.actual_end && existing.status === 'Done') {
      updateData.completed_at = new Date(body.actual_end)
    }
  }
  if (body.est_mandays !== undefined) updateData.est_mandays = body.est_mandays != null ? body.est_mandays : null
  if (body.actual_mandays !== undefined) updateData.actual_mandays = body.actual_mandays != null ? body.actual_mandays : null
  if (body.priority !== undefined) updateData.priority = body.priority

  // is_blocked can be updated by anyone assigned to the task (or manager)
  if (body.is_blocked !== undefined) updateData.is_blocked = body.is_blocked
  if (body.blocked_reason !== undefined) updateData.blocked_reason = body.blocked_reason || null

  if (body.status !== undefined) {
    const prevStatus = existing.status
    const newStatus = body.status as string
    updateData.status = newStatus

    // ── Blocked status syncs the is_blocked flag ───────────────────
    if (newStatus === 'Blocked') {
      updateData.is_blocked = true
      if (body.blocked_reason !== undefined) updateData.blocked_reason = body.blocked_reason || null
    }
    if (prevStatus === 'Blocked' && newStatus !== 'Blocked') {
      updateData.is_blocked = false
      updateData.blocked_reason = null
    }

    // ── status_updated_at / status_updated_by ─────────────────────
    updateData.status_updated_at = new Date()
    updateData.status_updated_by = Number(user.id)

    // ── Time tracking ──────────────────────────────────────────────
    if (newStatus === 'InProgress' && prevStatus !== 'InProgress') {
      updateData.time_started_at = new Date()
    }
    if (prevStatus === 'InProgress' && newStatus !== 'InProgress' && existing.time_started_at) {
      const elapsed = Math.floor((Date.now() - existing.time_started_at.getTime()) / 1000)
      updateData.time_spent_seconds = (existing.time_spent_seconds ?? 0) + elapsed
      updateData.time_started_at = null
    }

    // ── actual_start / actual_end — use popup date if provided ─────
    const actualDate = body.actual_date ? new Date(body.actual_date) : null

    if (newStatus === 'InProgress' && !existing.actual_start) {
      updateData.actual_start = actualDate ?? new Date()
    }
    if ((newStatus === 'InReview' || newStatus === 'Done') && actualDate) {
      updateData.actual_end = actualDate
    }
    if (newStatus === 'Done' && !existing.actual_end && !actualDate) {
      updateData.actual_end = new Date()
    }
    if (prevStatus === 'Done' && newStatus !== 'Done') {
      updateData.actual_end = null
    }

    // ── Lifecycle timestamps (set once, never overwrite) ───────────
    if (newStatus === 'InProgress' && !(existing as any).started_at) {
      updateData.started_at = new Date()
    }
    if (newStatus === 'InReview' && !(existing as any).submitted_at) {
      updateData.submitted_at = new Date()
    }
    if (newStatus === 'Done' && !(existing as any).completed_at) {
      updateData.completed_at = actualDate ?? new Date()
    }
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
    include: {
      assignees: { include: { user: { select: { id: true, name: true, email: true, role: true, display_role: true } } } },
    },
  })

  // Managers can update assignees — replace the list
  if ('assignee_ids' in body && user.role === 'manager') {
    const newIds: number[] = (body.assignee_ids as any[]).map(Number)
    const oldIds = existing.assignees.map((a) => a.user_id)
    await prisma.taskAssignee.deleteMany({ where: { task_id: taskId } })
    if (newIds.length > 0) {
      await prisma.taskAssignee.createMany({
        data: newIds.map((uid) => ({ task_id: taskId, user_id: uid })),
      })
    }
    // Notify newly added assignees
    const addedIds = newIds.filter((id) => !oldIds.includes(id))
    for (const uid of addedIds) {
      const assignee = await prisma.user.findUnique({ where: { id: uid }, select: { email: true, name: true, role: true, display_role: true } })
      if (assignee && await canReceiveNotifications(assignee)) sendTaskAssigned(assignee.email, assignee.name, task.title).catch(() => { })
    }
  }

  // Recalculate parent dates after task status change
  if (body.status !== undefined) {
    if (task.feature_id != null) await recalculateFeatureDates(task.feature_id)
    if (task.deliverable_id != null) await recalculateDeliverableDates(task.deliverable_id)
  }

  // ── Auto-log status change to task_history ─────────────────────
  if (body.status !== undefined && body.status !== existing.status) {
    const actualDate = body.actual_date ? new Date(body.actual_date) : null
    await prisma.taskHistory.create({
      data: {
        task_id: taskId,
        changed_by: Number(user.id),
        from_status: existing.status,
        to_status: body.status,
        actual_date: actualDate,
        note: null,
        is_auto_log: true,
      },
    })
  }

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'UPDATE',
      target_type: 'Task',
      target_id: task.id,
      metadata: {
        old_status: existing.status,
        new_status: body.status ?? existing.status,
      },
    },
  })

  // Send notifications based on status transitions and assignment changes
  if (body.status !== undefined) {
    const prevStatus = existing.status
    const newStatus = body.status

    if (user.role === 'member' && prevStatus === 'InProgress' && newStatus === 'InReview') {
      const managers = await prisma.user.findMany({
        where: { role: 'manager', is_active: true },
        select: { email: true, role: true, display_role: true },
      })
      const notifiable = await filterUsersCanReceiveNotifications(managers)
      const managerEmails = notifiable.map((m) => m.email)
      if (managerEmails.length > 0) {
        sendTaskSubmittedForReview(managerEmails, task.title, user.name).catch(() => { })
      }
    }

    if (user.role === 'manager' && prevStatus === 'InReview' && newStatus === 'InProgress') {
      for (const a of task.assignees) {
        if (await canReceiveNotifications(a.user))
          sendTaskRejected(a.user.email, a.user.name, task.title).catch(() => { })
      }
    }

    if (user.role === 'manager' && prevStatus === 'InReview' && newStatus === 'Done') {
      for (const a of task.assignees) {
        if (await canReceiveNotifications(a.user))
          sendTaskApproved(a.user.email, a.user.name, task.title).catch(() => { })
      }
    }
  }

  return NextResponse.json(task)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const taskId = Number(id)
  const existing = await prisma.task.findUnique({ where: { id: taskId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (existing.is_predefined) {
    return NextResponse.json({ error: 'Predefined SDLC tasks cannot be deleted' }, { status: 400 })
  }

  if (existing.status !== 'Todo') {
    return NextResponse.json({ error: 'Only Todo tasks can be deleted' }, { status: 403 })
  }

  if (user.role !== 'manager') {
    return NextResponse.json({ error: 'Only managers can delete tasks' }, { status: 403 })
  }

  await prisma.task.delete({ where: { id: taskId } })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'DELETE',
      target_type: 'Task',
      target_id: taskId,
      metadata: { title: existing.title },
    },
  })

  return NextResponse.json({ success: true })
}
