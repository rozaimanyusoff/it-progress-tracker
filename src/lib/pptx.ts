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
