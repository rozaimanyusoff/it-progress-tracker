import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { prisma } from '@/lib/prisma'
import path from 'path'

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE_MB = 2
const UPLOAD_PUBLIC_URL = process.env.UPLOAD_PUBLIC_URL ?? '/uploads'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Only JPEG, PNG, GIF, or WebP allowed' }, { status: 400 })
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return NextResponse.json({ error: `Max size is ${MAX_SIZE_MB}MB` }, { status: 400 })

  const userId = Number((session.user as any).id)
  const ext = file.name.split('.').pop()
  const filename = `avatar-${userId}-${Date.now()}.${ext}`
  const uploadDir = path.join(process.cwd(), 'public', UPLOAD_PUBLIC_URL, 'avatars')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()))

  const url = `${UPLOAD_PUBLIC_URL}/avatars/${filename}`
  await prisma.user.update({ where: { id: userId }, data: { avatar_url: url } })

  return NextResponse.json({ url })
}
