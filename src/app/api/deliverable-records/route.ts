import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const records = await prisma.deliverableRecord.findMany({ orderBy: { title: 'asc' } })
  return NextResponse.json(records)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { title, description } = await req.json()
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  try {
    const record = await prisma.deliverableRecord.create({
      data: { title: title.trim(), description: description?.trim() || null },
    })
    return NextResponse.json(record)
  } catch {
    return NextResponse.json({ error: 'Title already exists' }, { status: 400 })
  }
}
