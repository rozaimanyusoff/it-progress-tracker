import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const module = await prisma.module.update({
    where: { id: Number(id) },
    data: {
      title: body.title,
      description: body.description ?? null,
      start_date: body.start_date ? new Date(body.start_date) : null,
      end_date: body.end_date ? new Date(body.end_date) : null,
    },
  })

  return NextResponse.json(module)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const moduleId = Number(id)

  const mod = await prisma.module.findUnique({ where: { id: moduleId }, select: { title: true, project_id: true } })
  if (!mod) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const deliverableCount = await prisma.deliverable.count({ where: { module_id: moduleId } })
  if (deliverableCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete module "${mod.title}" — it still has ${deliverableCount} deliverable(s). Remove all deliverables first.` },
      { status: 409 }
    )
  }

  const featureLinkCount = await prisma.projectFeature.count({ where: { module_id: moduleId } })
  if (featureLinkCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete module "${mod.title}" — it still has ${featureLinkCount} feature(s) linked. Unlink all features first.` },
      { status: 409 }
    )
  }

  await prisma.module.delete({ where: { id: moduleId } })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'DELETE',
      target_type: 'Module',
      target_id: moduleId,
      metadata: { title: mod.title, project_id: mod.project_id },
    },
  })

  return NextResponse.json({ success: true })
}
