import PptxGenJS from 'pptxgenjs'

interface ProjectData {
  title: string
  progress: number
  status: string
  owner: string
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

