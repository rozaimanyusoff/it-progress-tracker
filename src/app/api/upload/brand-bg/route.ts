import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE_MB = 5
const UPLOAD_PUBLIC_URL = process.env.UPLOAD_PUBLIC_URL ?? '/uploads'

function resolveUploadBase(): string {
   if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR
   return path.join(process.cwd(), 'public', UPLOAD_PUBLIC_URL)
}

export async function POST(req: NextRequest) {
   const session = await getServerSession(authOptions)
   if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
   if ((session.user as any).role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

   const formData = await req.formData()
   const file = formData.get('file') as File | null
   if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
   if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Only JPEG, PNG, GIF, or WebP allowed' }, { status: 400 })
   if (file.size > MAX_SIZE_MB * 1024 * 1024) return NextResponse.json({ error: `Max size is ${MAX_SIZE_MB}MB` }, { status: 400 })

   const ext = file.name.split('.').pop()
   const filename = `login-bg-${Date.now()}.${ext}`
   const uploadDir = path.join(resolveUploadBase(), 'brand')
   await mkdir(uploadDir, { recursive: true })
   await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()))

   return NextResponse.json({ url: `${UPLOAD_PUBLIC_URL}/brand/${filename}` })
}
