import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
   const { id } = await params
   const session = await getServerSession(authOptions)
   if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

   const history = await prisma.issueHistory.findMany({
      where: { issue_id: Number(id) },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { created_at: 'asc' },
   })

   return NextResponse.json(history)
}
