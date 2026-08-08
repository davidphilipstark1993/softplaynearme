const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = 'Soft Play Near Me <hello@softplaynearme.co.uk>'
const BASE_URL = 'https://www.softplaynearme.co.uk'

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log('[email] No RESEND_API_KEY set — skipping email to', to)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    if (!res.ok) console.error('[email] Resend error:', await res.text())
  } catch (err) {
    console.error('[email] Failed to send email:', err)
  }
}

// ─── Welcome email ────────────────────────────────────────────────────────────

export interface WelcomeEmailOptions {
  to: string
  ownerName: string
  venueName: string
  accessToken: string
  citySlug?: string
  venueSlug?: string
}

export async function sendWelcomeEmail(opts: WelcomeEmailOptions): Promise<void> {
  const dashboardUrl = `${BASE_URL}/dashboard/${opts.accessToken}`
  const venueUrl =
    opts.citySlug && opts.venueSlug
      ? `${BASE_URL}/soft-play/${opts.citySlug}/${opts.venueSlug}`
      : null

  const checklist = [
    { emoji: '📸', text: 'Upload 3+ photos of your venue', value: '+20%' },
    { emoji: '🕐', text: 'Set your opening hours', value: '+20%' },
    { emoji: '💷', text: 'Add your prices and session types', value: '+15%' },
    { emoji: '✅', text: 'Select your facilities (café, parking, SEN, parties…)', value: '+15%' },
    { emoji: '📝', text: 'Write a description of your venue', value: '+10%' },
  ]

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:580px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#9333ea 0%,#ec4899 100%);border-radius:16px;padding:36px 32px;text-align:center;margin-bottom:28px">
    <div style="font-size:40px;margin-bottom:12px">&#x1F389;</div>
    <h1 style="color:#fff;margin:0 0 10px;font-size:22px;font-weight:700;line-height:1.3">Welcome to Soft Play Near Me!</h1>
    <p style="color:rgba(255,255,255,0.85);margin:0;font-size:15px">Hi ${opts.ownerName} &#8212; we&#x27;ve received your claim for <strong>${opts.venueName}</strong>. We&#x27;ll be in touch within 2 working days.</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:28px 24px;border:1px solid #e2e8f0;margin-bottom:20px">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569">While you wait, your venue dashboard is already ready. Add your details now so your listing is complete the moment it goes live.</p>
    <div style="background:linear-gradient(135deg,#faf5ff,#fdf2f8);border-radius:8px;padding:14px 18px;border:1px solid #e9d5ff;margin-bottom:20px;text-align:center">
      <p style="margin:0;font-size:13px;color:#6d28d9;font-weight:600">&#x1F49C; &#x201C;Venue owners who complete their profile get up to 3&#xD7; more views from local parents.&#x201D;</p>
    </div>
    <a href="${dashboardUrl}" style="display:block;background:#9333ea;color:#fff;text-decoration:none;padding:15px 28px;border-radius:9px;font-weight:600;font-size:15px;text-align:center">Open Your Dashboard &#x2192;</a>
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
    <p style="font-size:13px;color:#94a3b8;margin:0">Questions? Reply to this email &#8212; we&#x27;re happy to help.</p>
    <p style="font-size:12px;color:#cbd5e1;margin:8px 0 0">Soft Play Near Me &#xB7; UK&#x27;s Largest Soft Play Directory</p>
  </div>

</div>
</body>
</html>`

  await sendEmail(
    opts.to,
    `&#x1F389; Your ${opts.venueName} listing is ready &#8212; here&#x27;s what to do next`,
    html
  )
}

// ─── Admin notification email ─────────────────────────────────────────────────

export interface AdminClaimNotificationOptions {
  claimantName: string
  claimantEmail: string
  venueName: string
  venueAddress?: string
  venuePhone?: string
  venueWebsite?: string
  citySlug?: string
  venueSlug?: string
  claimId?: number
}

export async function sendAdminClaimNotification(opts: AdminClaimNotificationOptions): Promise<void> {
  const adminUrl = `${BASE_URL}/admin/claims`
  const venueUrl =
    opts.citySlug && opts.venueSlug
      ? `${BASE_URL}/soft-play/${opts.citySlug}/${opts.venueSlug}`
      : null

  const rows = [
    ['Claimant', `${opts.claimantName} &lt;${opts.claimantEmail}&gt;`],
    ['Venue', opts.venueName],
    ...(opts.venueAddress ? [['Address', opts.venueAddress]] : []),
    ...(opts.venuePhone ? [['Phone', opts.venuePhone]] : []),
    ...(opts.venueWebsite ? [['Website', opts.venueWebsite]] : []),
    ...(venueUrl ? [['Listing', `<a href="${venueUrl}" style="color:#7c3aed">${venueUrl}</a>`]] : []),
  ] as [string, string][]

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px;padding:28px 28px;text-align:center;margin-bottom:20px">
    <div style="font-size:32px;margin-bottom:10px">&#x1F4CB;</div>
    <h1 style="color:#fff;margin:0 0 6px;font-size:18px;font-weight:700">New Venue Claim</h1>
    <p style="color:rgba(255,255,255,0.7);margin:0;font-size:13px">Someone just claimed a venue on Soft Play Near Me</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px">
    ${rows.map(([label, value]) => `
    <div style="display:flex;gap:16px;padding:10px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:13px;color:#64748b;font-weight:500;width:80px;flex-shrink:0">${label}</span>
      <span style="font-size:13px;color:#1e293b;flex:1">${value}</span>
    </div>`).join('')}
  </div>

  <a href="${adminUrl}" style="display:block;background:#0f172a;color:#fff;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:600;font-size:14px;text-align:center;margin-bottom:16px">
    Review in Admin &#x2192;
  </a>

  <p style="font-size:11px;color:#cbd5e1;text-align:center;margin:0">Soft Play Near Me &#xB7; admin notification</p>
</div>
</body>
</html>`

  await sendEmail(
    'hello@softplaynearme.co.uk',
    `New claim: ${opts.venueName} from ${opts.claimantName}`,
    html
  )
}

// ─── Contact form notification ─────────────────────────────────────────────────

export interface ContactFormNotificationOptions {
  name: string
  email: string
  phone?: string
  topic: string
  message: string
}

export async function sendContactFormNotification(opts: ContactFormNotificationOptions): Promise<void> {
  const rows = [
    ['From', `${opts.name} &lt;${opts.email}&gt;`],
    ...(opts.phone ? [['Phone', opts.phone]] : []),
    ['Topic', opts.topic],
  ] as [string, string][]

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#9333ea 0%,#ec4899 100%);border-radius:16px;padding:28px 28px;text-align:center;margin-bottom:20px">
    <div style="font-size:32px;margin-bottom:10px">&#x1F4E9;</div>
    <h1 style="color:#fff;margin:0 0 6px;font-size:18px;font-weight:700">New Contact Form Message</h1>
    <p style="color:rgba(255,255,255,0.7);margin:0;font-size:13px">Someone just submitted the contact form on Soft Play Near Me</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px">
    ${rows.map(([label, value]) => `
    <div style="display:flex;gap:16px;padding:10px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:13px;color:#64748b;font-weight:500;width:80px;flex-shrink:0">${label}</span>
      <span style="font-size:13px;color:#1e293b;flex:1">${value}</span>
    </div>`).join('')}
    <div style="padding-top:16px">
      <span style="font-size:13px;color:#64748b;font-weight:500">Message</span>
      <p style="font-size:14px;color:#1e293b;white-space:pre-wrap;margin:8px 0 0;line-height:1.6">${opts.message.replace(/</g, '&lt;')}</p>
    </div>
  </div>

  <a href="mailto:${opts.email}" style="display:block;background:#0f172a;color:#fff;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:600;font-size:14px;text-align:center;margin-bottom:16px">
    Reply to ${opts.name.split(' ')[0]} &#x2192;
  </a>

  <p style="font-size:11px;color:#cbd5e1;text-align:center;margin:0">Soft Play Near Me &#xB7; contact form notification</p>
</div>
</body>
</html>`

  await sendEmail('hello@softplaynearme.co.uk', `Contact form: ${opts.topic} — ${opts.name}`, html)
}

// ─── Verification email ───────────────────────────────────────────────────────

export interface VerificationEmailOptions {
  to: string
  ownerName: string
  venueName: string
  verificationToken: string
  accessToken: string
}

export async function sendVerificationEmail(opts: VerificationEmailOptions): Promise<void> {
  const verifyUrl = `${BASE_URL}/api/verify-email?token=${opts.verificationToken}`
  const dashboardUrl = `${BASE_URL}/dashboard/${opts.accessToken}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#9333ea 0%,#ec4899 100%);border-radius:16px;padding:36px 32px;text-align:center;margin-bottom:24px">
    <div style="font-size:36px;margin-bottom:12px">&#x2709;&#xFE0F;</div>
    <h1 style="color:#fff;margin:0 0 8px;font-size:20px;font-weight:700">Verify your email address</h1>
    <p style="color:rgba(255,255,255,0.85);margin:0;font-size:14px">Hi ${opts.ownerName} &#8212; one quick step to confirm ownership of <strong>${opts.venueName}</strong></p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:28px 24px;border:1px solid #e2e8f0;margin-bottom:16px;text-align:center">
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569">Click the button below to verify your email and confirm you&#x27;re the owner. This link expires in 48 hours.</p>
    <a href="${verifyUrl}" style="display:inline-block;background:#9333ea;color:#fff;text-decoration:none;padding:15px 36px;border-radius:9px;font-weight:600;font-size:15px">Verify My Email &#x2192;</a>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">Or copy this link into your browser:<br><span style="color:#6d28d9;word-break:break-all;font-size:11px">${verifyUrl}</span></p>
  </div>

  <div style="background:#faf5ff;border-radius:10px;padding:16px 20px;border:1px solid #e9d5ff;margin-bottom:16px">
    <p style="margin:0;font-size:13px;color:#475569">After verifying, you can <a href="${dashboardUrl}" style="color:#7c3aed">open your dashboard</a> and start completing your listing.</p>
  </div>

  <div style="text-align:center;padding:12px 0">
    <p style="font-size:12px;color:#94a3b8;margin:0">If you didn&#x27;t submit a claim on Soft Play Near Me, you can ignore this email.</p>
    <p style="font-size:11px;color:#cbd5e1;margin:6px 0 0">Soft Play Near Me &#xB7; hello@softplaynearme.co.uk</p>
  </div>

</div>
</body>
</html>`

  await sendEmail(opts.to, `Verify your email for ${opts.venueName} on Soft Play Near Me`, html)
}
