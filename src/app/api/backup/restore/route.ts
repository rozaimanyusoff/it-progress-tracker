import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let backup: any
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    try { backup = JSON.parse(await file.text()) } catch { return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 }) }
  } else {
    // restore from a filename already on disk
    const { filename } = await req.json()
    if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 })
    const { readFile } = await import('fs/promises')
    const path = await import('path')
    const UPLOAD_PUBLIC_URL = process.env.UPLOAD_PUBLIC_URL ?? '/uploads'
    const uploadBase = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'public', UPLOAD_PUBLIC_URL)
    const filePath = path.join(uploadBase, 'backup', filename)
    try { backup = JSON.parse(await readFile(filePath, 'utf-8')) } catch { return NextResponse.json({ error: 'Backup file not found' }, { status: 404 }) }
  }

  if (!backup?.version || !backup?.data) return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 })

  const { data } = backup

  try {
    await prisma.$transaction(async (tx) => {
      // Clear in dependency order (children first)
      await tx.taskUpdate.deleteMany()
      await tx.task.deleteMany()
      await tx.featureDeveloper.deleteMany()
      await tx.feature.deleteMany()
      await tx.projectUpdate.deleteMany()
      await tx.issue.deleteMany()
      await tx.projectAssignee.deleteMany()
      await tx.module.deleteMany()
      await tx.project.deleteMany()
      await tx.auditLog.deleteMany()
      await tx.appSetting.deleteMany()
      // Keep users — restore them but skip password re-hash
      await tx.user.deleteMany()

      if (data.users?.length) await tx.user.createMany({ data: data.users, skipDuplicates: true })
      if (data.projects?.length) await tx.project.createMany({ data: data.projects, skipDuplicates: true })
      if (data.modules?.length) await tx.module.createMany({ data: data.modules, skipDuplicates: true })
      if (data.projectAssignees?.length) await tx.projectAssignee.createMany({ data: data.projectAssignees, skipDuplicates: true })
      if (data.projectUpdates?.length) await tx.projectUpdate.createMany({ data: data.projectUpdates, skipDuplicates: true })
      if (data.issues?.length) await tx.issue.createMany({ data: data.issues, skipDuplicates: true })
      if (data.features?.length) await tx.feature.createMany({ data: data.features, skipDuplicates: true })
      if (data.featureDevelopers?.length) await tx.featureDeveloper.createMany({ data: data.featureDevelopers, skipDuplicates: true })
      if (data.tasks?.length) await tx.task.createMany({ data: data.tasks, skipDuplicates: true })
      if (data.taskUpdates?.length) await tx.taskUpdate.createMany({ data: data.taskUpdates, skipDuplicates: true })
      if (data.auditLogs?.length) await tx.auditLog.createMany({ data: data.auditLogs, skipDuplicates: true })
      if (data.appSettings?.length) await tx.appSetting.createMany({ data: data.appSettings, skipDuplicates: true })
    }, { timeout: 60000 })

    await prisma.auditLog.create({
      data: {
        user_id: Number((session.user as any).id),
        action: 'RESTORE',
        target_type: 'System',
        target_id: 0,
        metadata: { source: backup.created_at },
      },
    })

    return NextResponse.json({ ok: true, restored_at: backup.created_at })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Restore failed' }, { status: 500 })
  }
}
