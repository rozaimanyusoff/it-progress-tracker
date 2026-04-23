import { PrismaClient, TaskStatus, FeatureStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import 'dotenv/config'

type CandidateTask = {
  id: number
  title: string
  status: TaskStatus
  actual_end: Date | null
  completed_at: Date | null
  deliverable_id: number | null
}

function asIsoDay(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : 'null'
}

async function recalculateDeliverable(prisma: PrismaClient, deliverableId: number) {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: { id: true, project_id: true, is_actual_override: true },
  })
  if (!deliverable) return null

  const tasks = await prisma.task.findMany({
    where: { deliverable_id: deliverableId },
    select: { status: true, actual_start: true, actual_end: true },
  })
  if (tasks.length === 0) return deliverable.project_id

  const allDone = tasks.every((t) => t.status === TaskStatus.Done)
  const anyActive = tasks.some((t) => t.status === TaskStatus.InProgress || t.status === TaskStatus.InReview)
  const status: FeatureStatus = allDone ? FeatureStatus.Done : anyActive ? FeatureStatus.InProgress : FeatureStatus.Pending

  const data: {
    status: FeatureStatus
    actual_start?: Date | null
    actual_end?: Date | null
  } = { status }

  if (!deliverable.is_actual_override) {
    const starts = tasks.map((t) => t.actual_start).filter(Boolean) as Date[]
    data.actual_start = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null

    const ends = tasks.map((t) => t.actual_end).filter(Boolean) as Date[]
    data.actual_end = allDone && ends.length === tasks.length
      ? new Date(Math.max(...ends.map((d) => d.getTime())))
      : null
  }

  await prisma.deliverable.update({ where: { id: deliverableId }, data })
  return deliverable.project_id
}

async function recalculateProject(prisma: PrismaClient, projectId: number) {
  const deliverables = await prisma.deliverable.findMany({
    where: { project_id: projectId },
    select: { status: true, actual_start: true, actual_end: true },
  })
  if (deliverables.length === 0) return

  const starts = deliverables.map((d) => d.actual_start).filter(Boolean) as Date[]
  const actualStart = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null

  const allDone = deliverables.every((d) => d.status === 'Done')
  const ends = deliverables.map((d) => d.actual_end).filter(Boolean) as Date[]
  const actualEnd = allDone && ends.length === deliverables.length
    ? new Date(Math.max(...ends.map((d) => d.getTime())))
    : null

  await prisma.project.update({
    where: { id: projectId },
    data: { actual_start: actualStart, actual_end: actualEnd },
  })
}

async function main() {
  const isApply = process.argv.includes('--apply')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const doneTasks = await prisma.task.findMany({
      where: { status: TaskStatus.Done },
      select: {
        id: true,
        title: true,
        status: true,
        actual_end: true,
        completed_at: true,
        deliverable_id: true,
      },
      orderBy: { id: 'asc' },
    })

    const candidates: Array<{
      task: CandidateTask
      targetCompletedAt: Date
    }> = []

    for (const task of doneTasks) {
      const latestInReview = await prisma.taskHistory.findFirst({
        where: {
          task_id: task.id,
          to_status: 'InReview',
          actual_date: { not: null },
        },
        orderBy: { created_at: 'desc' },
        select: { actual_date: true },
      })
      if (!latestInReview?.actual_date) continue
      const target = latestInReview.actual_date
      const hasMismatch =
        !task.actual_end ||
        task.actual_end.getTime() !== target.getTime() ||
        !task.completed_at ||
        task.completed_at.getTime() !== target.getTime()

      if (hasMismatch) candidates.push({ task, targetCompletedAt: target })
    }

    console.log(`Found ${candidates.length} done task(s) needing completion-date correction.`)
    for (const item of candidates.slice(0, 20)) {
      console.log(
        `- #${item.task.id} ${item.task.title}: actual_end ${asIsoDay(item.task.actual_end)} -> ${asIsoDay(item.targetCompletedAt)}`
      )
    }
    if (candidates.length > 20) console.log(`...and ${candidates.length - 20} more`)

    if (!isApply) {
      console.log('\nDry-run only. Re-run with --apply to persist changes.')
      return
    }

    const touchedDeliverables = new Set<number>()
    for (const item of candidates) {
      await prisma.task.update({
        where: { id: item.task.id },
        data: {
          actual_end: item.targetCompletedAt,
          completed_at: item.targetCompletedAt,
        },
      })
      if (item.task.deliverable_id != null) touchedDeliverables.add(item.task.deliverable_id)
    }

    const touchedProjects = new Set<number>()
    for (const deliverableId of touchedDeliverables) {
      const projectId = await recalculateDeliverable(prisma, deliverableId)
      if (projectId != null) touchedProjects.add(projectId)
    }
    for (const projectId of touchedProjects) {
      await recalculateProject(prisma, projectId)
    }

    console.log(`\nApplied updates to ${candidates.length} task(s).`)
    console.log(`Recalculated ${touchedDeliverables.size} deliverable(s) and ${touchedProjects.size} project(s).`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
