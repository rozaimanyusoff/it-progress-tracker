import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/org?type=unit|dept|company
export async function GET(req: NextRequest) {
   const session = await getServerSession(authOptions)
   if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

   const type = req.nextUrl.searchParams.get('type')

   if (type === 'unit') {
      const data = await prisma.orgUnit.findMany({ orderBy: { name: 'asc' } })
      return NextResponse.json(data)
   }
   if (type === 'dept') {
      const data = await prisma.department.findMany({ orderBy: { name: 'asc' } })
      return NextResponse.json(data)
   }
   if (type === 'company') {
      const data = await prisma.company.findMany({ orderBy: { name: 'asc' } })
      return NextResponse.json(data)
   }

   // Return all
   const [units, depts, companies] = await Promise.all([
      prisma.orgUnit.findMany({ orderBy: { name: 'asc' } }),
      prisma.department.findMany({ orderBy: { name: 'asc' } }),
      prisma.company.findMany({ orderBy: { name: 'asc' } }),
   ])
   return NextResponse.json({ units, depts, companies })
}

// POST /api/org  { type, name }
export async function POST(req: NextRequest) {
   const session = await getServerSession(authOptions)
   if (!session || (session.user as any).role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
   }

   const { type, name } = await req.json()
   if (!type || !name?.trim()) return NextResponse.json({ error: 'type and name are required' }, { status: 400 })

   try {
      if (type === 'unit') {
         const item = await prisma.orgUnit.create({ data: { name: name.trim() } })
         return NextResponse.json(item, { status: 201 })
      }
      if (type === 'dept') {
         const item = await prisma.department.create({ data: { name: name.trim() } })
         return NextResponse.json(item, { status: 201 })
      }
      if (type === 'company') {
         const item = await prisma.company.create({ data: { name: name.trim() } })
         return NextResponse.json(item, { status: 201 })
      }
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
   } catch (e: any) {
      if (e.code === 'P2002') return NextResponse.json({ error: 'Name already exists' }, { status: 409 })
      throw e
   }
}
