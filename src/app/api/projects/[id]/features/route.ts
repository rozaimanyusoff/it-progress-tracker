import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/projects/[id]/features — link a feature to this project
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const projectId = Number(id)
  const body = await req.json()
  const { feature_id, module_id } = body

  if (!feature_id) return NextResponse.json({ error: 'feature_id required' }, { status: 400 })

  const link = await prisma.projectFeature.upsert({
    where: { project_id_feature_id: { project_id: projectId, feature_id: Number(feature_id) } },
    create: { project_id: projectId, feature_id: Number(feature_id), module_id: module_id ? Number(module_id) : null },
    update: { module_id: module_id ? Number(module_id) : null },
  })

  return NextResponse.json(link, { status: 201 })
}

// DELETE /api/projects/[id]/features — unlink a feature from this project
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const projectId = Number(id)
  const { feature_id } = await req.json()

  if (!feature_id) return NextResponse.json({ error: 'feature_id required' }, { status: 400 })

  await prisma.projectFeature.delete({
    where: { project_id_feature_id: { project_id: projectId, feature_id: Number(feature_id) } },
  })

  return NextResponse.json({ ok: true })
}
