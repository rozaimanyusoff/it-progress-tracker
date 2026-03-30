import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/Layout'
import Link from 'next/link'
import DeliverableSection from '@/components/DeliverableSection'
import GanttChart from '@/components/GanttChart'

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

  const latestProgress = project.updates[0]?.progress_pct ?? 0

  const statusLabel: Record<string, string> = { InProgress: 'In Progress', OnHold: 'On Hold', Done: 'Done', Pending: 'Pending' }
  const statusColors: Record<string, string> = {
    Done:       'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700',
    InProgress: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700',
    OnHold:     'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700',
    Pending:    'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600',
  }

  // Circle progress SVG values
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (latestProgress / 100) * circumference

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href="/dashboard" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm">← Back</Link>
      </div>

      {/* Header + Gantt card */}
      <div className="rounded-xl border mb-6 bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 overflow-hidden">
        {/* Title row */}
        <div className="flex items-center gap-6 p-6 border-b border-slate-100 dark:border-navy-700">
          {/* Circular progress */}
          <div className="shrink-0 relative w-24 h-24">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
              <circle cx="44" cy="44" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-navy-700" />
              <circle
                cx="44" cy="44" r={radius}
                fill="none" stroke="currentColor" strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className={latestProgress >= 100 ? 'text-green-500' : 'text-blue-500'}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-slate-900 dark:text-white leading-none">{latestProgress}%</span>
              <span className="text-xs text-slate-400 mt-0.5">progress</span>
            </div>
          </div>

          {/* Project info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{project.title}</h1>
                {project.description && <p className="text-slate-500 dark:text-slate-400 mt-1">{project.description}</p>}
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                  <span>Assignees: <span className="text-slate-700 dark:text-slate-300">{project.assignees.map(a => a.user.name).join(', ') || '—'}</span></span>
                  <span>Deadline: <span className="text-slate-700 dark:text-slate-300">{new Date(project.deadline).toLocaleDateString()}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href={`/projects/${project.id}/timeline`}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
                >
                  View Timeline
                </Link>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[project.status] || statusColors.Pending}`}>
                  {statusLabel[project.status] || project.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gantt chart — inside the same card, no padding so it fills edge-to-edge */}
        <GanttChart
          project={{
            id: project.id,
            title: project.title,
            start_date: project.start_date.toISOString(),
            deadline: project.deadline.toISOString(),
          }}
          deliverables={ganttDeliverables}
          modules={ganttModules}
          embedded
        />
      </div>

      {/* Modules & Deliverables Section */}
      <div className="mt-6">
        <DeliverableSection
          projectId={project.id}
          userRole={(session.user as any).role}
          projectStartDate={project.start_date.toISOString()}
          projectDeadline={project.deadline.toISOString()}
        />
      </div>
    </AppLayout>
  )
}
