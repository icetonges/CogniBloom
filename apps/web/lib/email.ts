import nodemailer from 'nodemailer'

function createTransport() {
  const user = process.env['GMAIL_USER']
  const pass = process.env['GMAIL_APP_PASSWORD']
  if (!user || !pass) throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD env vars not set')
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
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
  flashcardsDue: number
  flashcardsReviewed: number
  quizzesTaken: number
  avgQuizScore: number | null
  masteryHighlight: { subject: string; score: number } | null
}

// ─── HTML builder (table-based for email-client compatibility) ────────────────

function buildSummaryHtml(d: DailySummaryData): string {
  const subjectRows = d.topSubjects.length
    ? d.topSubjects.map((s) => `<li style="line-height:1.9;color:#e2e8f0;">${s}</li>`).join('')
    : '<li style="line-height:1.9;color:#94a3b8;">General learning</li>'

  const noteRows = d.recentNotes.length
    ? d.recentNotes.map((n) => `
        <li style="line-height:1.9;color:#e2e8f0;">
          <strong>${n.title}</strong>
          ${n.subject ? `<span style="color:#6366f1;"> (${n.subject})</span>` : ''}
        </li>`).join('')
    : '<li style="line-height:1.9;color:#94a3b8;">No new notes today</li>'

  const masteryBlock = d.masteryHighlight
    ? `<tr>
        <td style="padding:0 0 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#1e2d3d;border-radius:12px;border:1px solid #2d3f50;">
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#94a3b8;
                           text-transform:uppercase;letter-spacing:0.05em;">⭐ Mastery highlight</p>
                <p style="margin:0;font-size:15px;color:#e2e8f0;">
                  <strong style="color:#6366f1;">${d.masteryHighlight.subject}</strong>
                  — currently at <strong style="color:#10b981;">${Math.round(d.masteryHighlight.score * 100)}%</strong>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ''

  const flashcardBlock = (d.flashcardsReviewed > 0 || d.flashcardsDue > 0)
    ? `<tr>
        <td style="padding:0 0 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#1e2d3d;border-radius:12px;border:1px solid #2d3f50;">
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#94a3b8;
                           text-transform:uppercase;letter-spacing:0.05em;">🃏 Flashcards</p>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="text-align:center;padding:0 8px 0 0;">
                      <div style="font-size:28px;font-weight:800;color:#f59e0b;">
                        ${d.flashcardsReviewed}
                      </div>
                      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Reviewed (last 24h)</div>
                    </td>
                    <td style="text-align:center;padding:0 0 0 8px;
                               border-left:1px solid #2d3f50;">
                      <div style="font-size:28px;font-weight:800;
                                  color:${d.flashcardsDue > 0 ? '#ef4444' : '#10b981'};">
                        ${d.flashcardsDue > 0 ? d.flashcardsDue : '✓'}
                      </div>
                      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
                        ${d.flashcardsDue > 0 ? 'Due now' : 'All caught up'}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ''

  const quizBlock = d.quizzesTaken > 0
    ? `<tr>
        <td style="padding:0 0 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#1e2d3d;border-radius:12px;border:1px solid #2d3f50;">
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#94a3b8;
                           text-transform:uppercase;letter-spacing:0.05em;">🏆 Quizzes (last 24h)</p>
                <p style="margin:0;font-size:15px;color:#e2e8f0;">
                  <strong style="color:#6366f1;">${d.quizzesTaken}</strong> quiz${d.quizzesTaken !== 1 ? 'zes' : ''}
                  ${d.avgQuizScore !== null
                    ? `— avg score <strong style="color:#10b981;">${Math.round(d.avgQuizScore)}%</strong>`
                    : ''}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>CogniBloom Daily Summary</title>
</head>
<body style="margin:0;padding:0;background:#0f1623;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#0f1623;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;
              color:#e2e8f0;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0"
             style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td align="center" style="padding:0 0 32px;">
            <div style="font-size:40px;margin-bottom:8px;">🌱</div>
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#6366f1;">
              CogniBloom Daily Summary
            </h1>
            <p style="margin:6px 0 0;color:#94a3b8;font-size:14px;">${d.date}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:0 0 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:#1e2d3d;border-radius:12px;border:1px solid #2d3f50;">
              <tr>
                <td style="padding:20px;font-size:16px;line-height:1.6;color:#e2e8f0;">
                  Great work today, <strong style="color:#6366f1;">${d.studentName}</strong>! 🎉
                  Here's a snapshot of your learning journey.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Stats: 2×2 grid via nested table -->
        <tr>
          <td style="padding:0 0 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="48%" style="padding:0 8px 8px 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="background:#1e2d3d;border-radius:12px;border:1px solid #2d3f50;">
                    <tr>
                      <td align="center" style="padding:16px;">
                        <div style="font-size:32px;font-weight:800;color:#6366f1;">${d.notesCreated}</div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Notes created</div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td width="48%" style="padding:0 0 8px 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="background:#1e2d3d;border-radius:12px;border:1px solid #2d3f50;">
                    <tr>
                      <td align="center" style="padding:16px;">
                        <div style="font-size:32px;font-weight:800;color:#8b5cf6;">${d.sessionsCompleted}</div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">AI sessions</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td width="48%" style="padding:0 8px 0 0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="background:#1e2d3d;border-radius:12px;border:1px solid #2d3f50;">
                    <tr>
                      <td align="center" style="padding:16px;">
                        <div style="font-size:32px;font-weight:800;color:#f59e0b;">🔥 ${d.streak}</div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Day streak</div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td width="48%" style="padding:0 0 0 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="background:#1e2d3d;border-radius:12px;border:1px solid #2d3f50;">
                    <tr>
                      <td align="center" style="padding:16px;">
                        <div style="font-size:32px;font-weight:800;color:#10b981;">${d.tokensUsed.toLocaleString()}</div>
                        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">AI tokens used</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Flashcards block (conditional) -->
        ${flashcardBlock}

        <!-- Quiz block (conditional) -->
        ${quizBlock}

        <!-- Mastery highlight (conditional) -->
        ${masteryBlock}

        <!-- Subjects studied -->
        <tr>
          <td style="padding:0 0 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:#1e2d3d;border-radius:12px;border:1px solid #2d3f50;">
              <tr>
                <td style="padding:20px;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#94a3b8;
                             text-transform:uppercase;letter-spacing:0.05em;">📚 Subjects studied this week</p>
                  <ul style="margin:0;padding-left:20px;">${subjectRows}</ul>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Recent notes -->
        <tr>
          <td style="padding:0 0 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:#1e2d3d;border-radius:12px;border:1px solid #2d3f50;">
              <tr>
                <td style="padding:20px;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#94a3b8;
                             text-transform:uppercase;letter-spacing:0.05em;">📝 Recent notes</p>
                  <ul style="margin:0;padding-left:20px;">${noteRows}</ul>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:0 0 32px;">
            <a href="https://cognibloom.vercel.app/dashboard"
               style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;
                      padding:14px 36px;border-radius:10px;font-weight:700;font-size:16px;">
              Open Dashboard →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center"
              style="padding:16px 0 0;border-top:1px solid #2d3f50;
                     color:#475569;font-size:12px;line-height:1.7;">
            <p style="margin:0;">
              Dedicated to <strong style="color:#6366f1;">Daniel</strong>
              — curiosity is your superpower. Keep blooming. 🌱
            </p>
            <p style="margin:4px 0 0;">© 2026 CogniBloom. Built with love to fuel great minds.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

// ─── Plain-text fallback ──────────────────────────────────────────────────────

function buildSummaryText(d: DailySummaryData): string {
  const lines = [
    `CogniBloom Daily Summary — ${d.date}`,
    `Hi ${d.studentName}! Great work today. Here's your learning snapshot.`,
    '',
    `📊 Stats`,
    `  Notes created:   ${d.notesCreated}`,
    `  AI sessions:     ${d.sessionsCompleted}`,
    `  Day streak:      🔥 ${d.streak}`,
    `  AI tokens used:  ${d.tokensUsed.toLocaleString()}`,
  ]

  if (d.flashcardsReviewed > 0 || d.flashcardsDue > 0) {
    lines.push('', `🃏 Flashcards`)
    lines.push(`  Reviewed (last 24h): ${d.flashcardsReviewed}`)
    lines.push(`  Due now:        ${d.flashcardsDue > 0 ? d.flashcardsDue : '0 (all caught up!)'}`)
  }

  if (d.quizzesTaken > 0) {
    lines.push('', `🏆 Quizzes (last 24h): ${d.quizzesTaken}` +
      (d.avgQuizScore !== null ? ` — avg score ${Math.round(d.avgQuizScore)}%` : ''))
  }

  if (d.masteryHighlight) {
    lines.push('', `⭐ Mastery highlight: ${d.masteryHighlight.subject} at ${Math.round(d.masteryHighlight.score * 100)}%`)
  }

  if (d.topSubjects.length) {
    lines.push('', `📚 Subjects this week: ${d.topSubjects.join(', ')}`)
  }

  if (d.recentNotes.length) {
    lines.push('', `📝 Recent notes:`)
    d.recentNotes.forEach((n) => lines.push(`  • ${n.title}${n.subject ? ` (${n.subject})` : ''}`))
  }

  lines.push('', `Open Dashboard: https://cognibloom.vercel.app/dashboard`, '', '— CogniBloom 🌱')
  return lines.join('\n')
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export async function sendDailySummary(
  recipients: string[],
  data: DailySummaryData,
): Promise<void> {
  if (recipients.length === 0) return

  const transport = createTransport()
  const from = `CogniBloom 🌱 <${process.env['GMAIL_USER']}>`

  await transport.sendMail({
    from,
    to: recipients.join(', '),
    subject: `📚 ${data.studentName}'s Daily Learning Summary — ${data.date}`,
    text: buildSummaryText(data),
    html: buildSummaryHtml(data),
  })
}
