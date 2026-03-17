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
