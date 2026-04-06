import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; agendaId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agendaId } = await params
  const { note } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: 'note required' }, { status: 400 })

  const followup = await prisma.meetingFollowup.create({
    data: {
      agenda_id: Number(agendaId),
      note: note.trim(),
      created_by: Number((session.user as any).id),
    },
    include: { creator: { select: { id: true, name: true } } },
  })
  return NextResponse.json(followup, { status: 201 })
}
