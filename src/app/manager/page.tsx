import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/Layout'
import Link from 'next/link'

export default async function ManagerPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const user = session.user as any
  if (user.role !== 'manager') redirect('/dashboard')

  const units = await prisma.unit.findMany({
    include: {
      projects: {
        include: {
          owner: { select: { name: true } },
          updates: { orderBy: { created_at: 'desc' }, take: 1 },
          _count: { select: { issues: { where: { resolved: false } } } },
        },
      },
    },
  })

  const totalProjects = units.reduce((s, u) => s + u.projects.length, 0)
  const totalIssues = units.reduce((s, u) => s + u.projects.reduce((s2, p) => s2 + p._count.issues, 0), 0)
  const doneProjects = units.reduce((s, u) => s + u.projects.filter(p => p.status === 'Done').length, 0)

  const statusMap: Record<string, string> = {
    Done: 'bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-400',
    InProgress: 'bg-orange-50 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
    OnHold: 'bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-400',
    Pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  }
  const statusLabel: Record<string, string> = { InProgress: 'In Progress', OnHold: 'On Hold', Done: 'Done', Pending: 'Pending' }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manager Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">All units and projects at a glance</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Projects', value: totalProjects, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Completed', value: doneProjects, color: 'text-green-600 dark:text-green-400' },
          { label: 'Open Issues', value: totalIssues, color: 'text-red-600 dark:text-red-400' },
          { label: 'Units', value: units.length, color: 'text-purple-600 dark:text-purple-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-5 border bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
            <p className="text-slate-500 dark:text-slate-400 text-sm">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Units */}
      <div className="space-y-6">
        {units.map(unit => {
          const avg = unit.projects.length
            ? Math.round(unit.projects.reduce((s, p) => s + (p.updates[0]?.progress_pct ?? 0), 0) / unit.projects.length)
            : 0

          return (
            <div key={unit.id} className="rounded-xl border overflow-hidden bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between bg-slate-50 dark:bg-navy-700">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">{unit.name}</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{unit.projects.length} projects · avg {avg}% complete</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-slate-200 dark:bg-navy-900 rounded-full h-2">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${avg}%` }} />
                  </div>
                  <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">{avg}%</span>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-navy-700 text-left">
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Project</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">PIC</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Progress</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Issues</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                  {unit.projects.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-6 text-center text-slate-400 text-sm">No projects</td></tr>
                  )}
                  {unit.projects.map(project => {
                    const progress = project.updates[0]?.progress_pct ?? 0
                    return (
                      <tr key={project.id} className="hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                        <td className="px-6 py-3">
                          <Link href={`/projects/${project.id}`} className="text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm">
                            {project.title}
                          </Link>
                        </td>
                        <td className="px-6 py-3 text-slate-600 dark:text-slate-300 text-sm">{project.owner.name}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2 max-w-32">
                            <div className="flex-1 bg-slate-200 dark:bg-navy-900 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[project.status] || statusMap.Pending}`}>
                            {statusLabel[project.status] || project.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm">
                          {project._count.issues > 0
                            ? <span className="text-red-500 dark:text-red-400">{project._count.issues}</span>
                            : <span className="text-slate-400">0</span>
                          }
                        </td>
                        <td className="px-6 py-3">
                          <Link href={`/projects/${project.id}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm">View →</Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </AppLayout>
  )
}
