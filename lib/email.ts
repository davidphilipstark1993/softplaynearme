const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = 'Soft Play Near Me <hello@softplaynearme.co.uk>'
const BASE_URL = 'https://www.softplaynearme.co.uk'

export interface WelcomeEmailOptions {
  to: string
  ownerName: string
  venueName: string
  accessToken: string
  citySlug?: string
  venueSlug?: string
}

export async function sendWelcomeEmail(opts: WelcomeEmailOptions): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log('[email] No RESEND_API_KEY set — skipping welcome email')
    return
  }

  const dashboardUrl = `${BASE_URL}/dashboard/${opts.accessToken}`
  const venueUrl =
    opts.citySlug && opts.venueSlug
      ? `${BASE_URL}/soft-play/${opts.citySlug}/${opts.venueSlug}`
      : null

  const checklist = [
    { emoji: '📸', text: 'Upload 3+ photos of your venue', value: '+10%' },
    { emoji: '🕐', text: 'Set your opening hours', value: '+15%' },
    { emoji: '💷', text: 'Add your prices and session types', value: '+15%' },
    { emoji: '✅', text: 'Select your facilities (café, parking, SEN, parties…)', value: '+20%' },
    { emoji: '📝', text: 'Write a description of your venue', value: '+15%' },
  ]

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:580px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#9333ea 0%,#ec4899 100%);border-radius:16px;padding:36px 32px;text-align:center;margin-bottom:28px">
    <div style="font-size:40px;margin-bottom:12px">🎉</div>
    <h1 style="color:#fff;margin:0 0 10px;font-size:22px;font-weight:700;line-height:1.3">Welcome to Soft Play Near Me!</h1>
    <p style="color:rgba(255,255,255,0.85);margin:0;font-size:15px">Hi ${opts.ownerName} — we&apos;ve received your claim for <strong>${opts.venueName}</strong>. We&apos;ll be in touch within 2 working days.</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:28px 24px;border:1px solid #e2e8f0;margin-bottom:20px">
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569">While you wait, your venue dashboard is already ready. Add your details now so your listing is complete the moment it goes live.</p>
    <a href="${dashboardUrl}" style="display:block;background:#9333ea;color:#fff;text-decoration:none;padding:15px 28px;border-radius:9px;font-weight:600;font-size:15px;text-align:center">Open Your Dashboard →</a>
  </div>

  <div style="background:#fff;border-radius:12px;padding:28px 24px;border:1px solid #e2e8f0;margin-bottom:20px">
    <h2 style="margin:0 0 6px;font-size:17px;font-weight:700">Your listing checklist</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#64748b">Complete these steps to rank higher and get more visits from parents:</p>
    ${checklist
      .map(
        (item) => `
    <div style="display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:22px;flex-shrink:0">${item.emoji}</span>
      <span style="flex:1;font-size:14px;color:#374151">${item.text}</span>
      <span style="font-size:12px;font-weight:600;color:#7c3aed;background:#faf5ff;padding:3px 8px;border-radius:20px;white-space:nowrap">${item.value}</span>
    </div>`
      )
      .join('')}
  </div>

  ${
    venueUrl
      ? `<div style="background:#faf5ff;border-radius:10px;padding:18px 20px;border:1px solid #e9d5ff;margin-bottom:20px">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#7c3aed;text-transform:uppercase;letter-spacing:0.05em">Your current listing</p>
    <a href="${venueUrl}" style="color:#6d28d9;font-size:13px;word-break:break-all">${venueUrl}</a>
  </div>`
      : ''
  }

  <div style="text-align:center;padding:16px 0">
    <p style="font-size:13px;color:#94a3b8;margin:0">Questions? Reply to this email — we&apos;re happy to help.</p>
    <p style="font-size:12px;color:#cbd5e1;margin:8px 0 0">Soft Play Near Me · UK's Largest Soft Play Directory</p>
  </div>

</div>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: opts.to,
        subject: `🎉 Your ${opts.venueName} listing is ready — here's what to do next`,
        html,
      }),
    })
    if (!res.ok) {
      console.error('[email] Resend error:', await res.text())
    }
  } catch (err) {
    console.error('[email] Failed to send welcome email:', err)
  }
}
