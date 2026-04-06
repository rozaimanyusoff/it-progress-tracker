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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const meeting = await prisma.meeting.findUnique({ where: { id: Number(id) }, include: meetingInclude })
  if (!meeting) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(meeting)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { title, venue, date, time_from, time_to } = await req.json()

  const meeting = await prisma.meeting.update({
    where: { id: Number(id) },
    data: {
      title: title?.trim(),
      venue: venue?.trim() || null,
      date: date ? new Date(date) : undefined,
      time_from,
      time_to,
    },
    include: meetingInclude,
  })
  return NextResponse.json(meeting)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  await prisma.meeting.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
