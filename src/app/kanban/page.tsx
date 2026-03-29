import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/Layout'
import KanbanBoard from '@/components/KanbanBoard'
import TeamKanbanBoard from '@/components/TeamKanbanBoard'

export default async function KanbanPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any
  const isManager = user.role === 'manager'

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {isManager ? 'Team Kanban Board' : 'My Kanban Board'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {isManager
            ? 'All tasks across assigned projects · Filter by project or feature'
            : `Tasks assigned to ${user.name} · Drag cards or use arrows to update status`}
        </p>
      </div>
      {isManager ? <TeamKanbanBoard /> : <KanbanBoard />}
    </AppLayout>
  )
}
