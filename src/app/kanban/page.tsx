import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/Layout'
import KanbanBoard from '@/components/KanbanBoard'

export default async function KanbanPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any

  // Projects the user owns or is assigned to as ProjectMember
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { owner_id: Number(user.id) },
        { members: { some: { user_id: Number(user.id) } } },
      ],
    },
    select: { id: true, title: true, status: true },
    orderBy: { created_at: 'desc' },
  })

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">My Kanban Board</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {user.name} · Select a project to filter tasks, add todos, or respond to issues
        </p>
      </div>
      <KanbanBoard
        projects={JSON.parse(JSON.stringify(projects))}
        userId={Number(user.id)}
      />
    </AppLayout>
  )
}
