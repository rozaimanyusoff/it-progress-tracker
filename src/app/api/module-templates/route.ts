import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.moduleTemplate.findMany({
    where: { is_active: true },
    orderBy: { sort_order: 'asc' },
    include: {
      deliverables: {
        orderBy: { sort_order: 'asc' },
        include: {
          tasks: { orderBy: { sort_order: 'asc' } },
        },
      },
    },
  })

  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { display_name, description, icon, deliverables } = await req.json()
  if (!display_name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const code = display_name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now()

  const maxOrder = await prisma.moduleTemplate.aggregate({ _max: { sort_order: true } })
  const nextOrder = (maxOrder._max.sort_order ?? 0) + 1

  const template = await prisma.moduleTemplate.create({
    data: {
      code,
      display_name: display_name.trim(),
      description: description?.trim() || null,
      icon: icon?.trim() || null,
      sort_order: nextOrder,
      deliverables: {
        create: (deliverables ?? []).map((d: any, di: number) => ({
          name: d.name,
          type: d.type,
          sort_order: di + 1,
          tasks: {
            create: (d.tasks ?? []).map((t: any, ti: number) => ({
              name: t.name,
              est_mandays: t.est_mandays ? Number(t.est_mandays) : null,
              sort_order: ti + 1,
            })),
          },
        })),
      },
    },
    include: {
      deliverables: { orderBy: { sort_order: 'asc' }, include: { tasks: { orderBy: { sort_order: 'asc' } } } },
    },
  })

  return NextResponse.json(template)
}
