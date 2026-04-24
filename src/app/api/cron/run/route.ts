import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { sendWeeklyPendingTasksReminder } from '@/lib/email'

const UPLOAD_PUBLIC_URL = process.env.UPLOAD_PUBLIC_URL ?? '/uploads'
const UPLOAD_BASE = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'public', UPLOAD_PUBLIC_URL)
const BACKUP_DIR = path.join(UPLOAD_BASE, 'backup')

function getIsoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function getTimePartsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = fmt.formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekdayMap: Record<string, string> = { Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' }
  return {
    dayOfWeek: weekdayMap[get('weekday')] ?? '0',
    hhmm: `${get('hour')}:${get('minute')}`,
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
  }
}

function matchesDay(scheduleDay: string, dayOfWeek: string): boolean {
  const raw = String(scheduleDay || '').trim()
  if (!raw || raw === '*') return true
  const days = raw.split(',').map(v => v.trim()).filter(Boolean)
  return days.includes(dayOfWeek)
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  if (cronSecret && provided && provided === cronSecret) return true

  const session = await getServerSession(authOptions)
  if (!session) return false
  return (session.user as any).role === 'manager'
}

async function getSettingBool(key: string): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value === 'true'
}

async function getSettingStr(key: string, fallback: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value ?? fallback
}

async function setSetting(key: string, value: string) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

async function runBackupJob(force = false) {
  const enabled = await getSettingBool('cron_backup_enabled')
  if (!enabled) return { ok: true, skipped: true, reason: 'backup cron disabled' }

  const timeZone = await getSettingStr('cron_timezone', 'Asia/Kuala_Lumpur')
  const scheduleDay = await getSettingStr('cron_backup_day', '*')
  const scheduleTime = await getSettingStr('cron_backup_time', '02:00')
  const nowParts = getTimePartsInZone(new Date(), timeZone)
  const scheduleMatched = matchesDay(scheduleDay, nowParts.dayOfWeek) && scheduleTime === nowParts.hhmm
  const slotKey = `backup:${nowParts.dateKey}:${scheduleTime}:${timeZone}`
  const lastRun = await prisma.appSetting.findUnique({ where: { key: 'cron_backup_last_run_slot' } })
  if (!force) {
    if (!scheduleMatched) return { ok: true, skipped: true, reason: `outside schedule (${scheduleDay} ${scheduleTime} ${timeZone})` }
    if (lastRun?.value === slotKey) return { ok: true, skipped: true, reason: 'already executed for this slot' }
  }

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
    created_by: 'cron',
    data: { users, projects, modules, projectAssignees, projectUpdates, issues, features, featureDevelopers, tasks, taskUpdates, auditLogs, appSettings },
  }

  await mkdir(BACKUP_DIR, { recursive: true })
  const filename = `backup-cron-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`
  await writeFile(path.join(BACKUP_DIR, filename), JSON.stringify(backup, null, 2))

  const actor = await prisma.user.findFirst({ where: { role: 'manager' }, select: { id: true } })
  if (actor) {
    await prisma.auditLog.create({
      data: {
        user_id: actor.id,
        action: 'BACKUP_CRON',
        target_type: 'System',
        target_id: 0,
        metadata: { filename },
      },
    })
  }

  if (!force) await setSetting('cron_backup_last_run_slot', slotKey)

  return { ok: true, filename }
}

async function runPendingNotifyJob(force = false) {
  const enabled = await getSettingBool('cron_pending_notify_enabled')
  if (!enabled) return { ok: true, skipped: true, reason: 'pending notify cron disabled' }

  const timeZone = await getSettingStr('cron_timezone', 'Asia/Kuala_Lumpur')
  const scheduleDay = await getSettingStr('cron_pending_notify_day', '1')
  const scheduleTime = await getSettingStr('cron_pending_notify_time', '09:00')
  const nowParts = getTimePartsInZone(new Date(), timeZone)
  const scheduleMatched = matchesDay(scheduleDay, nowParts.dayOfWeek) && scheduleTime === nowParts.hhmm
  const slotKey = `pending:${nowParts.dateKey}:${scheduleTime}:${timeZone}`
  const lastRun = await prisma.appSetting.findUnique({ where: { key: 'cron_pending_last_run_slot' } })
  if (!force) {
    if (!scheduleMatched) return { ok: true, skipped: true, reason: `outside schedule (${scheduleDay} ${scheduleTime} ${timeZone})` }
    if (lastRun?.value === slotKey) return { ok: true, skipped: true, reason: 'already executed for this slot' }
  }

  const tasks = await prisma.task.findMany({
    where: {
      status: { not: 'Done' },
      assignees: { some: {} },
    },
    select: {
      title: true,
      status: true,
      due_date: true,
      assignees: { select: { user: { select: { id: true, name: true, email: true, is_active: true, role: true, display_role: true } } } },
      deliverable: { select: { project: { select: { title: true } } } },
      feature: { select: { project_links: { select: { project: { select: { title: true } } }, take: 1 } } },
    },
  })

  const byUser = new Map<number, { name: string; email: string; role: string; display_role: string | null; tasks: Array<{ title: string; project: string; dueDate: string; status: string }> }>()

  // Load role preferences once for the whole batch
  const { getRolePreferences } = await import('@/lib/role-prefs')
  const rolePrefs = await getRolePreferences()

  for (const t of tasks) {
    const projectTitle = t.deliverable?.project?.title || t.feature?.project_links?.[0]?.project?.title || 'Unlinked'
    const dueDate = t.due_date
      ? new Date(t.due_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—'
    for (const a of t.assignees) {
      const u = a.user
      if (!u.is_active || !u.email) continue
      if (!byUser.has(u.id)) byUser.set(u.id, { name: u.name, email: u.email, role: u.role, display_role: u.display_role, tasks: [] })
      byUser.get(u.id)!.tasks.push({ title: t.title, project: projectTitle, dueDate, status: t.status })
    }
  }

  let sent = 0
  for (const userData of byUser.values()) {
    if (!userData.tasks.length) continue
    const effectiveRole = userData.display_role || userData.role
    const rolePerm = rolePrefs[effectiveRole] ?? rolePrefs[userData.role]
    if (rolePerm && !rolePerm.receive_notifications) continue
    await sendWeeklyPendingTasksReminder(userData.email, userData.name, userData.tasks)
    sent += 1
  }

  if (!force) await setSetting('cron_pending_last_run_slot', slotKey)

  const actor = await prisma.user.findFirst({ where: { role: 'manager' }, select: { id: true } })
  if (actor) {
    await prisma.auditLog.create({
      data: {
        user_id: actor.id,
        action: 'PENDING_NOTIFY_CRON',
        target_type: 'System',
        target_id: 0,
        metadata: { recipients: sent, week: getIsoWeekKey(new Date()) },
      },
    })
  }

  return { ok: true, recipients: sent, week: getIsoWeekKey(new Date()) }
}

export async function POST(req: NextRequest) {
  const authorized = await isAuthorized(req)
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const job = String(body.job ?? '').trim()
  const force = Boolean(body.force)
  if (!job || !['backup', 'pending-notify', 'all'].includes(job)) {
    return NextResponse.json({ error: 'job must be one of: backup, pending-notify, all' }, { status: 400 })
  }

  const result: Record<string, any> = {}
  if (job === 'backup' || job === 'all') result.backup = await runBackupJob(force)
  if (job === 'pending-notify' || job === 'all') result.pendingNotify = await runPendingNotifyJob(force)

  return NextResponse.json({ ok: true, result })
}
