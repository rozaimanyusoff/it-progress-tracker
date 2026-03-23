import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const severity = searchParams.get('severity')
  const resolved = searchParams.get('resolved')

  const where: any = {}
  if (severity) where.severity = severity
  if (resolved !== null && resolved !== '') where.resolved = resolved === 'true'

  const issues = await prisma.issue.findMany({
    where,
    include: {
      project: true,
      user: { select: { name: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  return NextResponse.json(issues)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const body = await req.json()
  const issue = await prisma.issue.create({
    data: {
      project_id: Number(body.project_id),
      user_id: Number(user.id),
      title: body.title,
      description: body.description,
      severity: body.severity || 'medium',
    },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'CREATE',
      target_type: 'Issue',
      target_id: issue.id,
      metadata: { title: issue.title, severity: issue.severity },
    },
  })

  return NextResponse.json(issue, { status: 201 })
}
