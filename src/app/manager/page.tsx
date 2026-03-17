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

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Manager Overview</h1>
        <p className="text-slate-400 mt-1">All units and projects at a glance</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Projects', value: totalProjects, color: 'text-blue-400' },
          { label: 'Completed', value: doneProjects, color: 'text-green-400' },
          { label: 'Open Issues', value: totalIssues, color: 'text-red-400' },
          { label: 'Units', value: units.length, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-5 border" style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}>
            <p className="text-slate-400 text-sm">{s.label}</p>
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
            <div key={unit.id} className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1e3a5f', backgroundColor: '#162d4a' }}>
                <div>
                  <h2 className="font-semibold text-white">{unit.name}</h2>
                  <p className="text-slate-400 text-sm">{unit.projects.length} projects · avg {avg}% complete</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-navy-900 rounded-full h-2" style={{ backgroundColor: '#0a1628' }}>
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${avg}%` }} />
                  </div>
                  <span className="text-blue-400 font-medium text-sm">{avg}%</span>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: '#1e3a5f' }}>
                    <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Project</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">PIC</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Progress</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Issues</th>
                    <th className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#1e3a5f' }}>
                  {unit.projects.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-6 text-center text-slate-500 text-sm">No projects</td></tr>
                  )}
                  {unit.projects.map(project => {
                    const progress = project.updates[0]?.progress_pct ?? 0
                    const statusMap: Record<string, string> = {
                      Done: 'bg-green-900/50 text-green-400',
                      InProgress: 'bg-orange-900/50 text-orange-400',
                      OnHold: 'bg-red-900/50 text-red-400',
                      Pending: 'bg-slate-700 text-slate-400',
                    }
                    const statusLabel: Record<string, string> = { InProgress: 'In Progress', OnHold: 'On Hold', Done: 'Done', Pending: 'Pending' }
                    return (
                      <tr key={project.id} className="hover:bg-navy-700 transition-colors">
                        <td className="px-6 py-3">
                          <Link href={`/projects/${project.id}`} className="text-white hover:text-blue-400 font-medium text-sm">
                            {project.title}
                          </Link>
                        </td>
                        <td className="px-6 py-3 text-slate-300 text-sm">{project.owner.name}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2 max-w-32">
                            <div className="flex-1 rounded-full h-1.5" style={{ backgroundColor: '#0a1628' }}>
                              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[project.status] || statusMap.Pending}`}>
                            {statusLabel[project.status] || project.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-sm">
                          {project._count.issues > 0
                            ? <span className="text-red-400">{project._count.issues}</span>
                            : <span className="text-slate-500">0</span>
                          }
                        </td>
                        <td className="px-6 py-3">
                          <Link href={`/projects/${project.id}`} className="text-blue-400 hover:text-blue-300 text-sm">View →</Link>
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
