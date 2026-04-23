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

export async function sendActivationEmail(to: string, name: string, activationUrl: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'IT Tracker <noreply@it.local>',
    to,
    subject: 'Activate your IT Tracker account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1d4ed8;">Welcome to IT Tracker</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your account has been created. Click the button below to activate it and set your password.</p>
        <p style="margin:24px 0;">
          <a href="${activationUrl}" style="background:#1d4ed8;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Activate Account
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;">This link expires in 24 hours. If you did not expect this email, you can ignore it.</p>
        <p style="color:#6b7280;font-size:13px;">Or copy this link: ${activationUrl}</p>
      </div>
    `,
  })
}

export async function sendTaskSubmittedForReview(
  managerEmails: string[],
  taskTitle: string,
  memberName: string,
) {
  if (!managerEmails.length) return
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'IT Tracker <noreply@it.local>',
    to: managerEmails.join(', '),
    subject: `Task ready for review: ${taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1d4ed8;">Task Submitted for Review</h2>
        <p><strong>${memberName}</strong> has submitted a task for your review.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;width:30%;">Task</td><td style="padding:8px;border:1px solid #e5e7eb;">${taskTitle}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;">Submitted by</td><td style="padding:8px;border:1px solid #e5e7eb;">${memberName}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;">Status</td><td style="padding:8px;border:1px solid #e5e7eb;">In Progress → <strong style="color:#d97706;">To Review</strong></td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;">Please log in to IT Tracker to review and approve or reject this task.</p>
      </div>
    `,
  })
}

export async function sendProjectDeleted(
  managerEmails: string[],
  projectTitle: string,
  deleterName: string,
) {
  if (!managerEmails.length) return
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'IT Tracker <noreply@it.local>',
    to: managerEmails.join(', '),
    subject: `Project deleted: ${projectTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#dc2626;">Project Deleted</h2>
        <p>A project has been permanently deleted from IT Tracker.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;width:30%;">Project</td><td style="padding:8px;border:1px solid #e5e7eb;">${projectTitle}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;">Deleted by</td><td style="padding:8px;border:1px solid #e5e7eb;">${deleterName}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;">This action cannot be undone.</p>
      </div>
    `,
  })
}

export async function sendTaskAssigned(
  memberEmail: string,
  memberName: string,
  taskTitle: string,
) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'IT Tracker <noreply@it.local>',
    to: memberEmail,
    subject: `You have been assigned a task: ${taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1d4ed8;">New Task Assigned</h2>
        <p>Hi <strong>${memberName}</strong>,</p>
        <p>A task has been assigned to you in IT Tracker.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;width:30%;">Task</td><td style="padding:8px;border:1px solid #e5e7eb;">${taskTitle}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;">Please log in to IT Tracker to view your task details.</p>
      </div>
    `,
  })
}

export async function sendIssueAssigned(
  memberEmail: string,
  memberName: string,
  issueTitle: string,
) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'IT Tracker <noreply@it.local>',
    to: memberEmail,
    subject: `You have been assigned an issue: ${issueTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#d97706;">Issue Assigned to You</h2>
        <p>Hi <strong>${memberName}</strong>,</p>
        <p>An issue has been assigned to you in IT Tracker.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;width:30%;">Issue</td><td style="padding:8px;border:1px solid #e5e7eb;">${issueTitle}</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;">Please log in to IT Tracker to view the issue details.</p>
      </div>
    `,
  })
}

export async function sendTaskRejected(
  memberEmail: string,
  memberName: string,
  taskTitle: string,
) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'IT Tracker <noreply@it.local>',
    to: memberEmail,
    subject: `Task review rejected: ${taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#dc2626;">Task Returned for Revision</h2>
        <p>Hi <strong>${memberName}</strong>,</p>
        <p>Your task has been reviewed and returned back to <strong>In Progress</strong> for further work.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;width:30%;">Task</td><td style="padding:8px;border:1px solid #e5e7eb;">${taskTitle}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;">Status</td><td style="padding:8px;border:1px solid #e5e7eb;">To Review → <strong style="color:#2563eb;">In Progress</strong></td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;">Please log in to IT Tracker to continue working on this task.</p>
      </div>
    `,
  })
}

export async function sendTaskApproved(
  memberEmail: string,
  memberName: string,
  taskTitle: string,
) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'IT Tracker <noreply@it.local>',
    to: memberEmail,
    subject: `Task approved: ${taskTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#16a34a;">Task Approved</h2>
        <p>Hi <strong>${memberName}</strong>,</p>
        <p>Great work! Your task has been reviewed and marked as <strong>Done</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;width:30%;">Task</td><td style="padding:8px;border:1px solid #e5e7eb;">${taskTitle}</td></tr>
          <tr><td style="padding:8px;background:#f3f4f6;font-weight:600;">Status</td><td style="padding:8px;border:1px solid #e5e7eb;">To Review → <strong style="color:#16a34a;">Done</strong></td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px;">Thank you for your contribution to IT Tracker.</p>
      </div>
    `,
  })
}

export async function sendWeeklyPendingTasksReminder(
  memberEmail: string,
  memberName: string,
  tasks: Array<{ title: string; project: string; dueDate: string; status: string }>,
) {
  if (!tasks.length) return
  const rows = tasks
    .slice(0, 20)
    .map((t) => `
      <tr>
        <td style="padding:8px;border:1px solid #e5e7eb;">${t.title}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;">${t.project}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;">${t.status}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;">${t.dueDate}</td>
      </tr>
    `)
    .join('')

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'IT Tracker <noreply@it.local>',
    to: memberEmail,
    subject: `Weekly pending tasks reminder (${tasks.length})`,
    html: `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto;">
        <h2 style="color:#1d4ed8;">Weekly Pending Tasks</h2>
        <p>Hi <strong>${memberName}</strong>,</p>
        <p>You currently have <strong>${tasks.length}</strong> pending task(s).</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <thead>
            <tr>
              <th style="padding:8px;background:#f3f4f6;text-align:left;border:1px solid #e5e7eb;">Task</th>
              <th style="padding:8px;background:#f3f4f6;text-align:left;border:1px solid #e5e7eb;">Project</th>
              <th style="padding:8px;background:#f3f4f6;text-align:left;border:1px solid #e5e7eb;">Status</th>
              <th style="padding:8px;background:#f3f4f6;text-align:left;border:1px solid #e5e7eb;">Due</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#6b7280;font-size:13px;">Please review and update these tasks in IT Tracker.</p>
      </div>
    `,
  })
}

export async function sendExportEmail(recipients: string[], month: string, pptxBuffer: Buffer) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'IT Tracker <noreply@it.local>',
    to: recipients.join(', '),
    subject: `IT Section Monthly Progress Report — ${month}`,
    text: `Please find attached the IT Section Monthly Progress Report for ${month}.`,
    attachments: [
      {
        filename: `IT_Progress_Report_${month.replace(' ', '_')}.pptx`,
        content: pptxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      },
    ],
  })
}
