import { PrismaClient, Role, ProjectStatus, UpdateStatus, Severity } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create manager
  const managerHash = await bcrypt.hash('admin123', 10)
  const manager = await prisma.user.upsert({
    where: { email: 'admin@it.local' },
    update: {},
    create: {
      name: 'Admin Manager',
      email: 'admin@it.local',
      password_hash: managerHash,
      role: Role.manager,
      is_active: true,
    },
  })

  // Create members
  const hash = await bcrypt.hash('member123', 10)
  const member1 = await prisma.user.upsert({
    where: { email: 'alice@it.local' },
    update: {},
    create: { name: 'Alice Dev', email: 'alice@it.local', password_hash: hash, role: Role.member, is_active: true },
  })
  const member2 = await prisma.user.upsert({
    where: { email: 'bob@it.local' },
    update: {},
    create: { name: 'Bob Infra', email: 'bob@it.local', password_hash: hash, role: Role.member, is_active: true },
  })
  const member3 = await prisma.user.upsert({
    where: { email: 'carol@it.local' },
    update: {},
    create: { name: 'Carol Data', email: 'carol@it.local', password_hash: hash, role: Role.member, is_active: true },
  })

  // Create sample projects
  const p1 = await prisma.project.create({
    data: {
      title: 'HR Portal Redesign',
      description: 'Modernize the HR self-service portal',
      owner_id: member1.id,
      start_date: new Date('2026-01-01'),
      deadline: new Date('2026-06-30'),
      status: ProjectStatus.InProgress,
    },
  })
  const p2 = await prisma.project.create({
    data: {
      title: 'Network Infrastructure Upgrade',
      description: 'Upgrade core switches and routers',
      owner_id: member2.id,
      start_date: new Date('2026-02-01'),
      deadline: new Date('2026-05-31'),
      status: ProjectStatus.InProgress,
    },
  })
  const p3 = await prisma.project.create({
    data: {
      title: 'Data Warehouse Migration',
      description: 'Migrate legacy DW to cloud',
      owner_id: member3.id,
      start_date: new Date('2026-01-15'),
      deadline: new Date('2026-07-31'),
      status: ProjectStatus.Pending,
    },
  })

  // Add updates
  await prisma.projectUpdate.createMany({
    data: [
      { project_id: p1.id, user_id: member1.id, progress_pct: 40, status: UpdateStatus.InProgress, notes: 'Completed UI mockups', created_at: new Date('2026-01-15') },
      { project_id: p1.id, user_id: member1.id, progress_pct: 65, status: UpdateStatus.InProgress, notes: 'Backend APIs done', created_at: new Date('2026-02-10') },
      { project_id: p2.id, user_id: member2.id, progress_pct: 30, status: UpdateStatus.InProgress, notes: 'Procurement complete', created_at: new Date('2026-02-20') },
      { project_id: p3.id, user_id: member3.id, progress_pct: 10, status: UpdateStatus.Pending, notes: 'Planning phase', created_at: new Date('2026-02-01') },
    ],
  })

  // Add issues
  await prisma.issue.createMany({
    data: [
      { project_id: p1.id, user_id: member1.id, title: 'Login SSO not working', description: 'SSO redirect fails on IE', severity: Severity.high, resolved: false },
      { project_id: p2.id, user_id: member2.id, title: 'Switch delivery delayed', description: 'Vendor shipping delay 2 weeks', severity: Severity.medium, resolved: false },
      { project_id: p3.id, user_id: member3.id, title: 'Schema mapping incomplete', description: 'Legacy tables not fully mapped', severity: Severity.low, resolved: true },
    ],
  })

  console.log('Seed complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
