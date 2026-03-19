import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/Layout'
import KanbanBoard from '@/components/KanbanBoard'

export default async function KanbanPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Kanban Board</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Tasks assigned to {user.name} · Drag cards or use arrows to update status
        </p>
      </div>
      <KanbanBoard />
    </AppLayout>
  )
}
