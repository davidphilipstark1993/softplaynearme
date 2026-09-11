// SendGrid transport for bulk newsletter sends — separate from lib/email.ts (transactional
// single-recipient emails) because a campaign send needs batched delivery, ASM (unsubscribe
// group) handling, and per-recipient result tracking rather than a single true/false outcome.
//
// Batches personalizations into few requests (SendGrid's cap is 1000 per call) with one shared
// HTML/text body, the same pattern the proven Listen True Crime newsletter system uses — rather
// than one API call per recipient. Each recipient still gets their own working unsubscribe/
// preferences links: the shared body contains the literal tags below, and each personalization
// carries its own `substitutions` map that SendGrid replaces per-recipient before sending.
export const UNSUB_URL_TAG = '-unsub_url-'
export const PREF_URL_TAG = '-pref_url-'

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'david@softplaynearme.co.uk'
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Soft Play Near Me'
const UNSUBSCRIBE_GROUP_WEEKLY = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID_WEEKLY
const UNSUBSCRIBE_GROUP_EVENTS = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID_EVENTS

const BATCH_SIZE = 900 // SendGrid personalizations cap is 1000 per request

export interface NewsletterRecipient {
  email: string
  unsubscribeUrl: string
  preferencesUrl: string
}

export interface CampaignSendResult {
  sent: number
  failed: number
  errors: string[]
  lastMessageId: string | null
}

/**
 * Sends one shared HTML/text body (containing the -unsub_url-/-pref_url- tags) to every
 * recipient, batched. This project maintains its own subscriber list and unsubscribe state in
 * Postgres (see lib/newsletter/db.ts) — SendGrid's asm.group_id is applied in addition to that,
 * not instead of it, and /api/webhooks/sendgrid syncs SendGrid-side unsubscribes back so the two
 * never drift.
 */
export async function sendNewsletterCampaign(
  recipients: NewsletterRecipient[],
  subject: string,
  html: string,
  plainText: string,
  newsletterId: number,
  category: 'weekly' | 'events'
): Promise<CampaignSendResult> {
  if (!SENDGRID_API_KEY) {
    return { sent: 0, failed: recipients.length, errors: ['SENDGRID_API_KEY is not configured'], lastMessageId: null }
  }

  const groupId = category === 'weekly' ? UNSUBSCRIBE_GROUP_WEEKLY : UNSUBSCRIBE_GROUP_EVENTS

  let sent = 0
  let failed = 0
  const errors: string[] = []
  let lastMessageId: string | null = null

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)

    const body: Record<string, unknown> = {
      personalizations: batch.map((r) => ({
        to: [{ email: r.email }],
        substitutions: { [UNSUB_URL_TAG]: r.unsubscribeUrl, [PREF_URL_TAG]: r.preferencesUrl },
      })),
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: 'hello@softplaynearme.co.uk', name: FROM_NAME },
      subject,
      content: [
        { type: 'text/plain', value: plainText },
        { type: 'text/html', value: html },
      ],
      categories: [`newsletter-${newsletterId}`],
    }
    if (groupId) body.asm = { group_id: Number(groupId) }

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const text = await res.text()
        failed += batch.length
        errors.push(`Batch starting at ${batch[0].email} (${batch.length} recipients): SendGrid ${res.status}: ${text.slice(0, 300)}`)
        continue
      }

      lastMessageId = res.headers.get('x-message-id') ?? lastMessageId
      sent += batch.length
    } catch (err) {
      failed += batch.length
      errors.push(`Batch starting at ${batch[0].email} (${batch.length} recipients): ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return { sent, failed, errors: errors.slice(0, 10), lastMessageId }
}
