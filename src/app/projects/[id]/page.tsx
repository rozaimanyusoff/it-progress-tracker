import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/Layout'
import Link from 'next/link'
import DeliverableSection from '@/components/DeliverableSection'
import ProjectIssueSection from '@/components/ProjectIssueSection'
import ProjectDetailCard from '@/components/ProjectDetailCard'

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

  // Fetch modules and deliverables for the Gantt chart
  const [projectModules, deliverables] = await Promise.all([
    prisma.module.findMany({
      where: { project_id: project.id },
      orderBy: { order: 'asc' },
    }),
    prisma.deliverable.findMany({
      where: { project_id: project.id },
      include: {
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
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
    tasks: d.tasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      actual_start: t.actual_start?.toISOString() ?? null,
      actual_end: t.actual_end?.toISOString() ?? null,
      assigned_to: t.assigned_to,
      assignee: t.assignee,
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
      <div className="mb-6">
        <Link href="/dashboard" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm">← Back</Link>
      </div>

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
          assignees: project.assignees,
        }}
        isManager={(session.user as any).role === 'manager'}
        latestProgress={latestProgress}
        computedStatus={computedStatus}
        ganttDeliverables={ganttDeliverables}
        ganttModules={ganttModules}
      />

      {/* Modules & Deliverables Section */}
      <div className="mt-6">
        <DeliverableSection
          projectId={project.id}
          userRole={(session.user as any).role}
          projectStartDate={project.start_date.toISOString()}
          projectDeadline={project.deadline.toISOString()}
        />
      </div>

      <ProjectIssueSection projectId={project.id} />
    </AppLayout>
  )
}
