import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH — toggle attended status for the current user
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { user_id, attended } = await req.json()

  const attendee = await prisma.meetingAttendee.update({
    where: { meeting_id_user_id: { meeting_id: Number(id), user_id: Number(user_id) } },
    data: { attended },
  })
  return NextResponse.json(attendee)
}
