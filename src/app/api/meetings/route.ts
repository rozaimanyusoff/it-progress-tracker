import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const meetingInclude = {
  creator: { select: { id: true, name: true } },
  attendees: { include: { user: { select: { id: true, name: true, avatar_url: true, initials: true } } } },
  agendas: {
    orderBy: { sort_no: 'asc' as const },
    include: {
      pics: { include: { user: { select: { id: true, name: true } } } },
      followups: { include: { creator: { select: { id: true, name: true } } }, orderBy: { created_at: 'asc' as const } },
    },
  },
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const meetings = await prisma.meeting.findMany({
    where: from && to ? { date: { gte: new Date(from), lte: new Date(to) } } : undefined,
    include: meetingInclude,
    orderBy: [{ date: 'asc' }, { time_from: 'asc' }],
  })

  return NextResponse.json(meetings)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  const { title, venue, date, time_from, time_to, attendee_ids, agendas } = await req.json()

  if (!title?.trim() || !date || !time_from || !time_to) {
    return NextResponse.json({ error: 'title, date, time_from, time_to required' }, { status: 400 })
  }

  const meeting = await prisma.meeting.create({
    data: {
      title: title.trim(),
      venue: venue?.trim() || null,
      date: new Date(date),
      time_from,
      time_to,
      created_by: Number(user.id),
      attendees: {
        create: (attendee_ids ?? []).map((uid: number) => ({ user_id: uid })),
      },
      agendas: {
        create: (agendas ?? []).map((a: any, i: number) => ({
          sort_no: i + 1,
          agenda: a.agenda,
          issued_by: a.issued_by || null,
          time: a.time || null,
          details: a.details || null,
          action: a.action || null,
          pics: a.pic_ids?.length
            ? { create: a.pic_ids.map((uid: number) => ({ user_id: uid })) }
            : undefined,
        })),
      },
    },
    include: meetingInclude,
  })

  return NextResponse.json(meeting, { status: 201 })
}
