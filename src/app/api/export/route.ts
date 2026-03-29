import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePPTX } from '@/lib/pptx'
import { sendExportEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const month = body.month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' })

  // Fetch all projects
  const projects = await prisma.project.findMany({
    include: {
      assignees: { include: { user: { select: { name: true } } } },
      updates: { orderBy: { created_at: 'desc' }, take: 1 },
    },
  })

  const projectData = projects.map(p => {
    const lastUpdate = p.updates[0]
    return {
      title: p.title,
      progress: lastUpdate?.progress_pct ?? 0,
      status: p.status,
      owner: p.assignees.map(a => a.user.name).join(', ') || '—',
    }
  })

  // Fetch open issues
  const issues = await prisma.issue.findMany({
    where: { resolved: false },
    include: {
      project: true,
    },
  })

  const issueData = issues.map(i => ({
    title: i.title,
    project: i.project.title,
    severity: i.severity,
  }))

  const buffer = await generatePPTX(month, projectData, issueData)

  // Send email
  const allUsers = await prisma.user.findMany({ select: { email: true } })
  const emails = allUsers.map(u => u.email)

  try {
    await sendExportEmail(emails, month, buffer)
  } catch (e) {
    console.error('Email send failed:', e)
  }

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'EXPORT',
      target_type: 'Report',
      target_id: 0,
      metadata: { month, recipients: emails.length },
    },
  })

  const base64 = buffer.toString('base64')
  return NextResponse.json({ success: true, file: base64, month })
}
