import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const tasks = await prisma.task.findMany({
    where: { assigned_to: Number(user.id) },
    include: {
      feature: {
        select: {
          id: true,
          title: true,
          project_links: {
            select: { project: { select: { id: true, title: true } }, module: { select: { id: true, title: true } } },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { order: 'asc' }],
  })

  return NextResponse.json(tasks)
}
