import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const body = await req.json()
  const data: Record<string, any> = {}
  if (body.resolved !== undefined) data.resolved = body.resolved
  if (body.response !== undefined) data.response = body.response

  const issue = await prisma.issue.update({
    where: { id: Number(id) },
    data,
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'UPDATE',
      target_type: 'Issue',
      target_id: issue.id,
      metadata: { resolved: data.resolved, hasResponse: !!data.response },
    },
  })

  return NextResponse.json(issue)
}
