import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/Layout'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any

  const memberWhere = {
    OR: [
      { owner_id: Number(user.id) },
      { members: { some: { user_id: Number(user.id) } } },
    ],
  }

  const projects = await prisma.project.findMany({
    where: user.role === 'manager' ? {} : memberWhere,
    include: {
      unit: true,
      owner: { select: { id: true, name: true } },
      updates: { orderBy: { created_at: 'desc' }, take: 1 },
      _count: { select: { issues: { where: { resolved: false } } } },
    },
    orderBy: { created_at: 'desc' },
  })

  return (
    <AppLayout>
      <DashboardClient projects={JSON.parse(JSON.stringify(projects))} session={JSON.parse(JSON.stringify(session))} />
    </AppLayout>
  )
}
