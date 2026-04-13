import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface CustomTask {
  name: string
  est_mandays?: number | null
  assignee_id?: number | null
  sort_order?: number
}

interface TaskCustomization {
  template_task_id: number
  name: string
  include: boolean
  est_mandays?: number | null
  assignee_id?: number | null
}

interface DeliverableCustomization {
  template_deliverable_id: number
  name: string
  include: boolean
  tasks: TaskCustomization[]
  custom_tasks?: CustomTask[]
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const {
    project_id,
    name,
    template_id,
    assignee_id,
    planned_start_date,
    planned_end_date,
    customizations,
  } = body

  if (!project_id || !name) {
    return NextResponse.json({ error: 'project_id and name are required' }, { status: 400 })
  }

  // Calculate next module order
  const maxOrder = await prisma.module.aggregate({
    where: { project_id: Number(project_id) },
    _max: { order: true },
  })

  // Create the module
  const module = await prisma.module.create({
    data: {
      project_id: Number(project_id),
      title: name,
      start_date: planned_start_date ? new Date(planned_start_date) : null,
      end_date: planned_end_date ? new Date(planned_end_date) : null,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  })

  const dueDate = planned_end_date ? new Date(planned_end_date) : null
  const createdDeliverables: any[] = []

  // If no template selected (empty module), return immediately
  if (!template_id || !customizations?.deliverables?.length) {
    return NextResponse.json({ module, deliverables: [] }, { status: 201 })
  }

  // Get current max deliverable order for this project
  const maxDelivOrder = await prisma.deliverable.aggregate({
    where: { project_id: Number(project_id) },
    _max: { order: true },
  })
  let delivOrder = (maxDelivOrder._max.order ?? 0) + 1

  for (const dc of customizations.deliverables as DeliverableCustomization[]) {
    if (!dc.include) continue

    // Sum est_mandays of included tasks for the deliverable mandays field
    const includedTasks = dc.tasks.filter(t => t.include)
    const totalMandays = includedTasks.reduce(
      (sum, t) => sum + Number(t.est_mandays ?? 0),
      0
    )
    const customTaskMandays = (dc.custom_tasks ?? []).reduce(
      (sum, t) => sum + Number(t.est_mandays ?? 0),
      0
    )

    const deliverable = await prisma.deliverable.create({
      data: {
        project_id: Number(project_id),
        module_id: module.id,
        title: dc.name,
        mandays: Math.round(totalMandays + customTaskMandays),
        planned_start: planned_start_date ? new Date(planned_start_date) : null,
        planned_end: planned_end_date ? new Date(planned_end_date) : null,
        order: delivOrder++,
      },
    })

    const createdTasks: any[] = []

    // Create tasks from template
    let taskOrder = 1
    for (const tc of includedTasks) {
      const resolvedAssigneeId: number | null = tc.assignee_id ? Number(tc.assignee_id) : (assignee_id ? Number(assignee_id) : null)
      const task = await prisma.task.create({
        data: {
          deliverable_id: deliverable.id,
          title: tc.name,
          est_mandays: tc.est_mandays != null ? tc.est_mandays : null,
          due_date: dueDate,
          status: 'Todo',
          order: taskOrder++,
          assignees: resolvedAssigneeId ? { create: [{ user_id: resolvedAssigneeId }] } : undefined,
        },
      })
      createdTasks.push(task)
    }

    // Create custom tasks added by PM
    for (const ct of dc.custom_tasks ?? []) {
      if (!ct.name?.trim()) continue
      const resolvedAssigneeId: number | null = ct.assignee_id ? Number(ct.assignee_id) : (assignee_id ? Number(assignee_id) : null)
      const task = await prisma.task.create({
        data: {
          deliverable_id: deliverable.id,
          title: ct.name,
          est_mandays: ct.est_mandays != null ? ct.est_mandays : null,
          due_date: dueDate,
          status: 'Todo',
          order: taskOrder++,
          assignees: resolvedAssigneeId ? { create: [{ user_id: resolvedAssigneeId }] } : undefined,
        },
      })
      createdTasks.push(task)
    }

    createdDeliverables.push({ ...deliverable, tasks: createdTasks })
  }

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'CREATE',
      target_type: 'Module',
      target_id: module.id,
      metadata: { from_template: template_id, deliverable_count: createdDeliverables.length },
    },
  })

  return NextResponse.json({ module, deliverables: createdDeliverables }, { status: 201 })
}
