import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; agendaId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { agendaId } = await params
  const { agenda, issued_by, time, details, action, pic_ids } = await req.json()

  // Replace PICs
  await prisma.meetingAgendaPIC.deleteMany({ where: { agenda_id: Number(agendaId) } })

  const item = await prisma.meetingAgenda.update({
    where: { id: Number(agendaId) },
    data: {
      agenda: agenda ?? undefined,
      issued_by: issued_by !== undefined ? (issued_by || null) : undefined,
      time: time !== undefined ? (time || null) : undefined,
      details: details !== undefined ? (details || null) : undefined,
      action: action !== undefined ? (action || null) : undefined,
      pics: pic_ids
        ? { create: pic_ids.map((uid: number) => ({ user_id: uid })) }
        : undefined,
    },
    include: {
      pics: { include: { user: { select: { id: true, name: true } } } },
      followups: { include: { creator: { select: { id: true, name: true } } }, orderBy: { created_at: 'asc' } },
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; agendaId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { agendaId } = await params
  await prisma.meetingAgenda.delete({ where: { id: Number(agendaId) } })
  return NextResponse.json({ ok: true })
}
