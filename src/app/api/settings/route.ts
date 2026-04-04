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
  } catch {}

  // Merge env-based email defaults (never expose SMTP_PASS or DB password)
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
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any).role !== 'manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['brand_name', 'brand_logo_url', 'login_bg_url', 'theme_color', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_from', 'smtp_pass', 'db_host', 'db_port', 'db_name', 'db_user', 'db_pass']

  await Promise.all(
    Object.entries(body)
      .filter(([k]) => allowed.includes(k))
      .map(([k, v]) =>
        prisma.appSetting.upsert({
          where: { key: k },
          create: { key: k, value: String(v) },
          update: { value: String(v) },
        })
      )
  )

  return NextResponse.json({ ok: true })
}
