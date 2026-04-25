import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'

const ALLOWED_TYPES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'video/quicktime': ['mov'],
  'application/pdf': ['pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
}

const MAX_SIZE_MB = 50
const MAX_FILES = 10
const ALLOWED_CONTEXTS = new Set(['issues'])

// UPLOAD_PUBLIC_URL — URL prefix stored in the DB for generated file URLs (e.g. /uploads).
// UPLOAD_DIR      — Filesystem path where files are physically stored.
//   Dev default  : <cwd>/public/UPLOAD_PUBLIC_URL  (served by Next.js static assets)
//   Production   : set UPLOAD_DIR=/mnt/<shareddir>  and serve /uploads via nginx/proxy
const UPLOAD_PUBLIC_URL = process.env.UPLOAD_PUBLIC_URL ?? '/uploads'

function resolveUploadBase(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR
  return path.join(process.cwd(), 'public', UPLOAD_PUBLIC_URL)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = session.user as any

  const formData = await req.formData()
  const taskId = formData.get('task_id')
  const context = formData.get('context') as string | null
  const files = formData.getAll('files') as File[]

  if ((!taskId && !context) || files.length === 0) {
    return NextResponse.json({ error: 'Missing task_id or files' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 })
  }

  let folder: string
  if (taskId) {
    const numericTaskId = Number(taskId)
    if (!Number.isInteger(numericTaskId) || numericTaskId <= 0) {
      return NextResponse.json({ error: 'Invalid task_id' }, { status: 400 })
    }
    const task = await prisma.task.findUnique({
      where: { id: numericTaskId },
      select: { assignees: { select: { user_id: true } } },
    })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    const isAssigned = task.assignees.some(a => a.user_id === Number(user.id))
    if (user.role !== 'manager' && !isAssigned) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    folder = `tasks/${numericTaskId}`
  } else {
    if (!context || !ALLOWED_CONTEXTS.has(context)) {
      return NextResponse.json({ error: 'Invalid upload context' }, { status: 400 })
    }
    folder = context
  }

  const uploadDir = path.join(resolveUploadBase(), folder)
  await mkdir(uploadDir, { recursive: true })

  const urls: string[] = []

  for (const file of files) {
    const allowedExtensions = ALLOWED_TYPES[file.type]
    if (!allowedExtensions) {
      return NextResponse.json({ error: `File type ${file.type} not allowed` }, { status: 400 })
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File too large (max ${MAX_SIZE_MB}MB)` }, { status: 400 })
    }

    const ext = path.extname(file.name).replace('.', '').toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json({ error: `File extension .${ext || 'unknown'} does not match allowed type` }, { status: 400 })
    }
    const filename = `${Date.now()}-${randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, filename), buffer)

    urls.push(`${UPLOAD_PUBLIC_URL}/${folder}/${filename}`)
  }

  return NextResponse.json({ urls })
}
