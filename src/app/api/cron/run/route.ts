import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { sendWeeklyProgressUpdate, WeeklyProgressData, WeeklyProjectData, WeeklyDevAnalytic } from '@/lib/email'

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

async function runWeeklyProgressJob(force = false) {
  const enabled = await getSettingBool('cron_pending_notify_enabled')
  // force=true (manual "Run Now") bypasses enabled toggle and schedule checks
  if (!force && !enabled) return { ok: true, skipped: true, reason: 'weekly progress cron disabled' }

  const timeZone = await getSettingStr('cron_timezone', 'Asia/Kuala_Lumpur')
  const scheduleDay = await getSettingStr('cron_pending_notify_day', '1')
  const scheduleTime = await getSettingStr('cron_pending_notify_time', '09:00')
  const nowParts = getTimePartsInZone(new Date(), timeZone)
  const scheduleMatched = matchesDay(scheduleDay, nowParts.dayOfWeek) && scheduleTime === nowParts.hhmm
  const slotKey = `weekly:${nowParts.dateKey}:${scheduleTime}:${timeZone}`
  const lastRun = await prisma.appSetting.findUnique({ where: { key: 'cron_pending_last_run_slot' } })
  if (!force) {
    if (!scheduleMatched) return { ok: true, skipped: true, reason: `outside schedule (${scheduleDay} ${scheduleTime} ${timeZone})` }
    if (lastRun?.value === slotKey) return { ok: true, skipped: true, reason: 'already executed for this slot' }
  }

  // Read brand name
  const brandNameRow = await prisma.appSetting.findUnique({ where: { key: 'brand_name' } })
  const brandName = brandNameRow?.value || 'IT Tracker'

  // Week window: last 7 days
  const now = new Date()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekLabel = `${weekStart.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })} – ${now.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}`

  // Load role preferences
  const { getRolePreferences } = await import('@/lib/role-prefs')
  const rolePrefs = await getRolePreferences()

  // Fetch all active projects with their deliverables and tasks
  const projects = await prisma.project.findMany({
    where: { status: { not: 'Done' } },
    select: {
      id: true,
      title: true,
      deliverables: {
        select: {
          id: true,
          title: true,
          status: true,
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              created_at: true,
              actual_end: true,
              est_mandays: true,
              actual_mandays: true,
              assignees: { select: { user: { select: { id: true, name: true } } } },
            },
          },
        },
      },
      updates: {
        where: { created_at: { gte: weekStart } },
        select: { notes: true, created_at: true, user: { select: { name: true } } },
        orderBy: { created_at: 'desc' },
      },
    },
  })

  // Build project data
  const projectDataMap = new Map<number, WeeklyProjectData>()
  for (const p of projects) {
    const newTasks: WeeklyProjectData['newTasks'] = []
    const completedTasks: WeeklyProjectData['completedTasks'] = []
    const deliverables: WeeklyProjectData['deliverables'] = []

    for (const d of p.deliverables) {
      const totalTasks = d.tasks.length
      const doneTasks = d.tasks.filter(t => t.status === 'Done').length
      const WEIGHT: Record<string, number> = { Todo: 0, InProgress: 50, InReview: 80, Done: 100, Blocked: 0 }
      const progress = totalTasks > 0
        ? Math.round(d.tasks.reduce((s, t) => s + (WEIGHT[t.status] ?? 0), 0) / totalTasks)
        : 0
      deliverables.push({ title: d.title, status: d.status, progress, totalTasks, doneTasks })

      for (const t of d.tasks) {
        const assignees = t.assignees.map(a => a.user.name).join(', ')
        if (t.created_at >= weekStart) {
          newTasks.push({ title: t.title, deliverable: d.title, assignees })
        }
        if (t.status === 'Done' && t.actual_end && new Date(t.actual_end) >= weekStart) {
          completedTasks.push({
            title: t.title,
            assignees,
            completedDate: new Date(t.actual_end).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }),
          })
        }
      }
    }

    const projectUpdates = p.updates.map(u => ({
      content: u.notes || '(no notes)',
      author: u.user?.name ?? '—',
      date: u.created_at.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }),
    }))

    projectDataMap.set(p.id, { projectTitle: p.title, newTasks, completedTasks, deliverables, projectUpdates })
  }

  // Developer analytics: all active users with assigned tasks
  const allUsers = await prisma.user.findMany({
    where: { is_active: true },
    select: {
      id: true, name: true, email: true, role: true, display_role: true,
      task_assignees: {
        select: {
          task: {
            select: {
              id: true, status: true, est_mandays: true, actual_mandays: true,
              actual_end: true,
            },
          },
        },
      },
    },
  })

  const developerAnalytics: WeeklyDevAnalytic[] = allUsers
    .filter(u => u.email)
    .map(u => {
      const tasks = u.task_assignees.map(a => a.task)
      const totalAssigned = tasks.length
      const completedThisWeek = tasks.filter(t =>
        t.status === 'Done' && t.actual_end && new Date(t.actual_end) >= weekStart
      ).length
      const inProgress = tasks.filter(t => t.status === 'InProgress' || t.status === 'InReview').length
      const estMandays = tasks.reduce((s, t) => s + Number(t.est_mandays ?? 0), 0)
      const actualMandays = tasks.reduce((s, t) => s + Number(t.actual_mandays ?? 0), 0)
      const utilizationPct = estMandays > 0 ? Math.round((actualMandays / estMandays) * 100) : 0
      return {
        name: u.name,
        role: u.display_role || u.role,
        totalAssigned,
        completedThisWeek,
        inProgress,
        estMandays,
        actualMandays,
        utilizationPct,
      }
    })
    .filter(d => d.totalAssigned > 0)
    .sort((a, b) => b.totalAssigned - a.totalAssigned)

  const weeklyData: WeeklyProgressData = {
    weekLabel,
    projects: Array.from(projectDataMap.values()),
    developerAnalytics,
  }

  // Determine recipients: all active users whose role has receive_notifications
  const recipients = allUsers.filter(u => {
    if (!u.email) return false
    const effectiveRole = u.display_role || u.role
    const perm = rolePrefs[effectiveRole] ?? rolePrefs[u.role]
    return perm?.receive_notifications !== false
  })

  let sent = 0
  for (const u of recipients) {
    try {
      await sendWeeklyProgressUpdate(u.email!, u.name, weeklyData, brandName)
      sent++
    } catch {
      // continue on individual failure
    }
  }

  if (!force) await setSetting('cron_pending_last_run_slot', slotKey)

  const actor = await prisma.user.findFirst({ where: { role: 'manager' }, select: { id: true } })
  if (actor) {
    await prisma.auditLog.create({
      data: {
        user_id: actor.id,
        action: 'WEEKLY_PROGRESS_CRON',
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
  if (job === 'pending-notify' || job === 'all') result.pendingNotify = await runWeeklyProgressJob(force)

  return NextResponse.json({ ok: true, result })
}
