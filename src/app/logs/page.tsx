import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/Layout'

export default async function LogsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const user = session.user as any
  if (user.role !== 'manager') redirect('/dashboard')

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { created_at: 'desc' },
    take: 200,
  })

  const actionColors: Record<string, string> = {
    CREATE: 'bg-green-900/50 text-green-400',
    UPDATE: 'bg-blue-900/50 text-blue-400',
    DELETE: 'bg-red-900/50 text-red-400',
    EXPORT: 'bg-purple-900/50 text-purple-400',
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
        <p className="text-slate-400 mt-1">Complete audit trail of all actions</p>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#0f1f35', borderColor: '#1e3a5f' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: '#1e3a5f', backgroundColor: '#162d4a' }}>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Target</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: '#1e3a5f' }}>
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-500">No logs yet.</td></tr>
            )}
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-navy-700 transition-colors">
                <td className="px-6 py-3 text-slate-400 text-sm whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-3">
                  <p className="text-white text-sm">{log.user.name}</p>
                  <p className="text-slate-500 text-xs">{log.user.email}</p>
                </td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[log.action] || 'bg-slate-700 text-slate-400'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-3 text-slate-300 text-sm">
                  {log.target_type} #{log.target_id}
                </td>
                <td className="px-6 py-3 text-slate-500 text-xs font-mono max-w-xs truncate">
                  {log.metadata ? JSON.stringify(log.metadata) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
