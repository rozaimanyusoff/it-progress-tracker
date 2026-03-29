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
    include: { feature: { include: { project: { include: { assignees: true } } } } },
  })

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify developer is assigned to the project
  const isAssigned = task.feature.project.assignees.some(a => a.user_id === Number(user.id))
  if (!isAssigned && user.role !== 'manager') {
    return NextResponse.json({ error: 'You are not assigned to this project' }, { status: 403 })
  }

  const updated = await prisma.task.update({
    where: { id: Number(id) },
    data: { assigned_to: Number(user.id) },
    include: {
      assignee: { select: { id: true, name: true } },
      feature: { select: { id: true, title: true, project: { select: { id: true, title: true } } } },
    },
  })

  return NextResponse.json(updated)
}
