import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: Number(id) },
    select: { title: true },
  })
  if (!deliverable) return NextResponse.json([])

  const templateDeliverables = await prisma.templateDeliverable.findMany({
    where: { name: { contains: deliverable.title, mode: 'insensitive' } },
    include: {
      tasks: { orderBy: { sort_order: 'asc' }, select: { name: true, est_mandays: true } },
    },
    orderBy: { sort_order: 'asc' },
  })

  // Flatten and deduplicate by task name
  const seen = new Set<string>()
  const tasks = templateDeliverables
    .flatMap(td => td.tasks)
    .filter(t => {
      if (seen.has(t.name)) return false
      seen.add(t.name)
      return true
    })
    .map(t => ({ name: t.name, est_mandays: t.est_mandays != null ? Number(t.est_mandays) : null }))

  return NextResponse.json(tasks)
}
