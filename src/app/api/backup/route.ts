import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, readdir, stat } from 'fs/promises'
import path from 'path'

const UPLOAD_PUBLIC_URL = process.env.UPLOAD_PUBLIC_URL ?? '/uploads'
const BACKUP_DIR = path.join(process.cwd(), 'public', UPLOAD_PUBLIC_URL, 'backup')

async function requireManager(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return null
  if ((session.user as any).role !== 'manager') return null
  return session
}

// GET — list existing backups
export async function GET(req: NextRequest) {
  const session = await requireManager(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await mkdir(BACKUP_DIR, { recursive: true })
    const files = await readdir(BACKUP_DIR)
    const backups = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async f => {
          const s = await stat(path.join(BACKUP_DIR, f))
          return { filename: f, size: s.size, created_at: s.birthtime.toISOString(), url: `${UPLOAD_PUBLIC_URL}/backup/${f}` }
        })
    )
    backups.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return NextResponse.json(backups)
  } catch {
    return NextResponse.json([])
  }
}

// POST — create a new backup
export async function POST(req: NextRequest) {
  const session = await requireManager(req)
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [users, projects, modules, projectAssignees, projectUpdates, issues, features,
    featureDevelopers, tasks, taskUpdates, auditLogs, appSettings] = await Promise.all([
    prisma.user.findMany(),
    prisma.project.findMany(),
    prisma.module.findMany(),
    prisma.projectAssignee.findMany(),
    prisma.projectUpdate.findMany(),
    prisma.issue.findMany(),
    prisma.feature.findMany(),
    prisma.featureDeveloper.findMany(),
    prisma.task.findMany(),
    prisma.taskUpdate.findMany(),
    prisma.auditLog.findMany(),
    prisma.appSetting.findMany(),
  ])

  const backup = {
    version: 1,
    created_at: new Date().toISOString(),
    created_by: (session.user as any).email,
    data: { users, projects, modules, projectAssignees, projectUpdates, issues, features, featureDevelopers, tasks, taskUpdates, auditLogs, appSettings },
  }

  await mkdir(BACKUP_DIR, { recursive: true })
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`
  await writeFile(path.join(BACKUP_DIR, filename), JSON.stringify(backup, null, 2))

  await prisma.auditLog.create({
    data: {
      user_id: Number((session.user as any).id),
      action: 'BACKUP',
      target_type: 'System',
      target_id: 0,
      metadata: { filename },
    },
  })

  return NextResponse.json({ filename, url: `${UPLOAD_PUBLIC_URL}/backup/${filename}` })
}
