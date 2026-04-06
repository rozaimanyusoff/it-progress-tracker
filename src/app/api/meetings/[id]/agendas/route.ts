import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { agenda, issued_by, time, details, action, pic_ids } = await req.json()

  const max = await prisma.meetingAgenda.aggregate({
    where: { meeting_id: Number(id) },
    _max: { sort_no: true },
  })

  const item = await prisma.meetingAgenda.create({
    data: {
      meeting_id: Number(id),
      sort_no: (max._max.sort_no ?? 0) + 1,
      agenda: agenda ?? '',
      issued_by: issued_by || null,
      time: time || null,
      details: details || null,
      action: action || null,
      pics: pic_ids?.length
        ? { create: pic_ids.map((uid: number) => ({ user_id: uid })) }
        : undefined,
    },
    include: {
      pics: { include: { user: { select: { id: true, name: true } } } },
      followups: { include: { creator: { select: { id: true, name: true } } } },
    },
  })
  return NextResponse.json(item, { status: 201 })
}
