import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendProjectDeleted } from '@/lib/email'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await prisma.project.findUnique({
    where: { id: Number(id) },
    include: {
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      updates: { include: { user: { select: { name: true } } }, orderBy: { created_at: 'desc' } },
      issues: { include: { user: { select: { name: true } } }, orderBy: { created_at: 'desc' } },
    },
  })

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const assigneeIds: number[] = (body.assignee_ids ?? []).map(Number)

  const project = await prisma.project.update({
    where: { id: Number(id) },
    data: {
      title: body.title,
      description: body.description,
      status: body.status,
      start_date: body.start_date ? new Date(body.start_date) : undefined,
      deadline: body.deadline ? new Date(body.deadline) : undefined,
      unit_id: 'unit_id' in body ? (body.unit_id ?? null) : undefined,
      dept_id: 'dept_id' in body ? (body.dept_id ?? null) : undefined,
      company_id: 'company_id' in body ? (body.company_id ?? null) : undefined,
      assignees: assigneeIds.length > 0
        ? {
          deleteMany: {},
          create: assigneeIds.map(uid => ({ user_id: uid })),
        }
        : undefined,
    },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'UPDATE',
      target_type: 'Project',
      target_id: project.id,
      metadata: { changes: body },
    },
  })

  return NextResponse.json(project)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const projectId = Number(id)

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { title: true } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Find features linked exclusively to this project (not shared with other projects)
  const featureLinks = await prisma.projectFeature.findMany({
    where: { project_id: projectId },
    select: { feature_id: true },
  })
  const allFeatureIds = featureLinks.map(f => f.feature_id)

  const exclusiveFeatureIds: number[] = []
  for (const featureId of allFeatureIds) {
    const linkCount = await prisma.projectFeature.count({ where: { feature_id: featureId } })
    if (linkCount === 1) exclusiveFeatureIds.push(featureId)
  }

  await prisma.$transaction(async (tx) => {
    // Clean up tasks under exclusive features (not covered by Deliverable cascade)
    if (exclusiveFeatureIds.length > 0) {
      const featureTasks = await tx.task.findMany({
        where: { feature_id: { in: exclusiveFeatureIds }, deliverable_id: null },
        select: { id: true },
      })
      const featureTaskIds = featureTasks.map(t => t.id)
      if (featureTaskIds.length > 0) {
        await tx.taskUpdate.deleteMany({ where: { task_id: { in: featureTaskIds } } })
        await tx.issue.updateMany({ where: { task_id: { in: featureTaskIds } }, data: { task_id: null } })
        await tx.task.deleteMany({ where: { id: { in: featureTaskIds } } })
      }
      await tx.featureDeveloper.deleteMany({ where: { feature_id: { in: exclusiveFeatureIds } } })
      await tx.feature.deleteMany({ where: { id: { in: exclusiveFeatureIds } } })
    }

    // Delete project updates and issues (no DB cascade on these relations)
    await tx.projectUpdate.deleteMany({ where: { project_id: projectId } })
    await tx.issue.deleteMany({ where: { project_id: projectId } })

    // Delete project — DB cascades: Modules, Deliverables→Tasks→TaskUpdates, ProjectAssignees, ProjectFeature links
    await tx.project.delete({ where: { id: projectId } })
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'DELETE',
      target_type: 'Project',
      target_id: projectId,
      metadata: { title: project.title },
    },
  })

  // Notify other active managers about the project deletion
  const otherManagers = await prisma.user.findMany({
    where: { role: 'manager', is_active: true, NOT: { id: Number(user.id) } },
    select: { email: true },
  })
  const managerEmails = otherManagers.map((m) => m.email)
  if (managerEmails.length > 0) {
    sendProjectDeleted(managerEmails, project.title, user.name).catch(() => { })
  }

  return NextResponse.json({ success: true })
}
