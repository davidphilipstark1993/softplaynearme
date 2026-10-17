const RESEND_API_KEY = process.env.RESEND_API_KEY
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const FROM_NAME = 'Soft Play Near Me'
const FROM_EMAIL = 'hello@softplaynearme.co.uk'
const FROM = `${FROM_NAME} <${FROM_EMAIL}>`
// SendGrid only has david@ as a confirmed single-sender (not full domain auth) — sending from
// any other @softplaynearme.co.uk address there can be silently dropped despite a 202 response.
const SENDGRID_VERIFIED_SENDER = 'david@softplaynearme.co.uk'
const BASE_URL = 'https://www.softplaynearme.co.uk'

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    if (!res.ok) {
      console.error('[email] Resend error:', await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[email] Resend request failed:', err)
    return false
  }
}

async function sendViaSendGrid(to: string, subject: string, html: string): Promise<boolean> {
  if (!SENDGRID_API_KEY) return false
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: SENDGRID_VERIFIED_SENDER, name: FROM_NAME },
        reply_to: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    })
    if (!res.ok) {
      console.error('[email] SendGrid error:', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[email] SendGrid request failed:', err)
    return false
  }
}

// Tries Resend first (the intended primary provider, using the full hello@ domain sender).
// Falls back to SendGrid automatically if Resend is unconfigured or fails — e.g. while the
// softplaynearme.co.uk sending domain isn't yet verified in Resend. Once that domain verifies,
// Resend succeeds on the first attempt and SendGrid is never called.
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY && !SENDGRID_API_KEY) {
    console.log('[email] No email provider configured — skipping email to', to)
    return
  }
  if (await sendViaResend(to, subject, html)) return
  if (await sendViaSendGrid(to, subject, html)) return
  console.error(`[email] FAILED to send "${subject}" to ${to} via both Resend and SendGrid`)
}

// Like sendEmail, but reports whether a provider actually accepted the message. Used where the
// caller has to tell the visitor the truth about delivery (e.g. the newsletter confirmation).
async function sendEmailChecked(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY && !SENDGRID_API_KEY) return false
  if (await sendViaResend(to, subject, html)) return true
  return sendViaSendGrid(to, subject, html)
}

// ─── Newsletter double opt-in ─────────────────────────────────────────────────

export interface NewsletterConfirmationOptions {
  to: string
  confirmationToken: string
  weekly: boolean
  events: boolean
}

/** Returns false if no provider accepted the email, so the subscribe route can surface the failure. */
export async function sendNewsletterConfirmationEmail(opts: NewsletterConfirmationOptions): Promise<boolean> {
  const confirmUrl = `${BASE_URL}/newsletter/confirm?token=${opts.confirmationToken}`
  const lists = [
    opts.weekly ? 'the weekly soft play newsletter' : null,
    opts.events ? 'family events &amp; offers' : null,
  ].filter(Boolean).join(' and ')

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">
  <div style="background:#fff;border-radius:12px;padding:28px 24px;border:1px solid #e2e8f0;text-align:center">
    <h1 style="margin:0 0 12px;font-size:20px;color:#1e293b">Please confirm your subscription</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569">You asked to receive ${lists} from Soft Play Near Me. Click the button to confirm &#8212; you won&#x27;t get any emails until you do. This link expires in 7 days.</p>
    <a href="${confirmUrl}" style="display:inline-block;background:#9333ea;color:#fff;text-decoration:none;padding:15px 36px;border-radius:9px;font-weight:600;font-size:15px">Confirm my subscription</a>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">Or copy this link into your browser:<br><span style="color:#6d28d9;word-break:break-all;font-size:11px">${confirmUrl}</span></p>
  </div>
  <p style="font-size:12px;color:#94a3b8;text-align:center;margin:16px 0 0">If you didn&#x27;t sign up, just ignore this email and nothing will happen.</p>
  <p style="font-size:11px;color:#cbd5e1;text-align:center;margin:6px 0 0">Soft Play Near Me &#xB7; hello@softplaynearme.co.uk</p>
</div>
</body>
</html>`

  return sendEmailChecked(opts.to, 'Confirm your Soft Play Near Me subscription', html)
}

// ─── Admin operational notification (plain text) ──────────────────────────────
// Used by cron/background jobs (e.g. the weekly newsletter send) to tell the
// site owner what happened — sent or skipped and why, or failed — without
// requiring anyone to go dig through logs.

export async function sendAdminOperationalNotification(subject: string, text: string): Promise<void> {
  const html = `<pre style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;white-space:pre-wrap;font-size:14px;color:#1e293b">${text.replace(/</g, '&lt;')}</pre>`
  await sendEmail('david@softplaynearme.co.uk', subject, html)
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
  planInterest?: 'free' | 'premium' | 'bespoke'
  message?: string
}

export async function sendAdminClaimNotification(opts: AdminClaimNotificationOptions): Promise<void> {
  const adminUrl = `${BASE_URL}/admin/claims`
  const venueUrl =
    opts.citySlug && opts.venueSlug
      ? `${BASE_URL}/soft-play/${opts.citySlug}/${opts.venueSlug}`
      : null
  const isBespoke = opts.planInterest === 'bespoke'
  const isPremium = opts.planInterest === 'premium'

  const rows = [
    ['Claimant', `${opts.claimantName} &lt;${opts.claimantEmail}&gt;`],
    ['Venue', opts.venueName],
    ...(isBespoke ? [['Plan interest', 'Bespoke']] : []),
    ...(isPremium ? [['Plan interest', 'Premium — Direct Debit in progress']] : []),
    ...(opts.venueAddress ? [['Address', opts.venueAddress]] : []),
    ...(opts.venuePhone ? [['Phone', opts.venuePhone]] : []),
    ...(opts.venueWebsite ? [['Website', opts.venueWebsite]] : []),
    ...(venueUrl ? [['Listing', `<a href="${venueUrl}" style="color:#7c3aed">${venueUrl}</a>`]] : []),
    ...(opts.message ? [['Details', opts.message.replace(/\n/g, '<br>')]] : []),
  ] as [string, string][]

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px;padding:28px 28px;text-align:center;margin-bottom:20px">
    <div style="font-size:32px;margin-bottom:10px">${isBespoke ? '&#x1F4B0;' : isPremium ? '&#x2728;' : '&#x1F4CB;'}</div>
    <h1 style="color:#fff;margin:0 0 6px;font-size:18px;font-weight:700">${isBespoke ? 'New Bespoke Enquiry' : isPremium ? 'Premium Sign-up Started' : 'New Venue Claim'}</h1>
    <p style="color:rgba(255,255,255,0.7);margin:0;font-size:13px">${isBespoke ? 'Someone wants a Bespoke plan quote' : isPremium ? 'Someone started Direct Debit set-up for Premium' : 'Someone just claimed a venue on Soft Play Near Me'}</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px">
    ${rows.map(([label, value]) => `
    <div style="display:flex;gap:16px;padding:10px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:13px;color:#64748b;font-weight:500;width:90px;flex-shrink:0">${label}</span>
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
    'david@softplaynearme.co.uk',
    `${isBespoke ? 'Bespoke enquiry' : isPremium ? 'Premium sign-up started' : 'New claim'}: ${opts.venueName} from ${opts.claimantName}`,
    html
  )
}

// ─── Premium subscription activated ────────────────────────────────────────────

export interface PremiumActivatedEmailOptions {
  to: string
  ownerName: string
  venueName: string
  dashboardUrl: string
  billingInterval?: 'month' | 'year'
}

export async function sendPremiumActivatedEmail(opts: PremiumActivatedEmailOptions): Promise<void> {
  const priceLine = opts.billingInterval === 'year' ? '&pound;249/year' : '&pound;24.99/month'
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);border-radius:16px;padding:28px 28px;text-align:center;margin-bottom:20px">
    <div style="font-size:32px;margin-bottom:10px">&#x2728;</div>
    <h1 style="color:#fff;margin:0 0 6px;font-size:18px;font-weight:700">You&#x27;re on Premium!</h1>
    <p style="color:rgba(255,255,255,0.85);margin:0;font-size:13px">Your Direct Debit is set up and ${opts.venueName} is now a Verified venue</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px">
    <p style="font-size:14px;color:#334155;margin:0 0 12px">Hi ${opts.ownerName},</p>
    <p style="font-size:14px;color:#334155;margin:0 0 12px">Your Premium subscription for <strong>${opts.venueName}</strong> is now active — ${priceLine} by Direct Debit. You&#x27;ll see the Verified badge, featured placement, and lead notifications live on your listing already.</p>
    <p style="font-size:14px;color:#334155;margin:0">You&#x27;re covered by the Direct Debit Guarantee, and you can cancel any time from your dashboard.</p>
  </div>

  <a href="${opts.dashboardUrl}" style="display:block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:600;font-size:14px;text-align:center;margin-bottom:16px">
    Open My Dashboard &#x2192;
  </a>

  <p style="font-size:11px;color:#cbd5e1;text-align:center;margin:0">Soft Play Near Me &#xB7; Premium confirmation</p>
</div>
</body>
</html>`

  await sendEmail(opts.to, `Your ${opts.venueName} Premium subscription is active`, html)
}

// ─── Lead notification (Premium/Bespoke venues only) ──────────────────────────

export interface LeadNotificationOptions {
  to: string
  venueName: string
  enquirerName: string
  enquirerEmail: string
  enquirerPhone?: string
  message: string
  dashboardUrl?: string
}

export async function sendLeadNotificationEmail(opts: LeadNotificationOptions): Promise<void> {
  const rows = [
    ['From', `${opts.enquirerName} &lt;${opts.enquirerEmail}&gt;`],
    ...(opts.enquirerPhone ? [['Phone', opts.enquirerPhone]] : []),
  ] as [string, string][]

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#9333ea 0%,#ec4899 100%);border-radius:16px;padding:28px 28px;text-align:center;margin-bottom:20px">
    <div style="font-size:32px;margin-bottom:10px">&#x1F4E9;</div>
    <h1 style="color:#fff;margin:0 0 6px;font-size:18px;font-weight:700">New Enquiry for ${opts.venueName}</h1>
    <p style="color:rgba(255,255,255,0.7);margin:0;font-size:13px">A parent just messaged you through Soft Play Near Me</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px">
    ${rows.map(([label, value]) => `
    <div style="display:flex;gap:16px;padding:10px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:13px;color:#64748b;font-weight:500;width:60px;flex-shrink:0">${label}</span>
      <span style="font-size:13px;color:#1e293b;flex:1">${value}</span>
    </div>`).join('')}
    <div style="padding-top:16px">
      <span style="font-size:13px;color:#64748b;font-weight:500">Message</span>
      <p style="font-size:14px;color:#1e293b;white-space:pre-wrap;margin:8px 0 0;line-height:1.6">${opts.message.replace(/</g, '&lt;')}</p>
    </div>
  </div>

  <a href="mailto:${opts.enquirerEmail}" style="display:block;background:#9333ea;color:#fff;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:600;font-size:14px;text-align:center;margin-bottom:16px">
    Reply to ${opts.enquirerName.split(' ')[0]} &#x2192;
  </a>

  <p style="font-size:11px;color:#cbd5e1;text-align:center;margin:0">You&#x27;re receiving this because ${opts.venueName} is on a Premium or Bespoke plan &#xB7; Soft Play Near Me</p>
</div>
</body>
</html>`

  await sendEmail(opts.to, `New enquiry for ${opts.venueName} — ${opts.enquirerName}`, html)
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

// ─── Upgrade request notification ─────────────────────────────────────────────

export interface UpgradeRequestNotificationOptions {
  venueName: string
  ownerName: string
  ownerEmail: string
  requestedPlan: 'premium' | 'bespoke'
  dashboardUrl: string
}

export async function sendUpgradeRequestNotification(opts: UpgradeRequestNotificationOptions): Promise<void> {
  const rows = [
    ['Venue', opts.venueName],
    ['Owner', `${opts.ownerName} &lt;${opts.ownerEmail}&gt;`],
    ['Plan requested', opts.requestedPlan === 'bespoke' ? 'Bespoke' : 'Premium'],
    ['Dashboard', `<a href="${opts.dashboardUrl}" style="color:#7c3aed">${opts.dashboardUrl}</a>`],
  ] as [string, string][]

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);border-radius:16px;padding:28px 28px;text-align:center;margin-bottom:20px">
    <div style="font-size:32px;margin-bottom:10px">&#x1F4B3;</div>
    <h1 style="color:#fff;margin:0 0 6px;font-size:18px;font-weight:700">Upgrade Request</h1>
    <p style="color:rgba(255,255,255,0.7);margin:0;font-size:13px">A venue owner wants to go ${opts.requestedPlan === 'bespoke' ? 'Bespoke' : 'Premium'}</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px">
    ${rows.map(([label, value]) => `
    <div style="display:flex;gap:16px;padding:10px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:13px;color:#64748b;font-weight:500;width:110px;flex-shrink:0">${label}</span>
      <span style="font-size:13px;color:#1e293b;flex:1">${value}</span>
    </div>`).join('')}
  </div>

  <a href="https://www.softplaynearme.co.uk/admin/venues" style="display:block;background:#0f172a;color:#fff;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:600;font-size:14px;text-align:center;margin-bottom:16px">
    Set plan in Admin &#x2192;
  </a>

  <p style="font-size:11px;color:#cbd5e1;text-align:center;margin:0">Soft Play Near Me &#xB7; upgrade request notification</p>
</div>
</body>
</html>`

  await sendEmail(
    'david@softplaynearme.co.uk',
    `Upgrade request: ${opts.venueName} wants ${opts.requestedPlan === 'bespoke' ? 'Bespoke' : 'Premium'}`,
    html
  )
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

// ─── Monthly insights (Premium/Bespoke only) ───────────────────────────────────

export interface MonthlyInsightsEmailOptions {
  to: string
  ownerName: string
  venueName: string
  dashboardUrl: string
  views: number
  clicks: number
  leads: number
  viewsPrev: number
  clicksPrev: number
  leadsPrev: number
}

function trendText(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? 'new this month' : ''
  const change = Math.round(((current - previous) / previous) * 100)
  if (change === 0) return 'flat vs last month'
  return `${change > 0 ? '+' : ''}${change}% vs last month`
}

export async function sendMonthlyInsightsEmail(opts: MonthlyInsightsEmailOptions): Promise<void> {
  const rows = [
    ['Page views', opts.views, trendText(opts.views, opts.viewsPrev)],
    ['Call / directions / website clicks', opts.clicks, trendText(opts.clicks, opts.clicksPrev)],
    ['Enquiries', opts.leads, trendText(opts.leads, opts.leadsPrev)],
  ] as [string, number, string][]

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);border-radius:16px;padding:28px 28px;text-align:center;margin-bottom:20px">
    <div style="font-size:32px;margin-bottom:10px">&#x1F4CA;</div>
    <h1 style="color:#fff;margin:0 0 6px;font-size:18px;font-weight:700">Your monthly insights</h1>
    <p style="color:rgba(255,255,255,0.85);margin:0;font-size:13px">${opts.venueName} — last 30 days</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px">
    <p style="font-size:14px;color:#334155;margin:0 0 16px">Hi ${opts.ownerName}, here&#x27;s how your listing did:</p>
    ${rows.map(([label, value, trend]) => `
    <div style="display:flex;align-items:baseline;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9">
      <span style="font-size:13px;color:#64748b">${label}</span>
      <span style="text-align:right">
        <span style="font-size:18px;font-weight:700;color:#1e293b">${value}</span>
        ${trend ? `<span style="font-size:11px;color:#94a3b8;margin-left:6px">${trend}</span>` : ''}
      </span>
    </div>`).join('')}
  </div>

  <a href="${opts.dashboardUrl}" style="display:block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:600;font-size:14px;text-align:center;margin-bottom:16px">
    View Full Dashboard &#x2192;
  </a>

  <p style="font-size:11px;color:#cbd5e1;text-align:center;margin:0">Soft Play Near Me &#xB7; monthly insights &#xB7; sent to Premium/Bespoke venues only</p>
</div>
</body>
</html>`

  await sendEmail(opts.to, `Your ${opts.venueName} monthly insights — ${opts.views} views, ${opts.leads} enquiries`, html)
}

// ─── Listing needs attention ────────────────────────────────────────────────────

export interface ListingSlippingEmailOptions {
  to: string
  ownerName: string
  venueName: string
  dashboardUrl: string
  completenessScore: number
  daysSinceVerified: number | null
  isPaidActive: boolean
}

export async function sendListingSlippingEmail(opts: ListingSlippingEmailOptions): Promise<void> {
  const reasons: string[] = []
  if (opts.completenessScore < 60) {
    reasons.push(`your listing is only ${opts.completenessScore}% complete`)
  }
  if (opts.daysSinceVerified !== null && opts.daysSinceVerified > 90) {
    reasons.push(`it hasn&#x27;t been updated in ${opts.daysSinceVerified} days`)
  }
  const reasonText = reasons.length > 0 ? reasons.join(' and ') : 'it could use a refresh'

  const upsell = opts.isPaidActive
    ? ''
    : `<div style="background:#faf5ff;border-radius:10px;padding:16px 20px;border:1px solid #e9d5ff;margin-bottom:16px">
         <p style="margin:0;font-size:13px;color:#475569">Completed listings rank higher in search, and <a href="${BASE_URL}/pricing" style="color:#7c3aed">Premium</a> venues get featured placement on top of that.</p>
       </div>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#f59e0b 0%,#ef4444 100%);border-radius:16px;padding:28px 28px;text-align:center;margin-bottom:20px">
    <div style="font-size:32px;margin-bottom:10px">&#x26A0;&#xFE0F;</div>
    <h1 style="color:#fff;margin:0 0 6px;font-size:18px;font-weight:700">Your listing could use some attention</h1>
    <p style="color:rgba(255,255,255,0.85);margin:0;font-size:13px">${opts.venueName}</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px">
    <p style="font-size:14px;color:#334155;margin:0 0 12px">Hi ${opts.ownerName},</p>
    <p style="font-size:14px;color:#334155;margin:0 0 12px">We noticed ${reasonText} on Soft Play Near Me. Families are more likely to visit venues with complete, up-to-date listings — photos, opening hours, and prices all matter.</p>
    <p style="font-size:14px;color:#334155;margin:0">It only takes a couple of minutes to update from your dashboard.</p>
  </div>

  ${upsell}

  <a href="${opts.dashboardUrl}" style="display:block;background:#0f172a;color:#fff;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:600;font-size:14px;text-align:center;margin-bottom:16px">
    Update My Listing &#x2192;
  </a>

  <p style="font-size:11px;color:#cbd5e1;text-align:center;margin:0">Soft Play Near Me &#xB7; listing reminder</p>
</div>
</body>
</html>`

  await sendEmail(opts.to, `Quick update needed for ${opts.venueName}`, html)
}

// ─── Annual plan renewal reminder ───────────────────────────────────────────────

export interface RenewalReminderEmailOptions {
  to: string
  ownerName: string
  venueName: string
  dashboardUrl: string
  renewsAt: string
  amount: string
}

export async function sendRenewalReminderEmail(opts: RenewalReminderEmailOptions): Promise<void> {
  const renewsDate = new Date(opts.renewsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">

  <div style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);border-radius:16px;padding:28px 28px;text-align:center;margin-bottom:20px">
    <div style="font-size:32px;margin-bottom:10px">&#x1F4C5;</div>
    <h1 style="color:#fff;margin:0 0 6px;font-size:18px;font-weight:700">Your annual Premium renews soon</h1>
    <p style="color:rgba(255,255,255,0.85);margin:0;font-size:13px">${opts.venueName}</p>
  </div>

  <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;margin-bottom:16px">
    <p style="font-size:14px;color:#334155;margin:0 0 12px">Hi ${opts.ownerName},</p>
    <p style="font-size:14px;color:#334155;margin:0 0 12px">Your Premium subscription for <strong>${opts.venueName}</strong> renews on <strong>${renewsDate}</strong> — ${opts.amount} will be collected by Direct Debit automatically, no action needed.</p>
    <p style="font-size:14px;color:#334155;margin:0">Want to make changes first? You can review or cancel from your dashboard any time before then.</p>
  </div>

  <a href="${opts.dashboardUrl}" style="display:block;background:#7c3aed;color:#fff;text-decoration:none;padding:14px 24px;border-radius:9px;font-weight:600;font-size:14px;text-align:center;margin-bottom:16px">
    Manage My Subscription &#x2192;
  </a>

  <p style="font-size:11px;color:#cbd5e1;text-align:center;margin:0">Soft Play Near Me &#xB7; renewal reminder</p>
</div>
</body>
</html>`

  await sendEmail(opts.to, `Your ${opts.venueName} Premium renews on ${renewsDate}`, html)
}
