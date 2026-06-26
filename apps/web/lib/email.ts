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
  recentNotes: { title: string; subject?: string }[]
  flashcardsDue: number
  flashcardsReviewed: number
  quizzesTaken: number
  avgQuizScore: number | null
  masteryHighlight: { subject: string; score: number } | null
  // Consistency & plan execution
  habitsDone: number
  habitsTotal: number
  completedHabits: { title: string; time: string | null }[]
  missedHabits: { title: string; time: string | null }[]
  // Daily reflection note (if written in the last 24 h)
  dailyReflection: { title: string; preview: string } | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime12h(t: string | null): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr ?? '0', 10)
  const m = mStr ?? '00'
  const ampm = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${m} ${ampm}`
}


// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildSummaryHtml(d: DailySummaryData): string {
  // ── palette ──
  const bg       = '#0f1623'
  const card     = '#1e2d3d'
  const border   = '#2d3f50'
  const muted    = '#94a3b8'
  const faint    = '#475569'
  const text     = '#e2e8f0'
  const primary  = '#6366f1'
  const green    = '#10b981'
  const amber    = '#f59e0b'
  const red      = '#ef4444'

  // ── consistency greeting ──
  const pct = d.habitsTotal > 0 ? Math.round((d.habitsDone / d.habitsTotal) * 100) : 0
  const consistencyEmoji = pct === 100 ? '🏆' : pct >= 75 ? '🔥' : pct >= 50 ? '💪' : '📈'
  const consistencyMsg =
    pct === 100 ? `Perfect day — every habit checked off!` :
    pct >= 75   ? `Strong day — almost all habits done.` :
    pct >= 50   ? `Good start — keep building the streak.` :
    d.habitsTotal === 0 ? `No habits tracked yet for yesterday.` :
                  `Tomorrow is another shot — keep going.`

  // ── hero stats ──
  const heroStats = `
    <tr>
      <td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="48%" style="padding:0 8px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:${card};border-radius:12px;border:1px solid ${border};">
                <tr>
                  <td align="center" style="padding:20px 12px;">
                    <div style="font-size:34px;font-weight:800;color:${amber};">🔥 ${d.streak}</div>
                    <div style="font-size:12px;color:${muted};margin-top:6px;">Day streak</div>
                  </td>
                </tr>
              </table>
            </td>
            <td width="48%" style="padding:0 0 0 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:${card};border-radius:12px;border:1px solid ${border};">
                <tr>
                  <td align="center" style="padding:20px 12px;">
                    <div style="font-size:34px;font-weight:800;color:${pct===100?green:primary};">
                      ${d.habitsTotal > 0 ? `${d.habitsDone}/${d.habitsTotal}` : '—'}
                    </div>
                    <div style="font-size:12px;color:${muted};margin-top:6px;">Habits completed</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  // ── plan execution ──
  const allHabits = [
    ...d.completedHabits.map(h => ({ ...h, done: true })),
    ...d.missedHabits.map(h => ({ ...h, done: false })),
  ].sort((a, b) => {
    if (a.time && b.time) return a.time < b.time ? -1 : 1
    if (a.time) return -1
    if (b.time) return 1
    return 0
  })

  const habitRows = allHabits.map(h => `
    <tr>
      <td style="padding:7px 0;border-bottom:1px solid #172030;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="22" style="vertical-align:middle;font-size:15px;">
              ${h.done ? '✅' : '⬜'}
            </td>
            <td style="vertical-align:middle;padding-left:6px;">
              <span style="font-size:14px;color:${h.done ? text : faint};">${h.title}</span>
            </td>
            ${h.time ? `
            <td style="vertical-align:middle;text-align:right;white-space:nowrap;padding-left:8px;">
              <span style="font-size:11px;color:${faint};">${fmtTime12h(h.time)}</span>
            </td>` : ''}
          </tr>
        </table>
      </td>
    </tr>`).join('')

  const progressBar = d.habitsTotal > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#0d1a27;border-radius:999px;margin-bottom:14px;">
      <tr>
        <td width="${pct}%" height="8"
            style="background:${pct===100?green:primary};border-radius:999px;font-size:1px;line-height:1px;">&nbsp;</td>
        <td>&nbsp;</td>
      </tr>
    </table>` : ''

  const planBlock = allHabits.length > 0 ? `
    <tr>
      <td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${card};border-radius:12px;border:1px solid ${border};">
          <tr>
            <td style="padding:20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:13px;font-weight:700;color:${muted};
                               text-transform:uppercase;letter-spacing:0.05em;">📋 Yesterday's Plan Execution</p>
                  </td>
                  <td style="text-align:right;white-space:nowrap;">
                    <span style="font-size:13px;font-weight:700;color:${pct===100?green:primary};">
                      ${consistencyEmoji} ${pct}%
                    </span>
                  </td>
                </tr>
              </table>
              ${progressBar}
              <p style="margin:0 0 12px;font-size:13px;color:${muted};font-style:italic;">${consistencyMsg}</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${habitRows}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''

  // ── daily reflection ──
  const reflectionBlock = d.dailyReflection ? `
    <tr>
      <td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${card};border-radius:12px;border:1px solid ${border};">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${muted};
                         text-transform:uppercase;letter-spacing:0.05em;">📖 Daily Reflection</p>
              <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${primary};">
                ${d.dailyReflection.title}
              </p>
              <p style="margin:0;font-size:14px;color:#b0bec5;line-height:1.7;
                         border-left:3px solid ${primary};padding-left:12px;">
                ${d.dailyReflection.preview}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : ''

  // ── subjects + notes ──
  const subjectRows = d.topSubjects.length
    ? d.topSubjects.map(s => `<li style="line-height:1.9;color:${text};">${s}</li>`).join('')
    : `<li style="line-height:1.9;color:${muted};">General learning</li>`

  const noteRows = d.recentNotes.length
    ? d.recentNotes.map(n => `
        <li style="line-height:1.9;color:${text};">
          <strong>${n.title}</strong>
          ${n.subject ? `<span style="color:${primary};"> (${n.subject})</span>` : ''}
        </li>`).join('')
    : `<li style="line-height:1.9;color:${muted};">No new notes today</li>`

  const subjectsBlock = `
    <tr>
      <td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${card};border-radius:12px;border:1px solid ${border};">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${muted};
                         text-transform:uppercase;letter-spacing:0.05em;">📚 Subjects studied this week</p>
              <ul style="margin:0;padding-left:20px;">${subjectRows}</ul>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  const notesBlock = `
    <tr>
      <td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${card};border-radius:12px;border:1px solid ${border};">
          <tr>
            <td style="padding:20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:13px;font-weight:700;color:${muted};
                               text-transform:uppercase;letter-spacing:0.05em;">📝 Notes created</p>
                  </td>
                  <td style="text-align:right;">
                    <span style="font-size:22px;font-weight:800;color:${primary};">${d.notesCreated}</span>
                    <span style="font-size:11px;color:${muted};"> today</span>
                  </td>
                </tr>
              </table>
              <ul style="margin:0;padding-left:20px;">${noteRows}</ul>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  // ── flashcards ──
  const flashcardBlock = (d.flashcardsReviewed > 0 || d.flashcardsDue > 0)
    ? `<tr>
        <td style="padding:0 0 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:${card};border-radius:12px;border:1px solid ${border};">
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:${muted};
                           text-transform:uppercase;letter-spacing:0.05em;">🃏 Flashcards</p>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="text-align:center;padding:0 8px 0 0;">
                      <div style="font-size:28px;font-weight:800;color:${amber};">${d.flashcardsReviewed}</div>
                      <div style="font-size:12px;color:${muted};margin-top:4px;">Reviewed (last 24h)</div>
                    </td>
                    <td style="text-align:center;padding:0 0 0 8px;border-left:1px solid ${border};">
                      <div style="font-size:28px;font-weight:800;color:${d.flashcardsDue>0?red:green};">
                        ${d.flashcardsDue > 0 ? d.flashcardsDue : '✓'}
                      </div>
                      <div style="font-size:12px;color:${muted};margin-top:4px;">
                        ${d.flashcardsDue > 0 ? 'Due now' : 'All caught up'}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>` : ''

  // ── quiz ──
  const quizBlock = d.quizzesTaken > 0
    ? `<tr>
        <td style="padding:0 0 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:${card};border-radius:12px;border:1px solid ${border};">
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${muted};
                           text-transform:uppercase;letter-spacing:0.05em;">🏆 Quizzes (last 24h)</p>
                <p style="margin:0;font-size:15px;color:${text};">
                  <strong style="color:${primary};">${d.quizzesTaken}</strong> quiz${d.quizzesTaken!==1?'zes':''}
                  ${d.avgQuizScore!==null?`— avg score <strong style="color:${green};">${Math.round(d.avgQuizScore)}%</strong>`:''}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>` : ''

  // ── mastery highlight ──
  const masteryBlock = d.masteryHighlight
    ? `<tr>
        <td style="padding:0 0 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:${card};border-radius:12px;border:1px solid ${border};">
            <tr>
              <td style="padding:20px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${muted};
                           text-transform:uppercase;letter-spacing:0.05em;">⭐ Mastery highlight</p>
                <p style="margin:0;font-size:15px;color:${text};">
                  <strong style="color:${primary};">${d.masteryHighlight.subject}</strong>
                  — currently at <strong style="color:${green};">${Math.round(d.masteryHighlight.score*100)}%</strong>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>CogniBloom Daily Summary</title>
</head>
<body style="margin:0;padding:0;background:${bg};">
<table width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;color:${text};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td align="center" style="padding:0 0 28px;">
            <div style="font-size:38px;margin-bottom:8px;">🌱</div>
            <h1 style="margin:0;font-size:24px;font-weight:800;color:${primary};">
              CogniBloom Daily Summary
            </h1>
            <p style="margin:6px 0 0;color:${muted};font-size:14px;">${d.date}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:0 0 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:${card};border-radius:12px;border:1px solid ${border};">
              <tr>
                <td style="padding:18px 20px;font-size:15px;line-height:1.6;color:${text};">
                  Here's <strong style="color:${primary};">${d.studentName}</strong>'s daily snapshot.
                  ${d.streak > 0 ? `<span style="color:${amber};">🔥 ${d.streak}-day streak — keep it going!</span>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero: streak + habits -->
        ${heroStats}

        <!-- Plan execution -->
        ${planBlock}

        <!-- Daily reflection -->
        ${reflectionBlock}

        <!-- Subjects studied -->
        ${subjectsBlock}

        <!-- Notes created -->
        ${notesBlock}

        <!-- Flashcards -->
        ${flashcardBlock}

        <!-- Quiz -->
        ${quizBlock}

        <!-- Mastery highlight -->
        ${masteryBlock}

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:8px 0 32px;">
            <a href="https://cognibloom.vercel.app/dashboard"
               style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;
                      padding:14px 36px;border-radius:10px;font-weight:700;font-size:16px;">
              Open Dashboard →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center"
              style="padding:16px 0 0;border-top:1px solid ${border};color:${faint};font-size:12px;line-height:1.7;">
            <p style="margin:0;">
              Dedicated to <strong style="color:${primary};">Daniel</strong>
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
  const pct = d.habitsTotal > 0 ? Math.round((d.habitsDone / d.habitsTotal) * 100) : 0

  const lines = [
    `CogniBloom Daily Summary — ${d.date}`,
    `Hi ${d.studentName}! Here's your daily snapshot.`,
    '',
    `🔥 Streak: ${d.streak} day${d.streak !== 1 ? 's' : ''}`,
  ]

  // Habits
  if (d.habitsTotal > 0) {
    lines.push('', `📋 Yesterday's Plan Execution — ${d.habitsDone}/${d.habitsTotal} habits (${pct}%)`)
    const allHabits = [
      ...d.completedHabits.map(h => ({ ...h, done: true })),
      ...d.missedHabits.map(h => ({ ...h, done: false })),
    ].sort((a, b) => {
      if (a.time && b.time) return a.time < b.time ? -1 : 1
      if (a.time) return -1
      if (b.time) return 1
      return 0
    })
    allHabits.forEach(h => {
      const time = h.time ? ` · ${fmtTime12h(h.time)}` : ''
      lines.push(`  ${h.done ? '✅' : '⬜'} ${h.title}${time}`)
    })
  }

  // Daily reflection
  if (d.dailyReflection) {
    lines.push('', `📖 Daily Reflection`, `  ${d.dailyReflection.title}`, `  "${d.dailyReflection.preview}"`)
  }

  // Subjects + notes
  if (d.topSubjects.length) {
    lines.push('', `📚 Subjects this week: ${d.topSubjects.join(', ')}`)
  }
  lines.push('', `📝 Notes created today: ${d.notesCreated}`)
  if (d.recentNotes.length) {
    d.recentNotes.forEach(n => lines.push(`  • ${n.title}${n.subject ? ` (${n.subject})` : ''}`))
  }

  // Flashcards
  if (d.flashcardsReviewed > 0 || d.flashcardsDue > 0) {
    lines.push('', `🃏 Flashcards — ${d.flashcardsReviewed} reviewed · ${d.flashcardsDue} due`)
  }

  // Quiz
  if (d.quizzesTaken > 0) {
    lines.push('', `🏆 Quizzes: ${d.quizzesTaken}` +
      (d.avgQuizScore !== null ? ` — avg score ${Math.round(d.avgQuizScore)}%` : ''))
  }

  // Mastery
  if (d.masteryHighlight) {
    lines.push('', `⭐ Mastery highlight: ${d.masteryHighlight.subject} at ${Math.round(d.masteryHighlight.score * 100)}%`)
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
    subject: `📚 ${data.studentName}'s Daily Summary — ${data.date}`,
    text: buildSummaryText(data),
    html: buildSummaryHtml(data),
  })
}
