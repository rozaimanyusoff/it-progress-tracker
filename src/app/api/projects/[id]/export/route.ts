import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateProjectPPTX } from '@/lib/pptx'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
   const { id } = await params
   const session = await getServerSession(authOptions)
   if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

   const projectId = Number(id)

   const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
         assignees: { include: { user: { select: { name: true } } } },
         updates: { orderBy: { created_at: 'desc' }, take: 1 },
      },
   })

   if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

   const [modules, deliverables] = await Promise.all([
      prisma.module.findMany({
         where: { project_id: projectId },
         orderBy: { order: 'asc' },
      }),
      prisma.deliverable.findMany({
         where: { project_id: projectId },
         include: { tasks: { select: { status: true, actual_end: true } } },
         orderBy: { order: 'asc' },
      }),
   ])

   const buffer = await generateProjectPPTX({ project, modules, deliverables })

   const filename = encodeURIComponent(`${project.title}_report.pptx`)
   return new NextResponse(buffer, {
      headers: {
         'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      },
   })
}
