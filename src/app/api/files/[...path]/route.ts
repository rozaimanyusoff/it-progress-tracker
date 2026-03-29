import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readFile } from 'fs/promises'
import path from 'path'

const UPLOAD_PUBLIC_URL = process.env.UPLOAD_PUBLIC_URL ?? '/uploads'

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif',  webp: 'image/webp',
  mp4: 'video/mp4',  webm: 'video/webm', mov: 'video/quicktime',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
}

function resolveUploadBase(): string {
  return path.join(process.cwd(), 'public', UPLOAD_PUBLIC_URL)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path: segments } = await params

  // Prevent path traversal
  const safePath = segments.map((s) => s.replace(/\.\./g, '')).join('/')
  const uploadBase = resolveUploadBase()
  const filePath = path.join(uploadBase, safePath)

  // Ensure resolved path stays within the upload base
  if (!filePath.startsWith(uploadBase + path.sep) && filePath !== uploadBase) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const buffer = await readFile(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const mimeType = MIME_MAP[ext] ?? 'application/octet-stream'
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
