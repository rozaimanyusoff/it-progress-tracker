import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST — add a task to an existing template deliverable
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { template_deliverable_id, name, est_mandays } = await req.json()
  if (!template_deliverable_id || !name?.trim()) {
    return NextResponse.json({ error: 'deliverable_id and name required' }, { status: 400 })
  }

  const maxOrder = await prisma.templateTask.aggregate({
    where: { template_deliverable_id: Number(template_deliverable_id) },
    _max: { sort_order: true },
  })
  const nextOrder = (maxOrder._max.sort_order ?? 0) + 1

  const task = await prisma.templateTask.create({
    data: {
      template_deliverable_id: Number(template_deliverable_id),
      name: name.trim(),
      est_mandays: est_mandays != null && est_mandays !== '' ? Number(est_mandays) : null,
      sort_order: nextOrder,
    },
  })

  return NextResponse.json(task, { status: 201 })
}
