// SendGrid transport for bulk newsletter sends — separate from lib/email.ts (transactional
// single-recipient emails) because a campaign send needs its own sender config, its own
// SendGrid unsubscribe-group (ASM) handling, and per-recipient result tracking rather than a
// single true/false outcome.
//
// This project maintains its own subscriber list and unsubscribe state in Postgres (see
// lib/newsletter/db.ts) — SendGrid's contact/group suppression (asm) is applied in addition to
// that, not instead of it, so the "Only admins can view subscribers" / "unsubscribe must
// actually update status" requirements don't depend on SendGrid at all.

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'david@softplaynearme.co.uk'
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Soft Play Near Me'
const UNSUBSCRIBE_GROUP_WEEKLY = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID_WEEKLY
const UNSUBSCRIBE_GROUP_EVENTS = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID_EVENTS

export interface NewsletterRecipient {
  email: string
  unsubscribeToken: string
}

export interface CampaignSendResult {
  sent: number
  failed: number
  errors: string[]
}

const CONCURRENCY = 8
const MAX_ERROR_SAMPLES = 10

/**
 * Sends one rendered HTML/subject per recipient (renderHtml gets the recipient so each email
 * carries its own working one-click unsubscribe link) with bounded concurrency. Returns
 * aggregate counts plus a capped sample of error strings for the send log.
 */
export async function sendNewsletterCampaign(
  recipients: NewsletterRecipient[],
  subject: string,
  renderHtml: (recipient: NewsletterRecipient) => string,
  category: 'weekly' | 'events'
): Promise<CampaignSendResult> {
  if (!SENDGRID_API_KEY) {
    return { sent: 0, failed: recipients.length, errors: ['SENDGRID_API_KEY is not configured'] }
  }

  const groupId = category === 'weekly' ? UNSUBSCRIBE_GROUP_WEEKLY : UNSUBSCRIBE_GROUP_EVENTS

  let sent = 0
  let failed = 0
  const errors: string[] = []

  let cursor = 0
  async function worker() {
    while (cursor < recipients.length) {
      const recipient = recipients[cursor]
      cursor += 1
      const ok = await sendOne(recipient, subject, renderHtml(recipient), groupId, category)
      if (ok.success) {
        sent += 1
      } else {
        failed += 1
        if (errors.length < MAX_ERROR_SAMPLES) errors.push(`${recipient.email}: ${ok.error}`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, recipients.length) }, worker))

  return { sent, failed, errors }
}

async function sendOne(
  recipient: NewsletterRecipient,
  subject: string,
  html: string,
  groupId: string | undefined,
  category: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      personalizations: [{ to: [{ email: recipient.email }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: 'hello@softplaynearme.co.uk', name: FROM_NAME },
      subject,
      content: [{ type: 'text/html', value: html }],
      categories: [`newsletter-${category}`],
    }
    if (groupId) {
      body.asm = { group_id: Number(groupId) }
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `SendGrid ${res.status}: ${text.slice(0, 300)}` }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
