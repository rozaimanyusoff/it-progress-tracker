import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'media',
  'image/png': 'media',
  'image/gif': 'media',
  'image/webp': 'media',
  'video/mp4': 'media',
  'video/webm': 'media',
  'video/quicktime': 'media',
  'application/pdf': 'docs',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docs',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'docs',
  'application/msword': 'docs',
  'application/vnd.ms-excel': 'docs',
}

const MAX_SIZE_MB = 50

// UPLOAD_PUBLIC_URL — URL prefix for stored URLs and deriving the filesystem path.
//   Files are stored under public/<UPLOAD_PUBLIC_URL> so Next.js serves them statically.
const UPLOAD_PUBLIC_URL = process.env.UPLOAD_PUBLIC_URL ?? '/uploads'

function resolveUploadBase(): string {
  return path.join(process.cwd(), 'public', UPLOAD_PUBLIC_URL)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const taskId = formData.get('task_id')
  const context = formData.get('context') as string | null
  const files = formData.getAll('files') as File[]

  if ((!taskId && !context) || files.length === 0) {
    return NextResponse.json({ error: 'Missing task_id or files' }, { status: 400 })
  }

  const folder = context ?? `tasks/${String(taskId)}`
  const uploadDir = path.join(resolveUploadBase(), folder)
  await mkdir(uploadDir, { recursive: true })

  const urls: string[] = []

  for (const file of files) {
    const fileCategory = ALLOWED_TYPES[file.type]
    if (!fileCategory) {
      return NextResponse.json({ error: `File type ${file.type} not allowed` }, { status: 400 })
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File too large (max ${MAX_SIZE_MB}MB)` }, { status: 400 })
    }

    const ext = file.name.split('.').pop()
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, filename), buffer)

    urls.push(`${UPLOAD_PUBLIC_URL}/${folder}/${filename}`)
  }

  return NextResponse.json({ urls })
}
