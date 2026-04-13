import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const task = await prisma.task.findUnique({
    where: { id: Number(id) },
    include: {
      feature: {
        include: {
          project_links: {
            include: { project: { include: { assignees: true } } },
          },
        },
      },
    },
  })

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify developer is assigned to at least one project this feature belongs to
  if (user.role !== 'manager') {
    const isAssigned = task.feature?.project_links.some(l =>
      l.project.assignees.some(a => a.user_id === Number(user.id))
    ) ?? false
    if (!isAssigned) {
      return NextResponse.json({ error: 'You are not assigned to this project' }, { status: 403 })
    }
  }

  // Add user to task assignees (upsert — no duplicate)
  await prisma.taskAssignee.upsert({
    where: { task_id_user_id: { task_id: Number(id), user_id: Number(user.id) } },
    create: { task_id: Number(id), user_id: Number(user.id) },
    update: {},
  })

  const updated = await prisma.task.findUnique({
    where: { id: Number(id) },
    include: {
      assignees: { include: { user: { select: { id: true, name: true } } } },
      feature: { select: { id: true, title: true } },
    },
  })

  return NextResponse.json(updated)
}
