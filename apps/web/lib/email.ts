import nodemailer from 'nodemailer'

function createTransport() {
  const user = process.env['GMAIL_USER']
  const pass = process.env['GMAIL_APP_PASSWORD']
  if (!user || !pass) throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD env vars not set')

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

export interface DailySummaryData {
  studentName: string
  date: string
  notesCreated: number
  sessionsCompleted: number
  streak: number
  topSubjects: string[]
  tokensUsed: number
  recentNotes: { title: string; subject?: string }[]
}

function buildSummaryHtml(data: DailySummaryData): string {
  const subjectList = data.topSubjects.length
    ? data.topSubjects.map((s) => `<li>${s}</li>`).join('')
    : '<li>General learning</li>'

  const notesList = data.recentNotes.length
    ? data.recentNotes
        .map((n) => `<li><strong>${n.title}</strong>${n.subject ? ` <span style="color:#6366f1">(${n.subject})</span>` : ''}</li>`)
        .join('')
    : '<li>No new notes today</li>'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0f1623;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:40px;margin-bottom:8px;">🌱</div>
      <h1 style="margin:0;font-size:24px;font-weight:800;background:linear-gradient(90deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
        CogniBloom Daily Summary
      </h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:14px;">${data.date}</p>
    </div>

    <!-- Greeting -->
    <div style="background:#1e2d3d;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #2d3f50;">
      <p style="margin:0;font-size:16px;">
        Great work today, <strong style="color:#6366f1;">${data.studentName}</strong>! 🎉
        Here's a snapshot of your learning journey.
      </p>
    </div>

    <!-- Stats grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
      <div style="background:#1e2d3d;border-radius:12px;padding:16px;border:1px solid #2d3f50;text-align:center;">
        <div style="font-size:32px;font-weight:800;color:#6366f1;">${data.notesCreated}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Notes created</div>
      </div>
      <div style="background:#1e2d3d;border-radius:12px;padding:16px;border:1px solid #2d3f50;text-align:center;">
        <div style="font-size:32px;font-weight:800;color:#8b5cf6;">${data.sessionsCompleted}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">AI sessions</div>
      </div>
      <div style="background:#1e2d3d;border-radius:12px;padding:16px;border:1px solid #2d3f50;text-align:center;">
        <div style="font-size:32px;font-weight:800;color:#f59e0b;">🔥 ${data.streak}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Day streak</div>
      </div>
      <div style="background:#1e2d3d;border-radius:12px;padding:16px;border:1px solid #2d3f50;text-align:center;">
        <div style="font-size:32px;font-weight:800;color:#10b981;">${data.tokensUsed.toLocaleString()}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">AI tokens used</div>
      </div>
    </div>

    <!-- Subjects studied -->
    <div style="background:#1e2d3d;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #2d3f50;">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Subjects studied</h3>
      <ul style="margin:0;padding-left:20px;color:#e2e8f0;line-height:1.8;">
        ${subjectList}
      </ul>
    </div>

    <!-- Recent notes -->
    <div style="background:#1e2d3d;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #2d3f50;">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Recent notes</h3>
      <ul style="margin:0;padding-left:20px;color:#e2e8f0;line-height:1.8;">
        ${notesList}
      </ul>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://cognibloom.vercel.app/dashboard"
         style="display:inline-block;background:linear-gradient(90deg,#6366f1,#8b5cf6);color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">
        Open Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#475569;font-size:12px;line-height:1.6;border-top:1px solid #2d3f50;padding-top:16px;">
      <p style="margin:0;">
        Dedicated to <strong style="color:#6366f1;">Daniel</strong> — curiosity is your superpower. Keep blooming. 🌱
      </p>
      <p style="margin:4px 0 0;">© 2026 CogniBloom. Built with love to fuel great minds.</p>
    </div>

  </div>
</body>
</html>`
}

export async function sendDailySummary(
  recipients: string[],
  data: DailySummaryData
): Promise<void> {
  if (recipients.length === 0) {
    console.warn('[email] No recipients configured — skipping daily summary')
    return
  }

  const transport = createTransport()
  const from = `CogniBloom <${process.env['GMAIL_USER']}>`

  await transport.sendMail({
    from,
    to: recipients.join(', '),
    subject: `📚 ${data.studentName}'s Daily Learning Summary — ${data.date}`,
    html: buildSummaryHtml(data),
  })

  console.log(`[email] Daily summary sent to ${recipients.join(', ')}`)
}
