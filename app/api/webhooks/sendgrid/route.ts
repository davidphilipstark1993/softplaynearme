import { NextResponse } from 'next/server'
import { EventWebhook, EventWebhookHeader } from '@sendgrid/eventwebhook'
import { applySendGridEvent, recordNewsletterEvent, type UnsubscribeScope } from '@/lib/newsletter/db'
import type { NewsletterEventType } from '@/lib/newsletter/types'

interface SendGridWebhookEvent {
  email: string
  event: string
  category?: string[] | string
  url?: string
  asm_group_id?: number
}

const TRACKED_EVENTS: NewsletterEventType[] = ['open', 'click', 'bounce', 'unsubscribe', 'group_unsubscribe', 'spamreport']

function groupIdToScope(groupId: number): UnsubscribeScope | null {
  const weeklyGroup = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID_WEEKLY
  const eventsGroup = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID_EVENTS
  if (weeklyGroup && Number(weeklyGroup) === groupId) return 'weekly'
  if (eventsGroup && Number(eventsGroup) === groupId) return 'events'
  return null
}

// SendGrid requires the exact raw request body for signature verification, so this route reads
// text() before any JSON.parse — this is the one deliberate exception to parsing JSON directly
// elsewhere in this project's API routes.
//
// Keeps SendGrid's own unsubscribe-group clicks and bounce/spam suppressions in sync with our
// Postgres subscriber table — someone clicking "Unsubscribe" in their email client (rather than
// our own link) still has to actually stop receiving mail; this webhook is what makes that true.
export async function POST(req: Request) {
  const publicKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY
  if (!publicKey) {
    console.error('[webhooks/sendgrid] SENDGRID_WEBHOOK_VERIFICATION_KEY is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const payload = await req.text()
  const signature = req.headers.get(EventWebhookHeader.SIGNATURE())
  const timestamp = req.headers.get(EventWebhookHeader.TIMESTAMP())

  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
  }

  const eventWebhook = new EventWebhook()
  const ecPublicKey = eventWebhook.convertPublicKeyToECDSA(publicKey)
  if (!eventWebhook.verifySignature(ecPublicKey, payload, signature, timestamp)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const events = JSON.parse(payload) as SendGridWebhookEvent[]

  for (const event of events) {
    try {
      const email = event.email?.toLowerCase()
      if (!email || !TRACKED_EVENTS.includes(event.event as NewsletterEventType)) continue

      const eventType = event.event as NewsletterEventType
      const groupId = event.asm_group_id ?? null

      await applySendGridEvent(email, eventType, groupId, groupIdToScope)

      const categories = Array.isArray(event.category) ? event.category : event.category ? [event.category] : []
      const newsletterCategory = categories.find((c) => c.startsWith('newsletter-'))
      const newsletterId = newsletterCategory ? Number(newsletterCategory.replace('newsletter-', '')) : null

      await recordNewsletterEvent({
        newsletterId: Number.isFinite(newsletterId) ? newsletterId : null,
        eventType,
        email,
        url: event.url ?? null,
        sendgridGroupId: groupId,
      })
    } catch (err) {
      // One malformed/unexpected event should never drop the rest of the batch.
      console.error('[webhooks/sendgrid] event processing error:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
