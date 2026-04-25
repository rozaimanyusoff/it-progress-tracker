import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

function emailLayout(brandName: string, accentColor: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${brandName}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:${accentColor};padding:20px 32px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">${brandName}</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${body}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">This is an automated message from ${brandName}. Please do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function fromAddress(brandName: string) {
  return process.env.SMTP_FROM || `${brandName} <noreply@it.local>`
}

export async function sendActivationEmail(to: string, name: string, activationUrl: string, brandName = 'IT Tracker') {
  const body = `
    <h2 style="margin:0 0 16px;color:#1e293b;font-size:22px;">Welcome to ${brandName}</h2>
    <p style="margin:0 0 12px;color:#475569;font-size:15px;">Hi <strong>${name}</strong>,</p>
    <p style="margin:0 0 24px;color:#475569;font-size:15px;">Your account has been created. Click the button below to activate it and set your password.</p>
    <p style="margin:0 0 24px;">
      <a href="${activationUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Activate Account</a>
    </p>
    <p style="margin:0;color:#94a3b8;font-size:13px;">This link expires in 24 hours. If you did not expect this email, you can ignore it.</p>
    <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;">Or copy this link: <a href="${activationUrl}" style="color:#2563eb;">${activationUrl}</a></p>
  `
  await transporter.sendMail({
    from: fromAddress(brandName),
    to,
    subject: `Activate your ${brandName} account`,
    html: emailLayout(brandName, '#2563eb', body),
  })
}

export async function sendTaskSubmittedForReview(
  managerEmails: string[],
  taskTitle: string,
  memberName: string,
  brandName = 'IT Tracker',
) {
  if (!managerEmails.length) return
  const body = `
    <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Task Submitted for Review</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;"><strong>${memberName}</strong> has submitted a task for your review.</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px;font-size:14px;">
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;width:35%;border:1px solid #e2e8f0;color:#64748b;">Task</td><td style="padding:10px 12px;border:1px solid #e2e8f0;color:#1e293b;">${taskTitle}</td></tr>
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;border:1px solid #e2e8f0;color:#64748b;">Submitted by</td><td style="padding:10px 12px;border:1px solid #e2e8f0;color:#1e293b;">${memberName}</td></tr>
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;border:1px solid #e2e8f0;color:#64748b;">Status</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">In Progress → <strong style="color:#d97706;">To Review</strong></td></tr>
    </table>
    <p style="margin:0;color:#94a3b8;font-size:13px;">Please log in to ${brandName} to review and approve or reject this task.</p>
  `
  await transporter.sendMail({
    from: fromAddress(brandName),
    to: managerEmails.join(', '),
    subject: `Task ready for review: ${taskTitle}`,
    html: emailLayout(brandName, '#d97706', body),
  })
}

export async function sendProjectDeleted(
  managerEmails: string[],
  projectTitle: string,
  deleterName: string,
  brandName = 'IT Tracker',
) {
  if (!managerEmails.length) return
  const body = `
    <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Project Deleted</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;">A project has been permanently deleted from ${brandName}.</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px;font-size:14px;">
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;width:35%;border:1px solid #e2e8f0;color:#64748b;">Project</td><td style="padding:10px 12px;border:1px solid #e2e8f0;color:#1e293b;">${projectTitle}</td></tr>
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;border:1px solid #e2e8f0;color:#64748b;">Deleted by</td><td style="padding:10px 12px;border:1px solid #e2e8f0;color:#1e293b;">${deleterName}</td></tr>
    </table>
    <p style="margin:0;color:#dc2626;font-size:13px;font-weight:600;">This action cannot be undone.</p>
  `
  await transporter.sendMail({
    from: fromAddress(brandName),
    to: managerEmails.join(', '),
    subject: `Project deleted: ${projectTitle}`,
    html: emailLayout(brandName, '#dc2626', body),
  })
}

export async function sendTaskAssigned(
  memberEmail: string,
  memberName: string,
  taskTitle: string,
  brandName = 'IT Tracker',
) {
  const body = `
    <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">New Task Assigned</h2>
    <p style="margin:0 0 12px;color:#475569;font-size:15px;">Hi <strong>${memberName}</strong>,</p>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;">A task has been assigned to you in ${brandName}.</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px;font-size:14px;">
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;width:35%;border:1px solid #e2e8f0;color:#64748b;">Task</td><td style="padding:10px 12px;border:1px solid #e2e8f0;color:#1e293b;">${taskTitle}</td></tr>
    </table>
    <p style="margin:0;color:#94a3b8;font-size:13px;">Please log in to ${brandName} to view your task details.</p>
  `
  await transporter.sendMail({
    from: fromAddress(brandName),
    to: memberEmail,
    subject: `You have been assigned a task: ${taskTitle}`,
    html: emailLayout(brandName, '#2563eb', body),
  })
}

export async function sendIssueAssigned(
  memberEmail: string,
  memberName: string,
  issueTitle: string,
  brandName = 'IT Tracker',
) {
  const body = `
    <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Issue Assigned to You</h2>
    <p style="margin:0 0 12px;color:#475569;font-size:15px;">Hi <strong>${memberName}</strong>,</p>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;">An issue has been assigned to you in ${brandName}.</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px;font-size:14px;">
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;width:35%;border:1px solid #e2e8f0;color:#64748b;">Issue</td><td style="padding:10px 12px;border:1px solid #e2e8f0;color:#1e293b;">${issueTitle}</td></tr>
    </table>
    <p style="margin:0;color:#94a3b8;font-size:13px;">Please log in to ${brandName} to view the issue details.</p>
  `
  await transporter.sendMail({
    from: fromAddress(brandName),
    to: memberEmail,
    subject: `You have been assigned an issue: ${issueTitle}`,
    html: emailLayout(brandName, '#d97706', body),
  })
}

export async function sendTaskRejected(
  memberEmail: string,
  memberName: string,
  taskTitle: string,
  brandName = 'IT Tracker',
) {
  const body = `
    <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Task Returned for Revision</h2>
    <p style="margin:0 0 12px;color:#475569;font-size:15px;">Hi <strong>${memberName}</strong>,</p>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;">Your task has been reviewed and returned back to <strong>In Progress</strong> for further work.</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px;font-size:14px;">
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;width:35%;border:1px solid #e2e8f0;color:#64748b;">Task</td><td style="padding:10px 12px;border:1px solid #e2e8f0;color:#1e293b;">${taskTitle}</td></tr>
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;border:1px solid #e2e8f0;color:#64748b;">Status</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">To Review → <strong style="color:#2563eb;">In Progress</strong></td></tr>
    </table>
    <p style="margin:0;color:#94a3b8;font-size:13px;">Please log in to ${brandName} to continue working on this task.</p>
  `
  await transporter.sendMail({
    from: fromAddress(brandName),
    to: memberEmail,
    subject: `Task review rejected: ${taskTitle}`,
    html: emailLayout(brandName, '#dc2626', body),
  })
}

export async function sendTaskApproved(
  memberEmail: string,
  memberName: string,
  taskTitle: string,
  brandName = 'IT Tracker',
) {
  const body = `
    <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Task Approved</h2>
    <p style="margin:0 0 12px;color:#475569;font-size:15px;">Hi <strong>${memberName}</strong>,</p>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;">Great work! Your task has been reviewed and marked as <strong>Done</strong>.</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px;font-size:14px;">
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;width:35%;border:1px solid #e2e8f0;color:#64748b;">Task</td><td style="padding:10px 12px;border:1px solid #e2e8f0;color:#1e293b;">${taskTitle}</td></tr>
      <tr><td style="padding:10px 12px;background:#f8fafc;font-weight:600;border:1px solid #e2e8f0;color:#64748b;">Status</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">To Review → <strong style="color:#16a34a;">Done</strong></td></tr>
    </table>
    <p style="margin:0;color:#94a3b8;font-size:13px;">Thank you for your contribution to ${brandName}.</p>
  `
  await transporter.sendMail({
    from: fromAddress(brandName),
    to: memberEmail,
    subject: `Task approved: ${taskTitle}`,
    html: emailLayout(brandName, '#16a34a', body),
  })
}

// ─── Weekly Progress Update ────────────────────────────────────────────────────

export interface WeeklyProgressData {
  weekLabel: string  // e.g. "21 Apr – 25 Apr 2026"
  projects: WeeklyProjectData[]
  developerAnalytics: WeeklyDevAnalytic[]
}

export interface WeeklyProjectData {
  projectTitle: string
  newTasks: Array<{ title: string; assignees: string; deliverable: string }>
  completedTasks: Array<{ title: string; assignees: string; completedDate: string }>
  deliverables: Array<{ title: string; progress: number; status: string; totalTasks: number; doneTasks: number }>
  projectUpdates: Array<{ content: string; author: string; date: string }>
}

export interface WeeklyDevAnalytic {
  name: string
  role: string
  totalAssigned: number
  completedThisWeek: number
  inProgress: number
  estMandays: number
  actualMandays: number
  utilizationPct: number
}

export async function sendWeeklyProgressUpdate(
  recipientEmail: string,
  recipientName: string,
  data: WeeklyProgressData,
  brandName = 'IT Tracker',
) {
  if (!data.projects.length && !data.developerAnalytics.length) return

  const sectionTitle = (text: string, color = '#1e293b') =>
    `<h3 style="margin:24px 0 12px;font-size:15px;font-weight:700;color:${color};border-bottom:2px solid #e2e8f0;padding-bottom:6px;">${text}</h3>`

  const badge = (text: string, bg: string, color: string) =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${bg};color:${color};">${text}</span>`

  const noDataRow = (msg: string) =>
    `<tr><td colspan="4" style="padding:10px 12px;color:#94a3b8;font-style:italic;border:1px solid #e2e8f0;font-size:13px;">${msg}</td></tr>`

  // Build per-project sections
  const projectSections = data.projects.map(p => {
    // New tasks table
    const newTaskRows = p.newTasks.length
      ? p.newTasks.map(t => `<tr>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${t.title}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">${t.deliverable || '—'}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">${t.assignees || 'Unassigned'}</td>
        </tr>`).join('')
      : noDataRow('No new tasks this week')

    // Completed tasks table
    const completedTaskRows = p.completedTasks.length
      ? p.completedTasks.map(t => `<tr>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${t.title}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">${t.assignees || '—'}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#16a34a;font-weight:600;">${t.completedDate}</td>
        </tr>`).join('')
      : noDataRow('No tasks completed this week')

    // Deliverables table
    const delivRows = p.deliverables.length
      ? p.deliverables.map(d => {
        const pct = d.progress
        const barFill = pct >= 100 ? '#16a34a' : pct >= 50 ? '#2563eb' : '#f59e0b'
        const statusColors: Record<string, string> = { Done: '#16a34a', InProgress: '#d97706', Pending: '#64748b', OnHold: '#eab308' }
        const sc = statusColors[d.status] ?? '#64748b'
        return `<tr>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${d.title}</td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;">
              <span style="color:${sc};font-weight:600;">${d.status}</span>
            </td>
            <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;background:#e2e8f0;border-radius:4px;height:8px;min-width:80px;">
                  <div style="width:${pct}%;background:${barFill};height:8px;border-radius:4px;"></div>
                </div>
                <span style="color:#475569;font-size:12px;white-space:nowrap;">${d.doneTasks}/${d.totalTasks} · ${pct}%</span>
              </div>
            </td>
          </tr>`
      }).join('')
      : noDataRow('No deliverables')

    // Project updates
    const updateRows = p.projectUpdates.length
      ? p.projectUpdates.map(u => `<tr>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#1e293b;">${u.content}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">${u.author}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">${u.date}</td>
        </tr>`).join('')
      : noDataRow('No project updates this week')

    return `
      <div style="margin-bottom:32px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        <div style="background:#1e40af;padding:12px 20px;">
          <span style="color:#ffffff;font-weight:700;font-size:15px;">${p.projectTitle}</span>
        </div>
        <div style="padding:16px 20px;">

          ${sectionTitle('🆕 New Tasks Added')}
          <table style="border-collapse:collapse;width:100%;font-size:13px;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Task</th>
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Deliverable</th>
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Assignees</th>
            </tr></thead>
            <tbody>${newTaskRows}</tbody>
          </table>

          ${sectionTitle('✅ Completed Tasks', '#16a34a')}
          <table style="border-collapse:collapse;width:100%;font-size:13px;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Task</th>
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Assignees</th>
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Completed</th>
            </tr></thead>
            <tbody>${completedTaskRows}</tbody>
          </table>

          ${sectionTitle('📦 Deliverables Progress')}
          <table style="border-collapse:collapse;width:100%;font-size:13px;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Deliverable</th>
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Status</th>
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Progress</th>
            </tr></thead>
            <tbody>${delivRows}</tbody>
          </table>

          ${sectionTitle('📝 Project Updates')}
          <table style="border-collapse:collapse;width:100%;font-size:13px;">
            <thead><tr style="background:#f8fafc;">
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Update</th>
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Author</th>
              <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Date</th>
            </tr></thead>
            <tbody>${updateRows}</tbody>
          </table>

        </div>
      </div>
    `
  }).join('')

  // Developer analytics section
  const devRows = data.developerAnalytics.length
    ? data.developerAnalytics.map(d => {
      const utilColor = d.utilizationPct >= 80 ? '#16a34a' : d.utilizationPct >= 40 ? '#d97706' : '#94a3b8'
      return `<tr>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#1e293b;font-weight:600;">${d.name}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">${d.role}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;text-align:center;color:#1e293b;">${d.totalAssigned}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;text-align:center;color:#16a34a;font-weight:600;">${d.completedThisWeek}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;text-align:center;color:#d97706;">${d.inProgress}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;text-align:center;color:#475569;">${d.estMandays > 0 ? d.estMandays.toFixed(1) : '—'}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;text-align:center;color:#475569;">${d.actualMandays > 0 ? d.actualMandays.toFixed(1) : '—'}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;text-align:center;font-weight:600;color:${utilColor};">${d.utilizationPct}%</td>
        </tr>`
    }).join('')
    : `<tr><td colspan="8" style="padding:10px 12px;color:#94a3b8;font-style:italic;border:1px solid #e2e8f0;font-size:13px;">No developer data available</td></tr>`

  const analyticsSection = `
    <div style="margin-bottom:32px;">
      ${sectionTitle('👥 Developer Analytics')}
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Developer</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Role</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">Assigned</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">Done (wk)</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">In Progress</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">Est. md</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">Actual md</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;color:#64748b;">Utilization</th>
        </tr></thead>
        <tbody>${devRows}</tbody>
      </table>
    </div>
  `

  const body = `
    <h2 style="margin:0 0 4px;color:#1e293b;font-size:22px;font-weight:700;">Weekly Progress Update</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Period: <strong>${data.weekLabel}</strong></p>
    <p style="margin:0 0 24px;color:#475569;font-size:15px;">Hi <strong>${recipientName}</strong>, here is your weekly progress summary grouped by project.</p>
    ${projectSections}
    ${analyticsSection}
    <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;">Log in to ${brandName} for full details and real-time updates.</p>
  `

  await transporter.sendMail({
    from: fromAddress(brandName),
    to: recipientEmail,
    subject: `[${brandName}] Weekly Progress Update — ${data.weekLabel}`,
    html: emailLayout(brandName, '#1e40af', body),
  })
}

/** @deprecated replaced by sendWeeklyProgressUpdate */
export async function sendWeeklyPendingTasksReminder(
  memberEmail: string,
  memberName: string,
  tasks: Array<{ title: string; project: string; dueDate: string; status: string }>,
  brandName = 'IT Tracker',
) {
  // Forward to new function as a simple tasks-only digest
  const projectMap = new Map<string, typeof tasks>()
  for (const t of tasks) {
    if (!projectMap.has(t.project)) projectMap.set(t.project, [])
    projectMap.get(t.project)!.push(t)
  }
  const projects: WeeklyProjectData[] = Array.from(projectMap.entries()).map(([title, pts]) => ({
    projectTitle: title,
    newTasks: [],
    completedTasks: [],
    deliverables: [],
    projectUpdates: [],
  }))
  // Fall back to legacy send if no rich data
  const rows = tasks.slice(0, 20).map(t => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;">${t.title}</td>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;">${t.project}</td>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;">${t.status}</td>
      <td style="padding:8px 10px;border:1px solid #e2e8f0;font-size:13px;">${t.dueDate}</td>
    </tr>`).join('')
  const body = `
    <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Weekly Pending Tasks</h2>
    <p style="margin:0 0 12px;color:#475569;font-size:15px;">Hi <strong>${memberName}</strong>,</p>
    <p style="margin:0 0 16px;color:#475569;font-size:15px;">You currently have <strong>${tasks.length}</strong> pending task(s).</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Task</th>
        <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Project</th>
        <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Status</th>
        <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b;">Due</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:16px 0 0;color:#94a3b8;font-size:13px;">Please review and update these tasks in ${brandName}.</p>
  `
  await transporter.sendMail({
    from: fromAddress(brandName),
    to: memberEmail,
    subject: `[${brandName}] Weekly pending tasks reminder (${tasks.length})`,
    html: emailLayout(brandName, '#2563eb', body),
  })
}

export async function sendExportEmail(recipients: string[], month: string, pptxBuffer: Buffer, brandName = 'IT Tracker') {
  await transporter.sendMail({
    from: fromAddress(brandName),
    to: recipients.join(', '),
    subject: `${brandName} Monthly Progress Report — ${month}`,
    text: `Please find attached the ${brandName} Monthly Progress Report for ${month}.`,
    attachments: [
      {
        filename: `Progress_Report_${month.replace(' ', '_')}.pptx`,
        content: pptxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    ],
  })
}

