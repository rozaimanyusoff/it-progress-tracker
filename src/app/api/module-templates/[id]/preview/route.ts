import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const template = await prisma.moduleTemplate.findUnique({
    where: { id: Number(id) },
    include: {
      deliverables: {
        orderBy: { sort_order: 'asc' },
        include: {
          tasks: { orderBy: { sort_order: 'asc' } },
        },
      },
    },
  })

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  return NextResponse.json(template)
}
