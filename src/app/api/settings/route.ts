import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await prisma.appSetting.findMany()
  const settings: Record<string, string> = {}
  for (const r of rows) settings[r.key] = r.value

  // Parse DATABASE_URL as fallback for db fields
  let dbHost = '', dbPort = '5432', dbName = '', dbUser = ''
  try {
    const url = new URL(process.env.DATABASE_URL ?? '')
    dbHost = settings.db_host ?? url.hostname
    dbPort = settings.db_port ?? url.port ?? '5432'
    dbName = settings.db_name ?? url.pathname.replace('/', '')
    dbUser = settings.db_user ?? url.username
  } catch { }

  // Merge env-based email defaults (never expose SMTP_PASS or DB password)
  let rolePreferences: Record<string, { create: boolean; update: boolean; view: boolean; delete: boolean; receive_notifications: boolean; assignable: boolean }> = {
    manager: { create: true, update: true, view: true, delete: true, receive_notifications: true, assignable: true },
    member: { create: true, update: true, view: true, delete: false, receive_notifications: true, assignable: true },
  }
  try {
    if (settings.role_preferences) {
      const parsed = JSON.parse(settings.role_preferences)
      if (parsed && typeof parsed === 'object') {
        rolePreferences = parsed
      }
    }
  } catch { }

  return NextResponse.json({
    brand_name: settings.brand_name ?? 'IT Tracker',
    brand_logo_url: settings.brand_logo_url ?? '',
    login_bg_url: settings.login_bg_url ?? '',
    theme_color: settings.theme_color ?? 'blue',
    smtp_host: settings.smtp_host ?? process.env.SMTP_HOST ?? '',
    smtp_port: settings.smtp_port ?? process.env.SMTP_PORT ?? '587',
    smtp_user: settings.smtp_user ?? process.env.SMTP_USER ?? '',
    smtp_from: settings.smtp_from ?? process.env.SMTP_FROM ?? '',
    db_host: dbHost,
    db_port: dbPort,
    db_name: dbName,
    db_user: dbUser,
    role_preferences: rolePreferences,
    cron_backup_enabled: settings.cron_backup_enabled === 'true',
    cron_pending_notify_enabled: settings.cron_pending_notify_enabled === 'true',
    cron_backup_day: settings.cron_backup_day ?? '*',
    cron_backup_time: settings.cron_backup_time ?? '02:00',
    cron_pending_notify_day: settings.cron_pending_notify_day ?? '1',
    cron_pending_notify_time: settings.cron_pending_notify_time ?? '09:00',
    cron_timezone: settings.cron_timezone ?? 'Asia/Kuala_Lumpur',
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = [
    'brand_name', 'brand_logo_url', 'login_bg_url', 'theme_color',
    'smtp_host', 'smtp_port', 'smtp_user', 'smtp_from', 'smtp_pass',
    'db_host', 'db_port', 'db_name', 'db_user', 'db_pass',
    'role_preferences',
    'cron_backup_enabled', 'cron_pending_notify_enabled',
    'cron_backup_day', 'cron_backup_time',
    'cron_pending_notify_day', 'cron_pending_notify_time',
    'cron_timezone',
    'cron_backup_last_run_slot', 'cron_pending_last_run_slot',
  ]

  await Promise.all(
    Object.entries(body)
      .filter(([k]) => allowed.includes(k))
      .map(([k, v]) =>
        prisma.appSetting.upsert({
          where: { key: k },
          create: { key: k, value: k === 'role_preferences' ? JSON.stringify(v) : String(v) },
          update: { value: k === 'role_preferences' ? JSON.stringify(v) : String(v) },
        })
      )
  )

  return NextResponse.json({ ok: true })
}
