import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateReportPPTX, ReportSections } from '@/lib/pptx'
import { sendExportEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const projectIds: number[] = (body.project_ids ?? []).map(Number)
  const fromMonth: string = body.from_month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
  const toMonth: string = body.to_month || fromMonth
  const sections: ReportSections = {
    gantt: body.sections?.gantt ?? true,
    burndown: body.sections?.burndown ?? true,
    issues: body.sections?.issues ?? true,
  }

  if (projectIds.length === 0) {
    return NextResponse.json({ error: 'No projects selected' }, { status: 400 })
  }

  // Fetch selected projects with full data (including task assignee + time)
  const projectsData = await Promise.all(
    projectIds.map(async (projectId) => {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          assignees: { include: { user: { select: { name: true } } } },
          updates: { orderBy: { created_at: 'desc' }, take: 1 },
        },
      })
      if (!project) return null

      const [modules, deliverables] = await Promise.all([
        prisma.module.findMany({ where: { project_id: projectId }, orderBy: { order: 'asc' } }),
        prisma.deliverable.findMany({
          where: { project_id: projectId },
          include: {
            tasks: {
              select: {
                status: true,
                actual_end: true,
                time_spent_seconds: true,
                assigned_to: true,
                assignee: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { order: 'asc' },
        }),
      ])

      return { project, modules, deliverables }
    })
  )

  const validProjects = projectsData.filter(Boolean) as NonNullable<typeof projectsData[0]>[]

  // Fetch open issues for selected projects
  const openIssues = await prisma.issue.findMany({
    where: { resolved: false, project_id: { in: projectIds } },
    include: { project: true },
  })
  const issueData = openIssues.map(i => ({
    title: i.title,
    project: i.project.title,
    severity: i.severity,
  }))

  const buffer = await generateReportPPTX(fromMonth, toMonth, validProjects, issueData, sections)

  // Send email to all active users
  try {
    const allUsers = await prisma.user.findMany({ where: { is_active: true }, select: { email: true } })
    const emails = allUsers.map(u => u.email)
    const monthLabel = fromMonth === toMonth ? fromMonth : `${fromMonth} — ${toMonth}`
    await sendExportEmail(emails, monthLabel, buffer)
  } catch (e) {
    console.error('Email send failed:', e)
  }

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'EXPORT',
      target_type: 'Report',
      target_id: 0,
      metadata: { from_month: fromMonth, to_month: toMonth, project_ids: projectIds, sections },
    },
  })

  const base64 = buffer.toString('base64')
  return NextResponse.json({ success: true, file: base64 })
}


