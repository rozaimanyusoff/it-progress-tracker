import { PrismaClient, DeliverableType } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import 'dotenv/config'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding module templates...')

  // Clear existing template data (idempotent)
  await prisma.templateTask.deleteMany()
  await prisma.templateDeliverable.deleteMany()
  await prisma.moduleTemplate.deleteMany()

  // ── Template 1: Simple CRUD ───────────────────────────────────────
  const simpleCrud = await prisma.moduleTemplate.create({
    data: {
      code: 'simple_crud',
      display_name: 'Simple CRUD',
      description: 'Single form, single records page. Suitable for straightforward data entry modules.',
      icon: '📋',
      sort_order: 1,
    },
  })

  const sc_db = await prisma.templateDeliverable.create({
    data: { template_id: simpleCrud.id, name: 'Database', type: DeliverableType.database, sort_order: 1 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: sc_db.id, name: 'Design ERD & data model', est_mandays: 0.5, sort_order: 1 },
      { template_deliverable_id: sc_db.id, name: 'Write migration scripts (tables, indexes, FK)', est_mandays: 0.5, sort_order: 2 },
      { template_deliverable_id: sc_db.id, name: 'Create seed / lookup data', est_mandays: 0.5, sort_order: 3 },
    ],
  })

  const sc_be = await prisma.templateDeliverable.create({
    data: { template_id: simpleCrud.id, name: 'Backend API', type: DeliverableType.backend, sort_order: 2 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: sc_be.id, name: 'Setup module folder structure & base routes', est_mandays: 0.5, sort_order: 1 },
      { template_deliverable_id: sc_be.id, name: 'Implement list endpoint (GET with filters)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: sc_be.id, name: 'Implement create endpoint (POST with validation)', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: sc_be.id, name: 'Implement detail endpoint (GET by id)', est_mandays: 0.5, sort_order: 4 },
      { template_deliverable_id: sc_be.id, name: 'Implement update endpoint (PUT/PATCH)', est_mandays: 0.5, sort_order: 5 },
      { template_deliverable_id: sc_be.id, name: 'Implement delete endpoint (soft delete)', est_mandays: 0.5, sort_order: 6 },
      { template_deliverable_id: sc_be.id, name: 'Write API documentation (Postman collection)', est_mandays: 0.5, sort_order: 7 },
    ],
  })

  const sc_fe1 = await prisma.templateDeliverable.create({
    data: { template_id: simpleCrud.id, name: 'Forms & Data Entry', type: DeliverableType.frontend, sort_order: 3 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: sc_fe1.id, name: 'Build create/edit form (fields, validation)', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: sc_fe1.id, name: 'Build detail/view page', est_mandays: 0.5, sort_order: 2 },
      { template_deliverable_id: sc_fe1.id, name: 'Handle form error states & loading states', est_mandays: 0.5, sort_order: 3 },
    ],
  })

  const sc_fe2 = await prisma.templateDeliverable.create({
    data: { template_id: simpleCrud.id, name: 'Records & Display', type: DeliverableType.frontend, sort_order: 4 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: sc_fe2.id, name: 'Build list/table page (columns, search, filters)', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: sc_fe2.id, name: 'Add pagination', est_mandays: 0.5, sort_order: 2 },
      { template_deliverable_id: sc_fe2.id, name: 'Build export function (Excel/PDF)', est_mandays: 1.0, sort_order: 3 },
    ],
  })

  const sc_qa = await prisma.templateDeliverable.create({
    data: { template_id: simpleCrud.id, name: 'Testing & QA', type: DeliverableType.testing, sort_order: 5 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: sc_qa.id, name: 'Unit test — API endpoints', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: sc_qa.id, name: 'Integration testing (end-to-end flow)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: sc_qa.id, name: 'UAT & document test cases', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: sc_qa.id, name: 'Bug fixes post-UAT', est_mandays: 1.0, sort_order: 4 },
    ],
  })

  // ── Template 2: Workflow & Approval ──────────────────────────────
  const workflow = await prisma.moduleTemplate.create({
    data: {
      code: 'workflow_approval',
      display_name: 'Workflow & Approval',
      description: 'Multi-role forms with approval chain, status tracking and history. Suitable for request and approval modules.',
      icon: '🔄',
      sort_order: 2,
    },
  })

  const wa_db = await prisma.templateDeliverable.create({
    data: { template_id: workflow.id, name: 'Database', type: DeliverableType.database, sort_order: 1 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: wa_db.id, name: 'Design ERD & data model (include status/stage)', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: wa_db.id, name: 'Write migration scripts', est_mandays: 0.5, sort_order: 2 },
      { template_deliverable_id: wa_db.id, name: 'Create seed data (status enums, role mappings)', est_mandays: 0.5, sort_order: 3 },
      { template_deliverable_id: wa_db.id, name: 'Design workflow state machine (states/transitions)', est_mandays: 1.0, sort_order: 4 },
    ],
  })

  const wa_be = await prisma.templateDeliverable.create({
    data: { template_id: workflow.id, name: 'Backend API', type: DeliverableType.backend, sort_order: 2 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: wa_be.id, name: 'Setup module structure & base routes', est_mandays: 0.5, sort_order: 1 },
      { template_deliverable_id: wa_be.id, name: 'Implement submission endpoint (create request)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: wa_be.id, name: 'Implement listing endpoints (per role)', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: wa_be.id, name: 'Implement workflow action endpoints (submit, assign, approve, reject, return)', est_mandays: 2.0, sort_order: 4 },
      { template_deliverable_id: wa_be.id, name: 'Implement notification triggers per stage', est_mandays: 1.0, sort_order: 5 },
      { template_deliverable_id: wa_be.id, name: 'Implement history/audit log endpoint', est_mandays: 1.0, sort_order: 6 },
      { template_deliverable_id: wa_be.id, name: 'Write API documentation', est_mandays: 0.5, sort_order: 7 },
    ],
  })

  const wa_fe1 = await prisma.templateDeliverable.create({
    data: { template_id: workflow.id, name: 'Forms & Data Entry', type: DeliverableType.frontend, sort_order: 3 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: wa_fe1.id, name: 'Build requester form (submit new request)', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: wa_fe1.id, name: 'Build coordinator form (process & assign)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: wa_fe1.id, name: 'Build approver form (approve, reject, return)', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: wa_fe1.id, name: 'Handle form validation & error states per role', est_mandays: 1.0, sort_order: 4 },
      { template_deliverable_id: wa_fe1.id, name: 'Build request status tracker (stepper UI)', est_mandays: 1.0, sort_order: 5 },
    ],
  })

  const wa_fe2 = await prisma.templateDeliverable.create({
    data: { template_id: workflow.id, name: 'Records & Display', type: DeliverableType.frontend, sort_order: 4 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: wa_fe2.id, name: 'Build request records (role-based list)', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: wa_fe2.id, name: 'Build request detail page (info + history)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: wa_fe2.id, name: 'Build activity/history records', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: wa_fe2.id, name: 'Add search, filter by status/date/assignee', est_mandays: 1.0, sort_order: 4 },
      { template_deliverable_id: wa_fe2.id, name: 'Build export function (Excel/PDF)', est_mandays: 1.0, sort_order: 5 },
    ],
  })

  const wa_fe3 = await prisma.templateDeliverable.create({
    data: { template_id: workflow.id, name: 'Dashboard & Reports', type: DeliverableType.frontend, sort_order: 5 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: wa_fe3.id, name: 'Build summary dashboard (pending, in progress, completed counts)', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: wa_fe3.id, name: 'Build KPI widgets (avg processing time, approval rate)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: wa_fe3.id, name: 'Build trend chart (requests per month)', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: wa_fe3.id, name: 'Build detailed report with date range filter', est_mandays: 1.0, sort_order: 4 },
      { template_deliverable_id: wa_fe3.id, name: 'Export report (Excel/PDF)', est_mandays: 1.0, sort_order: 5 },
    ],
  })

  const wa_qa = await prisma.templateDeliverable.create({
    data: { template_id: workflow.id, name: 'Testing & QA', type: DeliverableType.testing, sort_order: 6 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: wa_qa.id, name: 'Unit test — API endpoints & workflow logic', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: wa_qa.id, name: 'Integration test — full workflow (submit → approve → complete)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: wa_qa.id, name: 'Role-based access testing', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: wa_qa.id, name: 'UAT & document test cases', est_mandays: 1.0, sort_order: 4 },
      { template_deliverable_id: wa_qa.id, name: 'Bug fixes post-UAT', est_mandays: 1.0, sort_order: 5 },
    ],
  })

  // ── Template 3: Reporting & Dashboard ────────────────────────────
  const reporting = await prisma.moduleTemplate.create({
    data: {
      code: 'reporting_heavy',
      display_name: 'Reporting & Dashboard',
      description: 'Charts, KPIs, data tables and export focus. Suitable for reporting and analytics modules.',
      icon: '📊',
      sort_order: 3,
    },
  })

  const rh_db = await prisma.templateDeliverable.create({
    data: { template_id: reporting.id, name: 'Database', type: DeliverableType.database, sort_order: 1 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: rh_db.id, name: 'Identify data sources & relationships', est_mandays: 0.5, sort_order: 1 },
      { template_deliverable_id: rh_db.id, name: 'Design reporting queries / views', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: rh_db.id, name: 'Create indexes for report performance', est_mandays: 0.5, sort_order: 3 },
    ],
  })

  const rh_be = await prisma.templateDeliverable.create({
    data: { template_id: reporting.id, name: 'Backend API', type: DeliverableType.backend, sort_order: 2 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: rh_be.id, name: 'Setup report module structure', est_mandays: 0.5, sort_order: 1 },
      { template_deliverable_id: rh_be.id, name: 'Implement summary/aggregate endpoint', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: rh_be.id, name: 'Implement detail report endpoint (with filters)', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: rh_be.id, name: 'Implement export endpoint (Excel/PDF generation)', est_mandays: 1.0, sort_order: 4 },
      { template_deliverable_id: rh_be.id, name: 'Performance test queries (large dataset)', est_mandays: 1.0, sort_order: 5 },
      { template_deliverable_id: rh_be.id, name: 'Write API documentation', est_mandays: 0.5, sort_order: 6 },
    ],
  })

  const rh_fe1 = await prisma.templateDeliverable.create({
    data: { template_id: reporting.id, name: 'Dashboard & Widgets', type: DeliverableType.frontend, sort_order: 3 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: rh_fe1.id, name: 'Build summary metric cards (totals, KPIs)', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: rh_fe1.id, name: 'Build primary chart (bar/line — trend)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: rh_fe1.id, name: 'Build secondary chart (pie/donut — distribution)', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: rh_fe1.id, name: 'Build data table with filters & sorting', est_mandays: 1.0, sort_order: 4 },
      { template_deliverable_id: rh_fe1.id, name: 'Add date range filter & drill-down', est_mandays: 1.0, sort_order: 5 },
    ],
  })

  const rh_fe2 = await prisma.templateDeliverable.create({
    data: { template_id: reporting.id, name: 'Reports & Export', type: DeliverableType.frontend, sort_order: 4 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: rh_fe2.id, name: 'Build report filter form (date, category, etc.)', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: rh_fe2.id, name: 'Build printable report view', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: rh_fe2.id, name: 'Implement Excel export', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: rh_fe2.id, name: 'Implement PDF export', est_mandays: 1.0, sort_order: 4 },
    ],
  })

  const rh_qa = await prisma.templateDeliverable.create({
    data: { template_id: reporting.id, name: 'Testing & QA', type: DeliverableType.testing, sort_order: 5 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: rh_qa.id, name: 'Verify data accuracy (cross-check with source)', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: rh_qa.id, name: 'Performance testing (load time, large dataset)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: rh_qa.id, name: 'UAT & document test cases', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: rh_qa.id, name: 'Bug fixes post-UAT', est_mandays: 1.0, sort_order: 4 },
    ],
  })

  // ── Template 4: Master Data Management ───────────────────────────
  const masterData = await prisma.moduleTemplate.create({
    data: {
      code: 'master_data',
      display_name: 'Master Data Management',
      description: 'Reference/lookup data with bulk import and audit log. Suitable for configuration and master data modules.',
      icon: '🗂️',
      sort_order: 4,
    },
  })

  const md_db = await prisma.templateDeliverable.create({
    data: { template_id: masterData.id, name: 'Database', type: DeliverableType.database, sort_order: 1 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: md_db.id, name: 'Design ERD (master + related tables)', est_mandays: 0.5, sort_order: 1 },
      { template_deliverable_id: md_db.id, name: 'Write migration scripts', est_mandays: 0.5, sort_order: 2 },
      { template_deliverable_id: md_db.id, name: 'Create seed data (initial master records)', est_mandays: 0.5, sort_order: 3 },
    ],
  })

  const md_be = await prisma.templateDeliverable.create({
    data: { template_id: masterData.id, name: 'Backend API', type: DeliverableType.backend, sort_order: 2 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: md_be.id, name: 'Setup module structure', est_mandays: 0.5, sort_order: 1 },
      { template_deliverable_id: md_be.id, name: 'Implement CRUD endpoints (with soft delete)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: md_be.id, name: 'Implement bulk import endpoint (Excel upload)', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: md_be.id, name: 'Implement search & filter endpoints', est_mandays: 0.5, sort_order: 4 },
      { template_deliverable_id: md_be.id, name: 'Implement audit log (track data changes)', est_mandays: 1.0, sort_order: 5 },
      { template_deliverable_id: md_be.id, name: 'Write API documentation', est_mandays: 0.5, sort_order: 6 },
    ],
  })

  const md_fe1 = await prisma.templateDeliverable.create({
    data: { template_id: masterData.id, name: 'Forms & Data Entry', type: DeliverableType.frontend, sort_order: 3 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: md_fe1.id, name: 'Build create/edit form', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: md_fe1.id, name: 'Build bulk import form (Excel template + upload)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: md_fe1.id, name: 'Build detail/view page', est_mandays: 0.5, sort_order: 3 },
      { template_deliverable_id: md_fe1.id, name: 'Handle validation (duplicate check, required)', est_mandays: 0.5, sort_order: 4 },
    ],
  })

  const md_fe2 = await prisma.templateDeliverable.create({
    data: { template_id: masterData.id, name: 'Records & Display', type: DeliverableType.frontend, sort_order: 4 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: md_fe2.id, name: 'Build master data list (search & filters)', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: md_fe2.id, name: 'Add status toggle (active/inactive)', est_mandays: 0.5, sort_order: 2 },
      { template_deliverable_id: md_fe2.id, name: 'Build export function', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: md_fe2.id, name: 'Build audit log view (who changed what, when)', est_mandays: 1.0, sort_order: 4 },
    ],
  })

  const md_qa = await prisma.templateDeliverable.create({
    data: { template_id: masterData.id, name: 'Testing & QA', type: DeliverableType.testing, sort_order: 5 },
  })
  await prisma.templateTask.createMany({
    data: [
      { template_deliverable_id: md_qa.id, name: 'Unit test — CRUD & import endpoints', est_mandays: 1.0, sort_order: 1 },
      { template_deliverable_id: md_qa.id, name: 'Data integrity testing (duplicate, constraints)', est_mandays: 1.0, sort_order: 2 },
      { template_deliverable_id: md_qa.id, name: 'UAT & document test cases', est_mandays: 1.0, sort_order: 3 },
      { template_deliverable_id: md_qa.id, name: 'Bug fixes post-UAT', est_mandays: 1.0, sort_order: 4 },
    ],
  })

  console.log('Template seeding complete.')
  console.log('  simple_crud:         5 deliverables')
  console.log('  workflow_approval:   6 deliverables')
  console.log('  reporting_heavy:     5 deliverables')
  console.log('  master_data:         5 deliverables')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
