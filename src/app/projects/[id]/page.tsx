import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import AppLayout from '@/components/Layout'
import ProjectDetailCard from '@/components/ProjectDetailCard'
import DeveloperAnalytics from '@/components/DeveloperAnalytics'
import DeliverableSidebar from '@/components/DeliverableSidebar'
import ProjectNavBar from '@/components/ProjectNavBar'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const project = await prisma.project.findUnique({
    where: { id: Number(id) },
    include: {
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      updates: { select: { progress_pct: true }, orderBy: { created_at: 'desc' }, take: 1 },
    },
  })

  if (!project) notFound()

  // Fetch sibling projects for the nav bar (lightweight)
  const user = session.user as any
  const siblingProjects = await prisma.project.findMany({
    where: user.role === 'manager'
      ? {}
      : { assignees: { some: { user_id: Number(user.id) } } },
    select: {
      id: true,
      title: true,
      status: true,
      updates: { select: { progress_pct: true }, orderBy: { created_at: 'desc' }, take: 1 },
    },
    orderBy: { created_at: 'desc' },
  })

  // Compute progress + status for nav bar
  type SiblingTaskCount = { project_id: bigint; total: bigint; done: bigint }
  const siblingIds = siblingProjects.map(p => p.id)
  const siblingTaskCounts = siblingIds.length > 0
    ? await prisma.$queryRaw<SiblingTaskCount[]>(
        Prisma.sql`
          SELECT d.project_id, COUNT(t.id) AS total,
                 COUNT(CASE WHEN t.status = 'Done' THEN 1 END) AS done
          FROM "Deliverable" d
          INNER JOIN "Task" t ON t.deliverable_id = d.id
          WHERE d.project_id = ANY(ARRAY[${Prisma.join(siblingIds)}]::int[])
          GROUP BY d.project_id
        `
      )
    : []
  const siblingTaskMap = new Map(siblingTaskCounts.map(r => [Number(r.project_id), r]))
  const navProjects = siblingProjects.map(p => {
    const stats = siblingTaskMap.get(p.id)
    const computedProgress = stats && Number(stats.total) > 0
      ? Math.round(Number(stats.done) / Number(stats.total) * 100)
      : (p.updates[0]?.progress_pct ?? 0)
    const computedStatus = (() => {
      if (p.status === 'OnHold') return 'OnHold'
      if (computedProgress >= 100) return 'Done'
      if (computedProgress > 0) return 'InProgress'
      return p.status
    })()
    return { id: p.id, title: p.title, computedProgress, computedStatus }
  })

  // Fetch modules, deliverables, and open issue count
  const [projectModules, deliverables, openIssueCount] = await Promise.all([
    prisma.module.findMany({
      where: { project_id: project.id },
      orderBy: { order: 'asc' },
    }),
    prisma.deliverable.findMany({
      where: { project_id: project.id },
      include: {
        tasks: {
          include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
          orderBy: { order: 'asc' },
        },
        _count: { select: { issues: { where: { issue_status: { notIn: ['resolved', 'closed'] } } } } },
      },
      orderBy: { order: 'asc' },
    }),
    prisma.issue.count({
      where: {
        project_id: project.id,
        issue_status: { notIn: ['resolved', 'closed'] },
      },
    }),
  ])

  const ganttModules = projectModules.map(m => ({
    id: m.id,
    title: m.title,
    start_date: m.start_date?.toISOString() ?? null,
    end_date: m.end_date?.toISOString() ?? null,
  }))

  const ganttDeliverables = deliverables.map(d => ({
    id: d.id,
    title: d.title,
    status: d.status,
    mandays: d.mandays,
    planned_start: d.planned_start?.toISOString() ?? null,
    planned_end: d.planned_end?.toISOString() ?? null,
    actual_start: d.actual_start?.toISOString() ?? null,
    actual_end: d.actual_end?.toISOString() ?? null,
    module_id: d.module_id ?? null,
    _count: d._count,
    tasks: d.tasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      actual_start: t.actual_start?.toISOString() ?? null,
      actual_end: t.actual_end?.toISOString() ?? null,
      assignees: t.assignees.map((a: any) => a.user),
    })),
  }))

  // Compute progress & status from tasks when deliverables exist; else fall back to manual update
  const allTasks = deliverables.flatMap(d => d.tasks)
  const computedProgress = allTasks.length > 0
    ? Math.round(allTasks.filter(t => t.status === 'Done').length / allTasks.length * 100)
    : (project.updates[0]?.progress_pct ?? 0)

  const latestProgress = computedProgress

  const computedStatus = (() => {
    if (deliverables.length === 0) return project.status
    if (deliverables.every(d => d.status === 'Done')) return 'Done'
    if (deliverables.some(d => d.status === 'InProgress' || d.status === 'OnHold')) return 'InProgress'
    if (deliverables.some(d => d.status === 'Done')) return 'InProgress' // partial
    return 'Pending'
  })()

  return (
    <AppLayout>
      <ProjectNavBar projects={navProjects} currentId={project.id} />

      {/* Header + Gantt + Burndown card */}
      <ProjectDetailCard
        project={{
          id: project.id,
          title: project.title,
          description: project.description,
          status: project.status,
          start_date: project.start_date.toISOString(),
          deadline: project.deadline.toISOString(),
          health_status: project.health_status,
          unit_id: project.unit_id,
          dept_id: project.dept_id,
          company_id: project.company_id,
          assignees: project.assignees,
        }}
        isManager={(session.user as any).role === 'manager'}
        latestProgress={latestProgress}
        computedStatus={computedStatus}
        ganttDeliverables={ganttDeliverables}
        ganttModules={ganttModules}
        openIssueCount={openIssueCount}
      />

      {/* Modules & Deliverables — right slide-in sidebar */}
      <DeliverableSidebar
        projectId={project.id}
        projectTitle={project.title}
        userRole={(session.user as any).role}
        projectStartDate={project.start_date.toISOString()}
        projectDeadline={project.deadline.toISOString()}
      />

      {/* Developer Analytics — per project */}
      <div className="mt-6">
        <DeveloperAnalytics projectId={project.id} />
      </div>
    </AppLayout>
  )
}
