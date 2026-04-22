import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await params // keep route signature stable (`/api/deliverables/[id]/preset-tasks`)

  // New behavior: old deliverable presets become task-category presets.
  // Include sample tasks for popover guidance in Add Task form.
  const templateDeliverables = await prisma.templateDeliverable.findMany({
    select: {
      name: true,
      type: true,
      sort_order: true,
      tasks: {
        select: { name: true, est_mandays: true, sort_order: true },
        orderBy: { sort_order: 'asc' },
      },
    },
    orderBy: [{ name: 'asc' }, { sort_order: 'asc' }],
  })

  const byName = new Map<string, {
    name: string
    type: string
    samples: { name: string; est_mandays: number | null }[]
  }>()

  for (const d of templateDeliverables) {
    const key = d.name.trim()
    if (!key) continue

    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, {
        name: key,
        type: d.type,
        samples: d.tasks.slice(0, 8).map(t => ({
          name: t.name,
          est_mandays: t.est_mandays != null ? Number(t.est_mandays) : null,
        })),
      })
      continue
    }

    // Merge unique sample tasks across templates with same category name.
    const seen = new Set(existing.samples.map(s => s.name.toLowerCase()))
    for (const t of d.tasks) {
      if (existing.samples.length >= 8) break
      const taskName = t.name.trim()
      if (!taskName) continue
      const taskKey = taskName.toLowerCase()
      if (seen.has(taskKey)) continue
      existing.samples.push({
        name: taskName,
        est_mandays: t.est_mandays != null ? Number(t.est_mandays) : null,
      })
      seen.add(taskKey)
    }
  }

  return NextResponse.json(
    Array.from(byName.values()).map(p => ({
      name: p.name,
      type: p.type,
      est_mandays: null,
      samples: p.samples,
    }))
  )
}
