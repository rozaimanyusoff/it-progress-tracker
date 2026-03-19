import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/Layout'
import Link from 'next/link'
import FeaturesSection from '@/components/FeaturesSection'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const project = await prisma.project.findUnique({
    where: { id: Number(params.id) },
    include: {
      unit: true,
      owner: { select: { id: true, name: true, email: true } },
      updates: { include: { user: { select: { name: true } } }, orderBy: { created_at: 'desc' } },
      issues: { include: { user: { select: { name: true } } }, orderBy: { created_at: 'desc' } },
    },
  })

  if (!project) notFound()

  const latestProgress = project.updates[0]?.progress_pct ?? 0
  const statusLabel: Record<string, string> = { InProgress: 'In Progress', OnHold: 'On Hold', Done: 'Done', Pending: 'Pending' }
  const statusColors: Record<string, string> = {
    Done: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700',
    InProgress: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700',
    OnHold: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700',
    Pending: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600',
  }
  const sevColors: Record<string, string> = {
    high: 'text-red-600 dark:text-red-400',
    medium: 'text-orange-600 dark:text-orange-400',
    low: 'text-green-600 dark:text-green-400',
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href="/dashboard" className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm">← Back</Link>
      </div>

      {/* Header */}
      <div className="rounded-xl border p-6 mb-6 bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{project.title}</h1>
            {project.description && <p className="text-slate-500 dark:text-slate-400 mt-1">{project.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400">
              <span>Unit: <span className="text-slate-700 dark:text-slate-300">{project.unit.name}</span></span>
              <span>PIC: <span className="text-slate-700 dark:text-slate-300">{project.owner.name}</span></span>
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
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500 dark:text-slate-400">Overall Progress</span>
            <span className="text-slate-900 dark:text-white font-medium">{latestProgress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-navy-900 rounded-full h-3">
            <div className="h-3 rounded-full bg-blue-500 transition-all" style={{ width: `${latestProgress}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Updates timeline */}
        <div className="rounded-xl border overflow-hidden bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
            <h2 className="font-semibold text-slate-900 dark:text-white">Progress Timeline</h2>
          </div>
          <div className="p-6">
            {project.updates.length === 0 && <p className="text-slate-400 text-sm">No updates yet.</p>}
            <div className="space-y-4">
              {project.updates.map((u, i) => (
                <div key={u.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                    {i < project.updates.length - 1 && <div className="w-0.5 flex-1 bg-blue-200 dark:bg-blue-900 mt-1" />}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-900 dark:text-white font-medium text-sm">{u.progress_pct}%</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[u.status] || statusColors.Pending}`}>
                        {statusLabel[u.status] || u.status}
                      </span>
                    </div>
                    {u.notes && <p className="text-slate-500 dark:text-slate-400 text-sm">{u.notes}</p>}
                    <p className="text-slate-400 text-xs mt-1">{u.user.name} · {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Issues */}
        <div className="rounded-xl border overflow-hidden bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
            <h2 className="font-semibold text-slate-900 dark:text-white">Issues ({project.issues.length})</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-navy-700">
            {project.issues.length === 0 && <p className="px-6 py-6 text-slate-400 text-sm">No issues reported.</p>}
            {project.issues.map(issue => (
              <div key={issue.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`font-medium text-sm ${issue.resolved ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                      {issue.title}
                    </p>
                    {issue.description && <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{issue.description}</p>}
                    <p className="text-slate-400 text-xs mt-1">{issue.user.name} · {new Date(issue.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium uppercase ${sevColors[issue.severity]}`}>{issue.severity}</span>
                    {issue.resolved && <span className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Resolved</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mt-6">
        <FeaturesSection
          projectId={project.id}
          unitId={project.unit_id}
          userRole={(session.user as any).role}
        />
      </div>
    </AppLayout>
  )
}
