import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public endpoint — no auth required (only exposes brand name + logo)
export async function GET() {
   const rows = await prisma.appSetting.findMany({
      where: { key: { in: ['brand_name', 'brand_logo_url'] } },
   })
   const settings: Record<string, string> = {}
   for (const r of rows) settings[r.key] = r.value

   return NextResponse.json({
      brand_name: settings.brand_name ?? 'IT Progress Tracker',
      brand_logo_url: settings.brand_logo_url ?? '',
   })
}
