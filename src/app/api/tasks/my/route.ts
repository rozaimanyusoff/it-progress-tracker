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
      deliverable: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: [{ status: 'asc' }, { order: 'asc' }],
  })

  // Normalize: lift project and module to top level regardless of task origin
  const normalized = tasks.map(t => {
    const link = t.feature?.project_links?.[0]
    return {
      ...t,
      project: link?.project ?? t.deliverable?.project ?? null,
      module: link?.module ?? null,
    }
  })

  return NextResponse.json(normalized)
}
