import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import AppLayout from '@/components/Layout'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any

  const projects = await prisma.project.findMany({
    where: user.role === 'manager'
      ? {}
      : { assignees: { some: { user_id: Number(user.id) } } },
    include: {
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      updates: { orderBy: { created_at: 'desc' }, take: 1 },
      _count: { select: { issues: { where: { resolved: false } } } },
    },
    orderBy: { created_at: 'desc' },
  })

  // Compute task-based progress for each project (same logic as project detail page)
  type TaskCount = { project_id: number; total: bigint; done: bigint }
  const projectIds = projects.map(p => p.id)
  const taskCounts = projectIds.length > 0
    ? await prisma.$queryRaw<TaskCount[]>(
        Prisma.sql`
          SELECT d.project_id, COUNT(t.id) AS total,
                 COUNT(CASE WHEN t.status = 'Done' THEN 1 END) AS done
          FROM "Deliverable" d
          INNER JOIN "Task" t ON t.deliverable_id = d.id
          WHERE d.project_id = ANY(ARRAY[${Prisma.join(projectIds)}]::int[])
          GROUP BY d.project_id
        `
      )
    : []

  const taskMap = new Map(taskCounts.map(r => [Number(r.project_id), r]))

  const projectsWithProgress = projects.map(p => {
    const stats = taskMap.get(p.id)
    const computedProgress = stats && Number(stats.total) > 0
      ? Math.round(Number(stats.done) / Number(stats.total) * 100)
      : (p.updates[0]?.progress_pct ?? 0)
    return { ...p, computedProgress }
  })

  return (
    <AppLayout>
      <DashboardClient projects={JSON.parse(JSON.stringify(projectsWithProgress))} session={JSON.parse(JSON.stringify(session))} />
    </AppLayout>
  )
}
