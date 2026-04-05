import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DeliverableType } from '@prisma/client'

const TYPE_MAP: Record<string, DeliverableType> = {
  database: DeliverableType.database,
  backend: DeliverableType.backend,
  frontend: DeliverableType.frontend,
  testing: DeliverableType.testing,
  documentation: DeliverableType.documentation,
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { display_name } = body
  if (!display_name?.trim()) {
    return NextResponse.json({ error: 'display_name is required' }, { status: 400 })
  }

  // Load the module with its deliverables and tasks
  const module = await prisma.module.findUnique({
    where: { id: Number(id) },
    include: {
      deliverables: {
        orderBy: { order: 'asc' },
        include: { tasks: { orderBy: { order: 'asc' } } },
      },
    },
  })
  if (!module) return NextResponse.json({ error: 'Module not found' }, { status: 404 })

  const code = `custom_${Date.now()}`

  const template = await prisma.moduleTemplate.create({
    data: {
      code,
      display_name: display_name.trim(),
      description: module.description ?? null,
      icon: '⭐',
      is_active: true,
      deliverables: {
        create: module.deliverables.map((d, dIdx) => ({
          name: d.title,
          type: TYPE_MAP['frontend'], // default; deliverable has no type field
          sort_order: dIdx + 1,
          tasks: {
            create: d.tasks.map((t, tIdx) => ({
              name: t.title,
              est_mandays: t.est_mandays ?? null,
              sort_order: tIdx + 1,
            })),
          },
        })),
      },
    },
    include: {
      deliverables: {
        include: { tasks: true },
      },
    },
  })

  await prisma.auditLog.create({
    data: {
      user_id: Number(user.id),
      action: 'CREATE',
      target_type: 'ModuleTemplate',
      target_id: template.id,
      metadata: { from_module: module.id, display_name: template.display_name },
    },
  })

  return NextResponse.json(template, { status: 201 })
}
