import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const body = await req.json()
  const update = await prisma.projectUpdate.create({
    data: {
      project_id: Number(body.project_id),
      user_id: Number(user.id),
      progress_pct: Number(body.progress_pct),
      status: body.status,
      notes: body.notes,
    },
  })

  // Update project status
  await prisma.project.update({
    where: { id: Number(body.project_id) },
    data: { status: body.status },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'UPDATE',
      target_type: 'ProjectUpdate',
      target_id: update.id,
      metadata: { project_id: body.project_id, progress_pct: body.progress_pct, status: body.status },
    },
  })

  return NextResponse.json(update, { status: 201 })
}
