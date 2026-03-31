import PptxGenJS from 'pptxgenjs'

interface ProjectData {
  title: string
  progress: number
  status: string
  owner: string
}

export interface ReportSections {
  gantt: boolean
  burndown: boolean
  issues: boolean
}

interface IssueData {
  title: string
  project: string
  severity: string
}

const NAVY = '0f1f35'
const WHITE = 'FFFFFF'
const GREEN = '22c55e'
const ORANGE = 'f97316'
const RED = 'ef4444'
const GRAY = '6b7280'

function statusColor(status: string): string {
  if (status === 'Done') return GREEN
  if (status === 'InProgress') return ORANGE
  if (status === 'OnHold') return RED
  return GRAY
}

function statusLabel(status: string): string {
  if (status === 'InProgress') return 'In Progress'
  if (status === 'OnHold') return 'On Hold'
  return status
}

function severityColor(severity: string): string {
  if (severity === 'high') return RED
  if (severity === 'medium') return ORANGE
  return GREEN
}

export async function generatePPTX(
  month: string,
  projects: ProjectData[],
  issues: IssueData[]
): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  // Cover slide
  const cover = pptx.addSlide()
  cover.background = { color: NAVY }
  cover.addText('IT Section', { x: 1, y: 1.5, w: 11, h: 0.8, fontSize: 28, color: '93c5fd', bold: false, align: 'center' })
  cover.addText('Monthly Progress Report', { x: 1, y: 2.4, w: 11, h: 1, fontSize: 40, color: WHITE, bold: true, align: 'center' })
  cover.addText(month, { x: 1, y: 3.6, w: 11, h: 0.7, fontSize: 24, color: '93c5fd', align: 'center' })
  cover.addShape(pptx.ShapeType.line, { x: 2, y: 4.5, w: 9, h: 0, line: { color: '1e3a5f', width: 2 } })
  cover.addText('Prepared by IT Management', { x: 1, y: 4.8, w: 11, h: 0.5, fontSize: 14, color: '64748b', align: 'center' })

  // Summary slide
  const summary = pptx.addSlide()
  summary.background = { color: NAVY }
  summary.addText('Summary — All Projects', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 22, color: WHITE, bold: true })

  const avg = projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0
  summary.addText(`${projects.length} projects · avg ${avg}%`, {
    x: 0.5, y: 1.0, w: 12, h: 0.4, fontSize: 13, color: '93c5fd', bold: true,
  })

  let yPos = 1.55
  for (const proj of projects) {
    const color = statusColor(proj.status)
    summary.addText(proj.title, { x: 0.5, y: yPos, w: 4.5, h: 0.32, fontSize: 10, color: WHITE })
    summary.addShape(pptx.ShapeType.rect, { x: 5.1, y: yPos + 0.04, w: 4, h: 0.2, fill: { color: '1e3a5f' }, line: { color: '1e3a5f' } })
    if (proj.progress > 0) {
      summary.addShape(pptx.ShapeType.rect, { x: 5.1, y: yPos + 0.04, w: 4 * proj.progress / 100, h: 0.2, fill: { color: color }, line: { color: color } })
    }
    summary.addText(`${proj.progress}%`, { x: 9.2, y: yPos, w: 0.7, h: 0.32, fontSize: 9, color: WHITE, align: 'center' })
    summary.addShape(pptx.ShapeType.roundRect, { x: 10.0, y: yPos + 0.02, w: 1.1, h: 0.25, fill: { color: color }, line: { color: color }, rectRadius: 0.05 })
    summary.addText(statusLabel(proj.status), { x: 10.0, y: yPos + 0.02, w: 1.1, h: 0.25, fontSize: 8, color: WHITE, align: 'center', bold: true })
    summary.addText(proj.owner, { x: 11.2, y: yPos, w: 1.8, h: 0.32, fontSize: 9, color: '94a3b8' })
    yPos += 0.36
  }

  // Project detail slide
  const detailSlide = pptx.addSlide()
  detailSlide.background = { color: NAVY }
  detailSlide.addText('All Projects', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 22, color: WHITE, bold: true })
  detailSlide.addText(`${projects.length} project(s)`, { x: 0.5, y: 0.9, w: 12, h: 0.35, fontSize: 13, color: '64748b' })

  const headers = ['Project', 'Owner', 'Progress', 'Status', 'Deadline']
  const rows: string[][] = projects.map(p => [p.title, p.owner, `${p.progress}%`, statusLabel(p.status), ''])

  if (rows.length > 0) {
    detailSlide.addTable([
      headers.map(h => ({ text: h, options: { bold: true, color: WHITE, fill: { color: '1e3a5f' }, fontSize: 11 } })),
      ...rows.map(row => row.map((cell, i) => ({
        text: cell,
        options: {
          color: i === 3 ? statusColor(projects[rows.indexOf(row)]?.status || '') : 'e2e8f0',
          fontSize: 10,
          fill: { color: '162d4a' },
        },
      }))),
    ], {
      x: 0.5, y: 1.4, w: 12.3, colW: [4, 2, 1.5, 2, 2.8],
      border: { type: 'solid', color: '1e3a5f', pt: 1 },
    })
  }

  // Open issues slide
  const issSlide = pptx.addSlide()
  issSlide.background = { color: NAVY }
  issSlide.addText('Open Issues', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 22, color: WHITE, bold: true })

  if (issues.length === 0) {
    issSlide.addText('No open issues', { x: 0.5, y: 1.5, w: 12, h: 0.5, fontSize: 14, color: '64748b', align: 'center' })
  } else {
    issSlide.addTable([
      [
        { text: 'Issue', options: { bold: true, color: WHITE, fill: { color: '1e3a5f' }, fontSize: 11 } },
        { text: 'Project', options: { bold: true, color: WHITE, fill: { color: '1e3a5f' }, fontSize: 11 } },
        { text: 'Severity', options: { bold: true, color: WHITE, fill: { color: '1e3a5f' }, fontSize: 11 } },
      ],
      ...issues.slice(0, 15).map(iss => [
        { text: iss.title, options: { color: 'e2e8f0', fontSize: 10, fill: { color: '162d4a' } } },
        { text: iss.project, options: { color: 'e2e8f0', fontSize: 10, fill: { color: '162d4a' } } },
        { text: iss.severity.toUpperCase(), options: { color: severityColor(iss.severity), fontSize: 10, fill: { color: '162d4a' }, bold: true } },
      ]),
    ], {
      x: 0.5, y: 1.1, w: 12.3, colW: [5.5, 5, 1.8],
      border: { type: 'solid', color: '1e3a5f', pt: 1 },
    })
  }

  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer
  return buffer
}

// ── Per-project PPTX export ──────────────────────────────────────────────────

export interface ProjectExportInput {
  project: {
    title: string
    description: string | null
    status: string
    start_date: Date
    deadline: Date
    assignees: { user: { name: string } }[]
    updates: { progress_pct: number }[]
  }
  modules: { id: number; title: string; order: number }[]
  deliverables: {
    id: number
    title: string
    status: string
    mandays: number
    planned_start: Date | null
    planned_end: Date | null
    actual_start: Date | null
    actual_end: Date | null
    module_id: number | null
    tasks: { status: string; actual_end: Date | null }[]
  }[]
}

function fmtD(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
}

function taskStats(tasks: { status: string }[]) {
  const done = tasks.filter(t => t.status === 'Done').length
  return { done, total: tasks.length }
}

function buildBurndown(
  tasks: { status: string; actual_end: Date | null }[],
  projectStart: Date,
  projectDeadline: Date,
) {
  const start = new Date(projectStart); start.setHours(0, 0, 0, 0)
  const deadline = new Date(projectDeadline); deadline.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const total = tasks.length
  if (total === 0) return { labels: [] as string[], ideal: [] as number[], actual: [] as number[] }

  const totalDays = Math.max(1, (deadline.getTime() - start.getTime()) / 86400000)
  const endDate = today > deadline ? new Date(today) : new Date(deadline)

  const completionsByDate = new Map<string, number>()
  for (const task of tasks) {
    if (task.status === 'Done' && task.actual_end) {
      const d = new Date(task.actual_end); d.setHours(0, 0, 0, 0)
      const key = d.toISOString().slice(0, 10)
      completionsByDate.set(key, (completionsByDate.get(key) ?? 0) + 1)
    }
  }

  const allLabels: string[] = []
  const allIdeal: number[] = []
  const allActual: number[] = []
  let cumulativeDone = 0
  let lastActual = total
  const cur = new Date(start)

  while (cur <= endDate) {
    const dayIndex = (cur.getTime() - start.getTime()) / 86400000
    const key = cur.toISOString().slice(0, 10)
    allLabels.push(cur.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }))
    allIdeal.push(Math.max(0, Math.round(total * (1 - dayIndex / totalDays) * 10) / 10))
    if (cur.getTime() <= today.getTime()) {
      cumulativeDone += completionsByDate.get(key) ?? 0
      lastActual = total - cumulativeDone
    }
    allActual.push(lastActual)
    cur.setDate(cur.getDate() + 1)
  }

  // Sample to ≤40 points so the x-axis stays readable
  if (allLabels.length <= 40) return { labels: allLabels, ideal: allIdeal, actual: allActual }
  const step = Math.ceil(allLabels.length / 40)
  const labels: string[] = [], ideal: number[] = [], actual: number[] = []
  for (let i = 0; i < allLabels.length; i += step) {
    labels.push(allLabels[i]); ideal.push(allIdeal[i]); actual.push(allActual[i])
  }
  // Always include last point
  const last = allLabels.length - 1
  if (labels[labels.length - 1] !== allLabels[last]) {
    labels.push(allLabels[last]); ideal.push(allIdeal[last]); actual.push(allActual[last])
  }
  return { labels, ideal, actual }
}

export async function generateProjectPPTX(input: ProjectExportInput): Promise<Buffer> {
  const { project, modules, deliverables } = input
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  const allTasks = deliverables.flatMap(d => d.tasks)
  const doneTasks = allTasks.filter(t => t.status === 'Done').length
  const progress = allTasks.length > 0
    ? Math.round(doneTasks / allTasks.length * 100)
    : (project.updates[0]?.progress_pct ?? 0)
  const assignees = project.assignees.map(a => a.user.name).join(', ') || '—'
  const exportedAt = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── Light theme palette ───────────────────────────────────────────
  const BG = 'FFFFFF'
  const CARD = 'F8FAFC'
  const BORDER = 'E2E8F0'
  const H1 = '0F172A'
  const BODY = '334155'
  const MUTED = '94A3B8'
  const ACCENT = '2563EB'
  const BLUE_LT = 'DBEAFE'
  const BLUE_MD = 'BFDBFE'
  const L_GREEN = '16A34A'
  const L_ORANGE = 'EA580C'
  const L_RED = 'DC2626'
  const L_GRAY = '64748B'
  const AMBER = 'F59E0B'
  const MS_D = 86400000

  function lStatColor(s: string): string {
    if (s === 'Done') return L_GREEN
    if (s === 'InProgress') return L_ORANGE
    if (s === 'OnHold') return L_RED
    return L_GRAY
  }
  function lStatBg(s: string): string {
    if (s === 'Done') return 'DCFCE7'
    if (s === 'InProgress') return 'FFEDD5'
    if (s === 'OnHold') return 'FEE2E2'
    return 'F1F5F9'
  }

  // ── Slide 1: Project Overview ─────────────────────────────────────
  const s1 = pptx.addSlide()
  s1.background = { color: BG }

  s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
  s1.addText(project.title, { x: 0.5, y: 0.22, w: 10.4, h: 0.65, fontSize: 26, color: H1, bold: true })
  const sCl = lStatColor(project.status)
  const sBg = lStatBg(project.status)
  s1.addShape(pptx.ShapeType.roundRect, { x: 11.2, y: 0.26, w: 1.8, h: 0.32, fill: { color: sBg }, line: { color: sCl }, rectRadius: 0.06 })
  s1.addText(statusLabel(project.status), { x: 11.2, y: 0.26, w: 1.8, h: 0.32, fontSize: 9, color: sCl, bold: true, align: 'center', valign: 'middle' })

  if (project.description) {
    s1.addText(project.description, { x: 0.5, y: 1.0, w: 12.3, h: 0.35, fontSize: 11, color: MUTED, italic: true })
  }
  const infoY = project.description ? 1.5 : 1.2
  s1.addShape(pptx.ShapeType.line, { x: 0.5, y: infoY - 0.12, w: 12.3, h: 0, line: { color: BORDER, width: 1 } })

  const metas = [
    { label: 'ASSIGNEES', value: assignees },
    { label: 'START DATE', value: fmtD(project.start_date) },
    { label: 'DEADLINE', value: fmtD(project.deadline) },
    { label: 'EXPORTED', value: exportedAt },
  ]
  const mbW = 3.08
  metas.forEach((m, i) => {
    const x = 0.5 + i * mbW
    s1.addText(m.label, { x, y: infoY, w: mbW - 0.1, h: 0.2, fontSize: 8, color: MUTED, bold: true })
    s1.addText(m.value, { x, y: infoY + 0.24, w: mbW - 0.1, h: 0.32, fontSize: 11, color: BODY })
  })

  const barY = infoY + 0.75
  s1.addText('OVERALL PROGRESS', { x: 0.5, y: barY, w: 6, h: 0.2, fontSize: 8, color: MUTED, bold: true })
  s1.addText(`${progress}%`, { x: 11.8, y: barY, w: 1.0, h: 0.2, fontSize: 10, color: ACCENT, bold: true, align: 'right' })
  s1.addShape(pptx.ShapeType.rect, { x: 0.5, y: barY + 0.26, w: 12.3, h: 0.28, fill: { color: BORDER }, line: { color: BORDER } })
  if (progress > 0) {
    const fc = progress >= 100 ? L_GREEN : ACCENT
    s1.addShape(pptx.ShapeType.rect, { x: 0.5, y: barY + 0.26, w: Math.max(0.1, 12.3 * progress / 100), h: 0.28, fill: { color: fc }, line: { color: fc } })
  }

  const statsY = barY + 0.85
  s1.addShape(pptx.ShapeType.line, { x: 0.5, y: statsY - 0.1, w: 12.3, h: 0, line: { color: BORDER, width: 1 } })
  const statsData = [
    { num: modules.length, label: 'Modules', color: ACCENT },
    { num: deliverables.length, label: 'Deliverables', color: ACCENT },
    { num: allTasks.length, label: 'Total Tasks', color: BODY },
    { num: doneTasks, label: 'Completed', color: L_GREEN },
    { num: allTasks.length - doneTasks, label: 'Remaining', color: L_ORANGE },
  ]
  const swW = 2.46
  statsData.forEach((st, i) => {
    const sx = 0.5 + i * swW
    s1.addShape(pptx.ShapeType.rect, { x: sx, y: statsY, w: swW - 0.1, h: 1.15, fill: { color: CARD }, line: { color: BORDER } })
    s1.addText(String(st.num), { x: sx + 0.15, y: statsY + 0.12, w: swW - 0.4, h: 0.6, fontSize: 30, color: st.color, bold: true })
    s1.addText(st.label, { x: sx + 0.15, y: statsY + 0.78, w: swW - 0.4, h: 0.28, fontSize: 9, color: MUTED })
  })

  s1.addText(`Exported ${exportedAt}`, { x: 0.5, y: 7.15, w: 12.3, h: 0.2, fontSize: 7, color: BORDER, align: 'right' })

  // ── Slide 2: Gantt Chart ──────────────────────────────────────────
  const s2 = pptx.addSlide()
  s2.background = { color: BG }
  s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
  s2.addText('Gantt Chart', { x: 0.5, y: 0.15, w: 8.5, h: 0.46, fontSize: 18, color: H1, bold: true })
  s2.addText(`${fmtD(project.start_date)} → ${fmtD(project.deadline)}  ·  ${project.title}`, {
    x: 0.5, y: 0.63, w: 9.5, h: 0.25, fontSize: 9, color: MUTED,
  })

  // Legend
  s2.addShape(pptx.ShapeType.rect, { x: 9.2, y: 0.22, w: 0.42, h: 0.11, fill: { color: BORDER }, line: { color: MUTED } })
  s2.addText('Planned', { x: 9.67, y: 0.19, w: 1.0, h: 0.17, fontSize: 7.5, color: L_GRAY })
  s2.addShape(pptx.ShapeType.rect, { x: 10.75, y: 0.22, w: 0.42, h: 0.11, fill: { color: ACCENT }, line: { color: ACCENT } })
  s2.addText('Progress', { x: 11.22, y: 0.19, w: 1.0, h: 0.17, fontSize: 7.5, color: L_GRAY })
  s2.addShape(pptx.ShapeType.rect, { x: 12.3, y: 0.22, w: 0.42, h: 0.11, fill: { color: L_GREEN }, line: { color: L_GREEN } })
  s2.addText('Actual', { x: 12.77, y: 0.19, w: 0.5, h: 0.17, fontSize: 7.5, color: L_GRAY })

  // Layout constants
  const G_LABEL_W = 2.9
  const G_CHART_X = 3.05
  const G_CHART_W = 10.1
  const G_HDR_Y = 0.98
  const G_HDR_H = 0.3
  const G_ROW_Y0 = G_HDR_Y + G_HDR_H
  const G_ROW_H = 0.3
  const G_MOD_H = 0.26
  const G_MAX_Y = 7.3

  const ganttStart = new Date(project.start_date); ganttStart.setHours(0, 0, 0, 0)
  const ganttEnd = new Date(project.deadline); ganttEnd.setHours(0, 0, 0, 0)

  const allEndDates: Date[] = [ganttEnd]
  for (const d of deliverables) {
    if (d.actual_end) allEndDates.push(new Date(d.actual_end))
    if (d.planned_end) allEndDates.push(new Date(d.planned_end))
  }
  const effectiveEnd = new Date(Math.max(...allEndDates.map(d => d.getTime())))
  const totalGanttDays = Math.max(1, (effectiveEnd.getTime() - ganttStart.getTime()) / MS_D)

  const xDate = (d: Date): number => {
    const days = (d.getTime() - ganttStart.getTime()) / MS_D
    return G_CHART_X + Math.max(0, Math.min(1, days / totalGanttDays)) * G_CHART_W
  }

  // Column header
  s2.addShape(pptx.ShapeType.rect, { x: 0, y: G_HDR_Y, w: G_CHART_X, h: G_HDR_H, fill: { color: CARD }, line: { color: BORDER } })
  s2.addText('Module / Deliverable', { x: 0.1, y: G_HDR_Y + 0.06, w: G_LABEL_W, h: G_HDR_H - 0.1, fontSize: 7, color: MUTED, bold: true })
  s2.addShape(pptx.ShapeType.rect, { x: G_CHART_X, y: G_HDR_Y, w: G_CHART_W, h: G_HDR_H, fill: { color: CARD }, line: { color: BORDER } })

  // Monthly ticks
  const tickCur = new Date(ganttStart); tickCur.setDate(1); tickCur.setHours(0, 0, 0, 0)
  while (tickCur <= effectiveEnd) {
    const tx = xDate(tickCur)
    if (tx >= G_CHART_X && tx <= G_CHART_X + G_CHART_W) {
      s2.addShape(pptx.ShapeType.line, { x: tx, y: G_HDR_Y, w: 0, h: G_HDR_H, line: { color: BORDER, width: 1 } })
      s2.addText(tickCur.toLocaleDateString('en-MY', { month: 'short', year: '2-digit' }), {
        x: tx + 0.04, y: G_HDR_Y + 0.06, w: 1.1, h: 0.18, fontSize: 7, color: BODY,
      })
    }
    tickCur.setMonth(tickCur.getMonth() + 1)
  }

  const today2 = new Date(); today2.setHours(0, 0, 0, 0)

  // Draw one deliverable row
  const drawDelivRow = (slide: any, deliv: ProjectExportInput['deliverables'][0], rowY: number, alternate: boolean) => {
    const rowBg = alternate ? CARD : BG
    const dStatC = lStatColor(deliv.status)
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: rowY, w: 13.33, h: G_ROW_H, fill: { color: rowBg }, line: { color: BORDER } })
    slide.addText(deliv.title, { x: 0.12, y: rowY + 0.02, w: G_LABEL_W - 0.15, h: 0.18, fontSize: 7.5, color: BODY })
    slide.addShape(pptx.ShapeType.ellipse, { x: 0.12, y: rowY + 0.2, w: 0.07, h: 0.07, fill: { color: dStatC }, line: { color: dStatC } })
    slide.addText(statusLabel(deliv.status), { x: 0.22, y: rowY + 0.18, w: G_LABEL_W - 0.35, h: 0.11, fontSize: 6.5, color: dStatC })

    // Planned bar (grey track) + progress fill
    if (deliv.planned_start && deliv.planned_end) {
      const pS = new Date(deliv.planned_start); pS.setHours(0, 0, 0, 0)
      const pE = new Date(deliv.planned_end); pE.setHours(0, 0, 0, 0)
      const px = xDate(pS)
      const pw = Math.max(0.05, xDate(pE) - px)
      slide.addShape(pptx.ShapeType.rect, { x: px, y: rowY + 0.04, w: pw, h: 0.1, fill: { color: BORDER }, line: { color: MUTED } })
      const { done: dDone, total: dTotal } = taskStats(deliv.tasks)
      const pct = dTotal > 0 ? dDone / dTotal : 0
      if (pct > 0) {
        const fillC = pct >= 1 ? L_GREEN : ACCENT
        slide.addShape(pptx.ShapeType.rect, { x: px, y: rowY + 0.04, w: Math.max(0.04, pw * pct), h: 0.1, fill: { color: fillC }, line: { color: fillC } })
      }
    }

    // Actual bar (status colour, below planned)
    if (deliv.actual_start) {
      const aS = new Date(deliv.actual_start); aS.setHours(0, 0, 0, 0)
      const aE = deliv.actual_end ? new Date(deliv.actual_end) : new Date(today2); aE.setHours(0, 0, 0, 0)
      const ax = xDate(aS)
      const aw = Math.max(0.05, xDate(aE) - ax)
      slide.addShape(pptx.ShapeType.rect, { x: ax, y: rowY + 0.18, w: aw, h: 0.09, fill: { color: dStatC }, line: { color: dStatC } })
    }
  }

  // Rows
  let rowY = G_ROW_Y0
  for (const mod of modules) {
    const modDelivs = deliverables.filter(d => d.module_id === mod.id)
    if (modDelivs.length === 0) continue
    if (rowY + G_MOD_H > G_MAX_Y) break
    s2.addShape(pptx.ShapeType.rect, { x: 0, y: rowY, w: 13.33, h: G_MOD_H, fill: { color: BLUE_LT }, line: { color: BLUE_MD } })
    s2.addText(mod.title, { x: 0.15, y: rowY + 0.03, w: G_LABEL_W - 0.2, h: G_MOD_H - 0.06, fontSize: 8, color: ACCENT, bold: true })
    const mDoneG = modDelivs.reduce((s, d) => s + taskStats(d.tasks).done, 0)
    const mTotalG = modDelivs.reduce((s, d) => s + taskStats(d.tasks).total, 0)
    s2.addText(`${mDoneG}/${mTotalG} tasks`, { x: G_CHART_X, y: rowY + 0.03, w: 1.5, h: G_MOD_H - 0.06, fontSize: 7, color: ACCENT })
    rowY += G_MOD_H
    modDelivs.forEach((d, idx) => {
      if (rowY + G_ROW_H > G_MAX_Y) return
      drawDelivRow(s2, d, rowY, idx % 2 === 1)
      rowY += G_ROW_H
    })
  }

  const ungrouped2 = deliverables.filter(d => !d.module_id)
  if (ungrouped2.length > 0 && rowY + G_MOD_H <= G_MAX_Y) {
    s2.addShape(pptx.ShapeType.rect, { x: 0, y: rowY, w: 13.33, h: G_MOD_H, fill: { color: CARD }, line: { color: BORDER } })
    s2.addText('Ungrouped', { x: 0.15, y: rowY + 0.03, w: G_LABEL_W, h: G_MOD_H - 0.06, fontSize: 8, color: MUTED, bold: true })
    rowY += G_MOD_H
    ungrouped2.forEach((d, idx) => {
      if (rowY + G_ROW_H > G_MAX_Y) return
      drawDelivRow(s2, d, rowY, idx % 2 === 1)
      rowY += G_ROW_H
    })
  }

  // Today vertical line
  if (today2 >= ganttStart && today2 <= effectiveEnd) {
    const todayX = xDate(today2)
    const lineH = Math.min(rowY, G_MAX_Y) - G_ROW_Y0
    if (lineH > 0) {
      s2.addShape(pptx.ShapeType.line, { x: todayX, y: G_ROW_Y0, w: 0, h: lineH, line: { color: AMBER, width: 1.5, dashType: 'dash' } })
      s2.addText('Today', { x: todayX - 0.3, y: G_HDR_Y + 0.07, w: 0.6, h: 0.16, fontSize: 6.5, color: AMBER, align: 'center', bold: true })
    }
  }

  // Bottom border
  s2.addShape(pptx.ShapeType.line, { x: 0, y: Math.min(rowY, G_MAX_Y), w: 13.33, h: 0, line: { color: BORDER, width: 1 } })

  // ── Slide 3: Modules & Deliverables table ─────────────────────────
  const s3 = pptx.addSlide()
  s3.background = { color: BG }
  s3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
  s3.addText('Modules & Deliverables', { x: 0.5, y: 0.18, w: 10.5, h: 0.5, fontSize: 18, color: H1, bold: true })
  s3.addText(`${deliverables.length} deliverable${deliverables.length !== 1 ? 's' : ''} · ${allTasks.length} task${allTasks.length !== 1 ? 's' : ''}`, {
    x: 0.5, y: 0.71, w: 12.3, h: 0.25, fontSize: 10, color: MUTED,
  })

  const CELL = (text: string, color: string, bg = BG, opts: Record<string, unknown> = {}) => ({
    text, options: { color, fill: { color: bg }, fontSize: 8.5, ...opts },
  })
  const colW = [3.4, 1.8, 1.2, 0.8, 2.0, 2.0, 1.0]
  const headerRow = ['Deliverable', 'Module', 'Status', 'Days', 'Planned', 'Actual', 'Tasks'].map(h =>
    ({ text: h, options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT }, fontSize: 9 } })
  )
  const tableRows: any[][] = [headerRow]

  const buildDelivRow = (d: ProjectExportInput['deliverables'][0], modName: string, rowBg = BG) => {
    const { done, total } = taskStats(d.tasks)
    const sCol = lStatColor(d.status)
    return [
      CELL(d.title, H1, rowBg),
      CELL(modName, MUTED, rowBg),
      CELL(statusLabel(d.status), sCol, rowBg, { bold: true }),
      CELL(`${d.mandays}d`, BODY, rowBg, { align: 'center' }),
      CELL(`${fmtD(d.planned_start)} → ${fmtD(d.planned_end)}`, MUTED, rowBg, { fontSize: 8 }),
      CELL(d.actual_start ? `${fmtD(d.actual_start)} → ${d.actual_end ? fmtD(d.actual_end) : 'Ongoing'}` : '—', d.actual_start ? BODY : MUTED, rowBg, { fontSize: 8 }),
      CELL(`${done}/${total}`, done === total && total > 0 ? L_GREEN : BODY, rowBg, { align: 'center' }),
    ]
  }

  for (const mod of modules) {
    const modDelivs = deliverables.filter(d => d.module_id === mod.id)
    if (modDelivs.length === 0) continue
    const mDone3 = modDelivs.reduce((s, d) => s + taskStats(d.tasks).done, 0)
    const mTotal3 = modDelivs.reduce((s, d) => s + taskStats(d.tasks).total, 0)
    tableRows.push([
      { text: `▶  ${mod.title}`, options: { bold: true, color: ACCENT, fill: { color: BLUE_LT }, fontSize: 9, colspan: 6 } },
      CELL(`${mDone3}/${mTotal3}`, mDone3 === mTotal3 && mTotal3 > 0 ? L_GREEN : ACCENT, BLUE_LT, { align: 'center', bold: true }),
    ])
    modDelivs.forEach((d, idx) => tableRows.push(buildDelivRow(d, mod.title, idx % 2 === 0 ? BG : CARD)))
  }

  const ungrouped = deliverables.filter(d => !d.module_id)
  if (ungrouped.length > 0) {
    const uDone3 = ungrouped.reduce((s, d) => s + taskStats(d.tasks).done, 0)
    const uTotal3 = ungrouped.reduce((s, d) => s + taskStats(d.tasks).total, 0)
    tableRows.push([
      { text: '▶  Ungrouped', options: { bold: true, color: MUTED, fill: { color: CARD }, fontSize: 9, colspan: 6 } },
      CELL(`${uDone3}/${uTotal3}`, MUTED, CARD, { align: 'center', bold: true }),
    ])
    ungrouped.forEach((d, idx) => tableRows.push(buildDelivRow(d, '—', idx % 2 === 0 ? BG : CARD)))
  }

  if (tableRows.length > 1) {
    s3.addTable(tableRows, {
      x: 0.3, y: 1.1, w: 12.7, colW,
      border: { type: 'solid', color: BORDER, pt: 1 },
      autoPage: true,
      autoPageRepeatHeader: true,
    })
  } else {
    s3.addText('No deliverables added to this project yet.', { x: 0.5, y: 2.5, w: 12.3, h: 0.5, fontSize: 13, color: MUTED, align: 'center' })
  }

  // ── Slide 4: Burndown Chart ───────────────────────────────────────
  const s4 = pptx.addSlide()
  s4.background = { color: BG }
  s4.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
  s4.addText('Burndown Chart', { x: 0.5, y: 0.18, w: 10, h: 0.5, fontSize: 18, color: H1, bold: true })
  s4.addText(`${doneTasks} of ${allTasks.length} tasks completed · ${allTasks.length - doneTasks} remaining · as of ${new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}`, {
    x: 0.5, y: 0.71, w: 12.3, h: 0.25, fontSize: 10, color: MUTED,
  })

  const bd = buildBurndown(allTasks, project.start_date, project.deadline)
  if (bd.labels.length >= 2) {
    s4.addChart('line' as any, [
      { name: 'Ideal', labels: bd.labels, values: bd.ideal },
      { name: 'Actual', labels: bd.labels, values: bd.actual },
    ], {
      x: 0.4, y: 1.1, w: 12.5, h: 5.5,
      chartColors: [MUTED, ACCENT],
      lineDataSymbol: 'none' as any,
      showLegend: true,
      legendPos: 'b',
      legendFontSize: 10,
      legendFontColor: BODY,
      catAxisLabelFontSize: 8,
      catAxisLabelColor: MUTED,
      valAxisLabelFontSize: 8,
      valAxisLabelColor: MUTED,
      plotAreaBkgndColor: CARD,
      chartAreaBkgndColor: BG,
      showTitle: false,
      valGridLine: { color: BORDER, style: 'solid', pt: 1 } as any,
    } as any)
  } else {
    s4.addText('Not enough task data to render burndown chart.\nAdd tasks with actual dates to see progress.', {
      x: 0.5, y: 3, w: 12.3, h: 1, fontSize: 14, color: MUTED, align: 'center',
    })
  }

  return await pptx.write({ outputType: 'nodebuffer' }) as unknown as Buffer
}

// ── Multi-project report PPTX ────────────────────────────────────────────────

interface ReportTaskInput {
  status: string
  actual_end: Date | null
  time_spent_seconds: number
  assigned_to: number | null
  assignee: { id: number; name: string } | null
}

interface ReportProjectInput {
  project: ProjectExportInput['project']
  modules: ProjectExportInput['modules']
  deliverables: (Omit<ProjectExportInput['deliverables'][0], 'tasks'> & { tasks: ReportTaskInput[] })[]
}

export async function generateReportPPTX(
  fromMonth: string,
  toMonth: string,
  projects: ReportProjectInput[],
  openIssues: IssueData[],
  sections: ReportSections,
): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'

  // ── Light theme palette ─────────────────────────────────────────────────────
  const BG = 'FFFFFF'
  const CARD = 'F8FAFC'
  const BORDER = 'E2E8F0'
  const H1 = '0F172A'
  const BODY = '334155'
  const MUTED = '94A3B8'
  const ACCENT = '2563EB'
  const GREEN = '16A34A'
  const ORANGE = 'EA580C'
  const REDC = 'DC2626'
  const GRAY = '64748B'
  const AMBER = 'F59E0B'
  const BLU_LT = 'DBEAFE'
  const BLU_MD = 'BFDBFE'
  const MS_D = 86400000

  const periodLabel = fromMonth === toMonth ? fromMonth : `${fromMonth} — ${toMonth}`
  const exportedAt = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })

  function rStatColor(s: string) {
    if (s === 'Done') return GREEN
    if (s === 'InProgress') return ORANGE
    if (s === 'OnHold') return REDC
    return GRAY
  }
  function rStatBg(s: string) {
    if (s === 'Done') return 'DCFCE7'
    if (s === 'InProgress') return 'FFEDD5'
    if (s === 'OnHold') return 'FEE2E2'
    return 'F1F5F9'
  }
  function rStatLabel(s: string) {
    if (s === 'InProgress') return 'In Progress'
    if (s === 'OnHold') return 'On Hold'
    return s
  }

  // ── Slide 1: Cover ──────────────────────────────────────────────────────────
  const cover = pptx.addSlide()
  cover.background = { color: CARD }
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.28, fill: { color: ACCENT }, line: { color: ACCENT } })
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 7.22, w: 13.33, h: 0.28, fill: { color: ACCENT }, line: { color: ACCENT } })
  cover.addText('IT Section', { x: 1, y: 1.1, w: 11, h: 0.7, fontSize: 22, color: MUTED, align: 'center', bold: false })
  cover.addText('Progress Report', { x: 1, y: 1.85, w: 11, h: 1.1, fontSize: 46, color: H1, bold: true, align: 'center' })
  cover.addShape(pptx.ShapeType.line, { x: 3.2, y: 3.1, w: 6.9, h: 0, line: { color: BORDER, width: 2 } })
  cover.addText(periodLabel, { x: 1, y: 3.28, w: 11, h: 0.62, fontSize: 22, color: ACCENT, align: 'center', bold: true })
  cover.addText(`${projects.length} project${projects.length !== 1 ? 's' : ''}  ·  Exported ${exportedAt}`, {
    x: 1, y: 4.05, w: 11, h: 0.4, fontSize: 12, color: MUTED, align: 'center',
  })

  // ── Slide 2: Projects Summary with donut charts ─────────────────────────────
  // Projects flow across multiple slides if > 6 per slide
  const PER_PAGE = 6
  const projChunks: typeof projects[] = []
  for (let i = 0; i < projects.length; i += PER_PAGE) projChunks.push(projects.slice(i, i + PER_PAGE))

  for (const chunk of projChunks) {
    const sumSlide = pptx.addSlide()
    sumSlide.background = { color: BG }
    sumSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
    sumSlide.addText('Projects Overview', { x: 0.5, y: 0.15, w: 9, h: 0.52, fontSize: 20, color: H1, bold: true })
    sumSlide.addText(periodLabel, { x: 0.5, y: 0.68, w: 12.3, h: 0.26, fontSize: 10, color: MUTED })

    // Grid: 3 cols × 2 rows
    const COLS = 3
    const CW = 4.22    // cell width
    const CH = 3.0     // cell height
    const Y0 = 1.08    // grid top

    chunk.forEach((proj, idx) => {
      const col = idx % COLS
      const row = Math.floor(idx / COLS)
      const cx = 0.15 + col * CW
      const cy = Y0 + row * CH

      const allT = proj.deliverables.flatMap(d => d.tasks)
      const doneT = allT.filter(t => t.status === 'Done').length
      const pct = allT.length ? Math.round(doneT / allT.length * 100) : (proj.project.updates[0]?.progress_pct ?? 0)

      // Card background
      sumSlide.addShape(pptx.ShapeType.roundRect, {
        x: cx, y: cy, w: CW - 0.15, h: CH - 0.12,
        fill: { color: CARD }, line: { color: BORDER }, rectRadius: 0.1,
      })

      // Doughnut chart (centered in card)
      const DONUT_W = 1.6
      const dx = cx + (CW - 0.15) / 2 - DONUT_W / 2
      const dy = cy + 0.55
      const statColor = rStatColor(proj.project.status)
      const remaining = Math.max(0, 100 - pct)
      sumSlide.addChart('doughnut' as any, [
        { name: 'Progress', labels: ['Done', 'Remaining'], values: [pct, remaining] },
      ], {
        x: dx, y: dy, w: DONUT_W, h: DONUT_W,
        chartColors: [statColor, BORDER],
        holeSize: 65,
        showLegend: false,
        showLabel: false,
        showTitle: false,
        dataLabelFontSize: 1,
        chartAreaBkgndColor: CARD,
        plotAreaBkgndColor: CARD,
      } as any)

      // Percentage text overlaid in donut center
      sumSlide.addText(`${pct}%`, {
        x: dx, y: dy + DONUT_W / 2 - 0.22,
        w: DONUT_W, h: 0.44,
        fontSize: 16, color: H1, bold: true, align: 'center',
      })

      // Project title
      sumSlide.addText(proj.project.title, {
        x: cx + 0.1, y: cy + 0.1,
        w: CW - 0.35, h: 0.38,
        fontSize: 9.5, color: H1, bold: true, align: 'center',
      })

      // Status badge
      const sBg = rStatBg(proj.project.status)
      sumSlide.addShape(pptx.ShapeType.roundRect, {
        x: cx + (CW - 0.15) / 2 - 0.65, y: cy + CH - 0.68,
        w: 1.3, h: 0.24, fill: { color: sBg }, line: { color: statColor }, rectRadius: 0.04,
      })
      sumSlide.addText(rStatLabel(proj.project.status), {
        x: cx + (CW - 0.15) / 2 - 0.65, y: cy + CH - 0.68,
        w: 1.3, h: 0.24, fontSize: 7.5, color: statColor, bold: true, align: 'center',
      })

      // Task counts row at bottom
      const tkY = cy + CH - 0.42
      sumSlide.addText(`${doneT}/${allT.length} tasks`, {
        x: cx + 0.1, y: tkY, w: CW - 0.35, h: 0.22,
        fontSize: 8, color: MUTED, align: 'center',
      })
    })
  }

  // ── Slide 3: Developer Analytics (tasks assigned + time spent) ──────────────
  // Aggregate member stats across all selected projects
  const memberMap = new Map<number, { name: string; taskCount: number; timeSeconds: number; statusCounts: Record<string, number> }>()
  for (const { deliverables } of projects) {
    for (const deliv of deliverables) {
      for (const task of deliv.tasks) {
        if (!task.assigned_to || !task.assignee) continue
        const id = task.assigned_to
        if (!memberMap.has(id)) {
          memberMap.set(id, { name: task.assignee.name, taskCount: 0, timeSeconds: 0, statusCounts: {} })
        }
        const m = memberMap.get(id)!
        m.taskCount++
        m.timeSeconds += task.time_spent_seconds ?? 0
        m.statusCounts[task.status] = (m.statusCounts[task.status] ?? 0) + 1
      }
    }
  }
  const members = Array.from(memberMap.values()).sort((a, b) => b.taskCount - a.taskCount)

  if (members.length > 0) {
    const analyticsSlide = pptx.addSlide()
    analyticsSlide.background = { color: BG }
    analyticsSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
    analyticsSlide.addText('Developer Analytics', { x: 0.5, y: 0.15, w: 10, h: 0.52, fontSize: 20, color: H1, bold: true })
    analyticsSlide.addText(periodLabel, { x: 0.5, y: 0.68, w: 12.3, h: 0.26, fontSize: 10, color: MUTED })

    const names = members.map(m => m.name)

    // Left: Tasks Assigned
    analyticsSlide.addText('Tasks Assigned', { x: 0.4, y: 1.08, w: 6, h: 0.3, fontSize: 12, color: H1, bold: true })
    analyticsSlide.addChart('bar' as any, [
      { name: 'Tasks', labels: names, values: members.map(m => m.taskCount) },
    ], {
      x: 0.4, y: 1.45, w: 6.2, h: 5.5,
      barDir: 'bar',
      chartColors: [ACCENT],
      showLegend: false,
      showTitle: false,
      showValue: true,
      dataLabelColor: H1,
      dataLabelFontSize: 9,
      catAxisLabelFontSize: 9,
      catAxisLabelColor: BODY,
      valAxisLabelFontSize: 8,
      valAxisLabelColor: MUTED,
      plotAreaBkgndColor: CARD,
      chartAreaBkgndColor: BG,
      valGridLine: { color: BORDER, style: 'solid', pt: 1 } as any,
    } as any)

    // Right: Time Spent (hours)
    analyticsSlide.addText('Time Spent (hours)', { x: 6.9, y: 1.08, w: 6, h: 0.3, fontSize: 12, color: H1, bold: true })
    analyticsSlide.addChart('bar' as any, [
      { name: 'Hours', labels: names, values: members.map(m => Math.round(m.timeSeconds / 3600 * 10) / 10) },
    ], {
      x: 6.9, y: 1.45, w: 6.1, h: 5.5,
      barDir: 'bar',
      chartColors: [GREEN],
      showLegend: false,
      showTitle: false,
      showValue: true,
      dataLabelColor: H1,
      dataLabelFontSize: 9,
      catAxisLabelFontSize: 9,
      catAxisLabelColor: BODY,
      valAxisLabelFontSize: 8,
      valAxisLabelColor: MUTED,
      plotAreaBkgndColor: CARD,
      chartAreaBkgndColor: BG,
      valGridLine: { color: BORDER, style: 'solid', pt: 1 } as any,
    } as any)
  }

  // ── Slide 4: Team Workload Balance ─────────────────────────────────────────
  if (members.length > 0) {
    const wbSlide = pptx.addSlide()
    wbSlide.background = { color: BG }
    wbSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
    wbSlide.addText('Team Workload Balance', { x: 0.5, y: 0.15, w: 10, h: 0.52, fontSize: 20, color: H1, bold: true })
    wbSlide.addText(periodLabel, { x: 0.5, y: 0.68, w: 12.3, h: 0.26, fontSize: 10, color: MUTED })

    const STATUS_COLS = ['Todo', 'InProgress', 'InReview', 'Done']
    const STATUS_LABELS = ['To Do', 'In Progress', 'In Review', 'Done']
    const STATUS_COLORS = ['94A3B8', ORANGE, AMBER, GREEN]

    const headerRow = [
      { text: 'Member', options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT }, fontSize: 10 } },
      ...STATUS_LABELS.map((l, i) => ({
        text: l, options: { bold: true, color: 'FFFFFF', fill: { color: STATUS_COLORS[i] }, fontSize: 10 },
      })),
      { text: 'Total', options: { bold: true, color: 'FFFFFF', fill: { color: H1 }, fontSize: 10 } },
    ]

    const tableRows = [headerRow, ...members.slice(0, 16).map((m, idx) => {
      const rb = idx % 2 === 0 ? BG : CARD
      const total = m.taskCount
      return [
        { text: m.name, options: { color: H1, fill: { color: rb }, fontSize: 9.5, bold: true } },
        ...STATUS_COLS.map((s, si) => ({
          text: String(m.statusCounts[s] ?? 0),
          options: { color: STATUS_COLORS[si], fill: { color: rb }, fontSize: 9.5, align: 'center' as const, bold: (m.statusCounts[s] ?? 0) > 0 },
        })),
        { text: String(total), options: { color: BODY, fill: { color: rb }, fontSize: 9.5, align: 'center' as const, bold: true } },
      ]
    })]

    wbSlide.addTable(tableRows, {
      x: 0.5, y: 1.1, w: 12.3,
      colW: [3.5, 1.9, 2.1, 2.0, 1.8, 1.0],
      border: { type: 'solid', color: BORDER, pt: 1 },
    })
  }

  // ── Per-project slides ──────────────────────────────────────────────────────
  for (const { project, modules, deliverables } of projects) {
    const allTasks = deliverables.flatMap(d => d.tasks)
    const doneCount = allTasks.filter(t => t.status === 'Done').length
    const pct = allTasks.length ? Math.round(doneCount / allTasks.length * 100) : (project.updates[0]?.progress_pct ?? 0)
    const assignees = project.assignees.map((a: any) => a.user.name).join(', ') || '—'

    // Project overview
    const s1 = pptx.addSlide()
    s1.background = { color: BG }
    s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
    s1.addText(project.title, { x: 0.5, y: 0.2, w: 10.4, h: 0.62, fontSize: 24, color: H1, bold: true })
    const sCl = rStatColor(project.status)
    const sBg = rStatBg(project.status)
    s1.addShape(pptx.ShapeType.roundRect, { x: 11.2, y: 0.24, w: 1.8, h: 0.32, fill: { color: sBg }, line: { color: sCl }, rectRadius: 0.06 })
    s1.addText(rStatLabel(project.status), { x: 11.2, y: 0.24, w: 1.8, h: 0.32, fontSize: 9, color: sCl, bold: true, align: 'center', valign: 'middle' })
    const infoY = 1.1
    const metas = [
      { label: 'ASSIGNEES', value: assignees },
      { label: 'START DATE', value: project.start_date ? new Date(project.start_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
      { label: 'DEADLINE', value: project.deadline ? new Date(project.deadline).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
      { label: 'EXPORTED', value: exportedAt },
    ]
    const mW = 3.08
    metas.forEach((m, i) => {
      s1.addText(m.label, { x: 0.5 + i * mW, y: infoY, w: mW - 0.1, h: 0.2, fontSize: 8, color: MUTED, bold: true })
      s1.addText(m.value, { x: 0.5 + i * mW, y: infoY + 0.24, w: mW - 0.1, h: 0.32, fontSize: 11, color: BODY })
    })
    const barY = infoY + 0.74
    s1.addText('OVERALL PROGRESS', { x: 0.5, y: barY, w: 8, h: 0.2, fontSize: 8, color: MUTED, bold: true })
    s1.addText(`${pct}%`, { x: 11.9, y: barY, w: 0.9, h: 0.2, fontSize: 10, color: ACCENT, bold: true, align: 'right' })
    s1.addShape(pptx.ShapeType.rect, { x: 0.5, y: barY + 0.26, w: 12.3, h: 0.28, fill: { color: BORDER }, line: { color: BORDER } })
    if (pct > 0) s1.addShape(pptx.ShapeType.rect, { x: 0.5, y: barY + 0.26, w: Math.max(0.1, 12.3 * pct / 100), h: 0.28, fill: { color: pct >= 100 ? GREEN : ACCENT }, line: { color: pct >= 100 ? GREEN : ACCENT } })
    const statsData = [
      { num: modules.length, label: 'Modules', color: ACCENT },
      { num: deliverables.length, label: 'Deliverables', color: ACCENT },
      { num: allTasks.length, label: 'Total Tasks', color: BODY },
      { num: doneCount, label: 'Completed', color: GREEN },
      { num: allTasks.length - doneCount, label: 'Remaining', color: ORANGE },
    ]
    const stY = barY + 0.82
    const stW = 2.46
    statsData.forEach((st, i) => {
      s1.addShape(pptx.ShapeType.rect, { x: 0.5 + i * stW, y: stY, w: stW - 0.1, h: 1.1, fill: { color: CARD }, line: { color: BORDER } })
      s1.addText(String(st.num), { x: 0.65 + i * stW, y: stY + 0.12, w: stW - 0.4, h: 0.55, fontSize: 28, color: st.color, bold: true })
      s1.addText(st.label, { x: 0.65 + i * stW, y: stY + 0.72, w: stW - 0.4, h: 0.28, fontSize: 9, color: MUTED })
    })

    // Gantt slide
    if (sections.gantt) {
      const s2 = pptx.addSlide()
      s2.background = { color: BG }
      s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
      s2.addText('Gantt Chart', { x: 0.5, y: 0.15, w: 8.5, h: 0.46, fontSize: 18, color: H1, bold: true })
      s2.addText(project.title, { x: 0.5, y: 0.63, w: 9.5, h: 0.25, fontSize: 9, color: MUTED })

      // Legend
      s2.addShape(pptx.ShapeType.rect, { x: 9.2, y: 0.22, w: 0.42, h: 0.11, fill: { color: BORDER }, line: { color: MUTED } })
      s2.addText('Planned', { x: 9.67, y: 0.19, w: 1.0, h: 0.17, fontSize: 7.5, color: GRAY })
      s2.addShape(pptx.ShapeType.rect, { x: 10.75, y: 0.22, w: 0.42, h: 0.11, fill: { color: ACCENT }, line: { color: ACCENT } })
      s2.addText('Progress', { x: 11.22, y: 0.19, w: 1.0, h: 0.17, fontSize: 7.5, color: GRAY })
      s2.addShape(pptx.ShapeType.rect, { x: 12.3, y: 0.22, w: 0.42, h: 0.11, fill: { color: GREEN }, line: { color: GREEN } })
      s2.addText('Actual', { x: 12.77, y: 0.19, w: 0.5, h: 0.17, fontSize: 7.5, color: GRAY })

      const G_LABEL_W = 2.9; const G_CHART_X = 3.05; const G_CHART_W = 10.1
      const G_HDR_Y = 0.98; const G_HDR_H = 0.3; const G_ROW_Y0 = G_HDR_Y + G_HDR_H
      const G_ROW_H = 0.3; const G_MOD_H = 0.26; const G_MAX_Y = 7.3

      const ganttStart = new Date(project.start_date); ganttStart.setHours(0, 0, 0, 0)
      const ganttEnd = new Date(project.deadline); ganttEnd.setHours(0, 0, 0, 0)
      const allEndDates: Date[] = [ganttEnd]
      deliverables.forEach(d => {
        if (d.actual_end) allEndDates.push(new Date(d.actual_end))
        if (d.planned_end) allEndDates.push(new Date(d.planned_end))
      })
      const effectiveEnd = new Date(Math.max(...allEndDates.map(d => d.getTime())))
      const totalGanttDays = Math.max(1, (effectiveEnd.getTime() - ganttStart.getTime()) / MS_D)
      const xDate = (d: Date) => G_CHART_X + Math.max(0, Math.min(1, (d.getTime() - ganttStart.getTime()) / MS_D / totalGanttDays)) * G_CHART_W

      s2.addShape(pptx.ShapeType.rect, { x: 0, y: G_HDR_Y, w: G_CHART_X, h: G_HDR_H, fill: { color: CARD }, line: { color: BORDER } })
      s2.addText('Module / Deliverable', { x: 0.1, y: G_HDR_Y + 0.06, w: G_LABEL_W, h: G_HDR_H - 0.1, fontSize: 7, color: MUTED, bold: true })
      s2.addShape(pptx.ShapeType.rect, { x: G_CHART_X, y: G_HDR_Y, w: G_CHART_W, h: G_HDR_H, fill: { color: CARD }, line: { color: BORDER } })

      const today2 = new Date(); today2.setHours(0, 0, 0, 0)
      const tickCur = new Date(ganttStart); tickCur.setDate(1); tickCur.setHours(0, 0, 0, 0)
      while (tickCur <= effectiveEnd) {
        const tx = xDate(tickCur)
        if (tx >= G_CHART_X && tx <= G_CHART_X + G_CHART_W) {
          s2.addShape(pptx.ShapeType.line, { x: tx, y: G_HDR_Y, w: 0, h: G_HDR_H, line: { color: BORDER, width: 1 } })
          s2.addText(tickCur.toLocaleDateString('en-MY', { month: 'short', year: '2-digit' }), { x: tx + 0.04, y: G_HDR_Y + 0.06, w: 1.1, h: 0.18, fontSize: 7, color: BODY })
        }
        tickCur.setMonth(tickCur.getMonth() + 1)
      }

      const drawRow = (d: typeof deliverables[0], rowY: number, alt: boolean) => {
        const dSC = rStatColor(d.status)
        s2.addShape(pptx.ShapeType.rect, { x: 0, y: rowY, w: 13.33, h: G_ROW_H, fill: { color: alt ? CARD : BG }, line: { color: BORDER } })
        s2.addText(d.title, { x: 0.12, y: rowY + 0.02, w: G_LABEL_W - 0.15, h: 0.18, fontSize: 7.5, color: BODY })
        s2.addText(rStatLabel(d.status), { x: 0.22, y: rowY + 0.19, w: G_LABEL_W - 0.35, h: 0.11, fontSize: 6.5, color: dSC })
        if (d.planned_start && d.planned_end) {
          const pS = new Date(d.planned_start); pS.setHours(0, 0, 0, 0)
          const pE = new Date(d.planned_end); pE.setHours(0, 0, 0, 0)
          const px2 = xDate(pS); const pw = Math.max(0.05, xDate(pE) - px2)
          s2.addShape(pptx.ShapeType.rect, { x: px2, y: rowY + 0.04, w: pw, h: 0.1, fill: { color: BORDER }, line: { color: MUTED } })
          const dT = d.tasks.length; const dD2 = d.tasks.filter(t => t.status === 'Done').length
          const fpct = dT > 0 ? dD2 / dT : 0
          if (fpct > 0) s2.addShape(pptx.ShapeType.rect, { x: px2, y: rowY + 0.04, w: Math.max(0.04, pw * fpct), h: 0.1, fill: { color: fpct >= 1 ? GREEN : ACCENT }, line: { color: fpct >= 1 ? GREEN : ACCENT } })
        }
        if (d.actual_start) {
          const aS = new Date(d.actual_start); aS.setHours(0, 0, 0, 0)
          const aE = d.actual_end ? new Date(d.actual_end) : new Date(today2); aE.setHours(0, 0, 0, 0)
          const ax = xDate(aS); const aw = Math.max(0.05, xDate(aE) - ax)
          s2.addShape(pptx.ShapeType.rect, { x: ax, y: rowY + 0.18, w: aw, h: 0.09, fill: { color: dSC }, line: { color: dSC } })
        }
      }

      let rowY2 = G_ROW_Y0
      for (const mod of modules) {
        const mDelivs = deliverables.filter(d => d.module_id === mod.id)
        if (!mDelivs.length) continue
        if (rowY2 + G_MOD_H > G_MAX_Y) break
        s2.addShape(pptx.ShapeType.rect, { x: 0, y: rowY2, w: 13.33, h: G_MOD_H, fill: { color: BLU_LT }, line: { color: BLU_MD } })
        s2.addText(mod.title, { x: 0.15, y: rowY2 + 0.03, w: G_LABEL_W, h: G_MOD_H - 0.06, fontSize: 8, color: ACCENT, bold: true })
        rowY2 += G_MOD_H
        mDelivs.forEach((d, idx) => { if (rowY2 + G_ROW_H <= G_MAX_Y) { drawRow(d, rowY2, idx % 2 === 1); rowY2 += G_ROW_H } })
      }
      const ungrouped = deliverables.filter(d => !d.module_id)
      if (ungrouped.length && rowY2 + G_MOD_H <= G_MAX_Y) {
        s2.addShape(pptx.ShapeType.rect, { x: 0, y: rowY2, w: 13.33, h: G_MOD_H, fill: { color: CARD }, line: { color: BORDER } })
        s2.addText('Ungrouped', { x: 0.15, y: rowY2 + 0.03, w: G_LABEL_W, h: G_MOD_H - 0.06, fontSize: 8, color: MUTED, bold: true })
        rowY2 += G_MOD_H
        ungrouped.forEach((d, idx) => { if (rowY2 + G_ROW_H <= G_MAX_Y) { drawRow(d, rowY2, idx % 2 === 1); rowY2 += G_ROW_H } })
      }
      if (today2 >= ganttStart && today2 <= effectiveEnd) {
        const todayX = xDate(today2)
        const lh = Math.min(rowY2, G_MAX_Y) - G_ROW_Y0
        if (lh > 0) {
          s2.addShape(pptx.ShapeType.line, { x: todayX, y: G_ROW_Y0, w: 0, h: lh, line: { color: AMBER, width: 1.5, dashType: 'dash' } })
          s2.addText('Today', { x: todayX - 0.3, y: G_HDR_Y + 0.07, w: 0.6, h: 0.16, fontSize: 6.5, color: AMBER, align: 'center', bold: true })
        }
      }
    }

    // Burndown slide
    if (sections.burndown) {
      const s3 = pptx.addSlide()
      s3.background = { color: BG }
      s3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
      s3.addText('Burndown Chart', { x: 0.5, y: 0.18, w: 10, h: 0.5, fontSize: 18, color: H1, bold: true })
      s3.addText(`${project.title}  ·  ${doneCount} of ${allTasks.length} tasks completed`, { x: 0.5, y: 0.71, w: 12.3, h: 0.25, fontSize: 10, color: MUTED })
      const bd = buildBurndown(allTasks, project.start_date, project.deadline)
      if (bd.labels.length >= 2) {
        s3.addChart('line' as any, [
          { name: 'Ideal', labels: bd.labels, values: bd.ideal },
          { name: 'Actual', labels: bd.labels, values: bd.actual },
        ], {
          x: 0.4, y: 1.1, w: 12.5, h: 5.5,
          chartColors: [MUTED, ACCENT],
          lineDataSymbol: 'none' as any,
          showLegend: true, legendPos: 'b', legendFontSize: 10,
          legendFontColor: BODY,
          catAxisLabelFontSize: 8, catAxisLabelColor: MUTED,
          valAxisLabelFontSize: 8, valAxisLabelColor: MUTED,
          plotAreaBkgndColor: CARD, chartAreaBkgndColor: BG,
          showTitle: false,
          valGridLine: { color: BORDER, style: 'solid', pt: 1 } as any,
        } as any)
      } else {
        s3.addText('Not enough task data to render burndown chart.', { x: 0.5, y: 3.5, w: 12.3, h: 0.5, fontSize: 14, color: MUTED, align: 'center' })
      }
    }

    // Issues slide (per-project)
    if (sections.issues) {
      const projIssues = openIssues.filter(i => i.project === project.title)
      const issSlide = pptx.addSlide()
      issSlide.background = { color: BG }
      issSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: ACCENT }, line: { color: ACCENT } })
      issSlide.addText('Open Issues', { x: 0.5, y: 0.18, w: 10, h: 0.5, fontSize: 18, color: H1, bold: true })
      issSlide.addText(`${project.title}  ·  ${projIssues.length} unresolved issue${projIssues.length !== 1 ? 's' : ''}`, {
        x: 0.5, y: 0.71, w: 12.3, h: 0.25, fontSize: 10, color: MUTED,
      })
      if (projIssues.length === 0) {
        issSlide.addText('No open issues — all clear!', { x: 0.5, y: 3.5, w: 12.3, h: 0.5, fontSize: 14, color: GREEN, align: 'center', bold: true })
      } else {
        const sevColor = (sev: string) => sev === 'high' ? REDC : sev === 'medium' ? ORANGE : GREEN
        issSlide.addTable([
          [
            { text: 'Issue', options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT }, fontSize: 11 } },
            { text: 'Severity', options: { bold: true, color: 'FFFFFF', fill: { color: ACCENT }, fontSize: 11 } },
          ],
          ...projIssues.slice(0, 18).map((iss, idx) => {
            const rb = idx % 2 === 0 ? BG : CARD
            return [
              { text: iss.title, options: { color: BODY, fontSize: 10, fill: { color: rb } } },
              { text: iss.severity.toUpperCase(), options: { color: sevColor(iss.severity), fontSize: 10, fill: { color: rb }, bold: true } },
            ]
          }),
        ], { x: 0.5, y: 1.1, w: 12.3, colW: [10.3, 2.0], border: { type: 'solid', color: BORDER, pt: 1 } })
      }
    }
  }

  return await pptx.write({ outputType: 'nodebuffer' }) as unknown as Buffer
}

