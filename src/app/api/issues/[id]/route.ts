import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const body = await req.json()
  const issue = await prisma.issue.update({
    where: { id: Number(params.id) },
    data: { resolved: body.resolved },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'UPDATE',
      target_type: 'Issue',
      target_id: issue.id,
      metadata: { resolved: body.resolved },
    },
  })

  return NextResponse.json(issue)
}
