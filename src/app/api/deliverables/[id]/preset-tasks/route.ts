import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params // keep route signature stable (`/api/deliverables/[id]/preset-tasks`)

  // Return catalog in chain-select friendly shape:
  // Category (module template) -> Scope (template deliverable) -> Task (template task).
  const templates = await prisma.moduleTemplate.findMany({
    select: {
      display_name: true,
      sort_order: true,
      deliverables: {
        select: {
          name: true,
          type: true,
          sort_order: true,
          tasks: {
            select: { name: true, est_mandays: true, sort_order: true },
            orderBy: { sort_order: 'asc' },
          },
        },
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      },
    },
    where: { is_active: true },
    orderBy: [{ sort_order: 'asc' }, { display_name: 'asc' }],
  })

  const payload = templates
    .map(tpl => ({
      category: tpl.display_name,
      scopes: tpl.deliverables
        .map(d => ({
          scope: d.name,
          type: d.type,
          tasks: d.tasks.map(task => ({
            name: task.name,
            est_mandays: task.est_mandays != null ? Number(task.est_mandays) : null,
          })),
        }))
        .filter(scope => scope.scope.trim().length > 0 && scope.tasks.length > 0),
    }))
    .filter(cat => cat.category.trim().length > 0 && cat.scopes.length > 0)

  return NextResponse.json(payload)
}
