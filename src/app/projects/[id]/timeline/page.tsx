import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/Layout'
import Link from 'next/link'
import GanttChart from '@/components/GanttChart'

export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const projectId = Number(id)

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, start_date: true, deadline: true },
  })

  if (!project) notFound()

  const [projectModules, deliverables] = await Promise.all([
    prisma.module.findMany({
      where: { project_id: projectId },
      orderBy: { order: 'asc' },
    }),
    prisma.deliverable.findMany({
      where: { project_id: projectId },
      include: {
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    }),
  ])

  const ganttModules = projectModules.map(m => ({ id: m.id, title: m.title }))

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

  const serializedProject = {
    id: project.id,
    title: project.title,
    start_date: project.start_date.toISOString(),
    deadline: project.deadline.toISOString(),
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/projects/${projectId}`}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm"
        >
          ← Back to Project
        </Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{project.title}</h1>
      </div>

      <GanttChart project={serializedProject} deliverables={ganttDeliverables} modules={ganttModules} />
    </AppLayout>
  )
}
