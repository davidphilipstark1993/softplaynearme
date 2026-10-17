import { NextRequest, NextResponse } from 'next/server'
import { subscribeEmail, resetConfirmationCooldown } from '@/lib/newsletter/db'
import { sendNewsletterConfirmationEmail } from '@/lib/email'
import { getClientIp, isRateLimited } from '@/lib/newsletter/rateLimit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests — please try again shortly' }, { status: 429 })
  }

  let body: { email?: string; weeklyNewsletter?: boolean; eventsActivities?: boolean; source?: string; company?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Honeypot: a real visitor never fills in a field this name normally isn't shown for.
  if (body.company) {
    return NextResponse.json({ ok: true, outcome: 'confirmation_sent' })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  const weeklyNewsletter = body.weeklyNewsletter !== false // default true
  const eventsActivities = body.eventsActivities === true // default false

  if (!weeklyNewsletter && !eventsActivities) {
    return NextResponse.json({ error: 'Choose at least one list to subscribe to' }, { status: 400 })
  }

  try {
    const { subscriber, outcome, sendConfirmation } = await subscribeEmail({
      email,
      weeklyNewsletter,
      eventsActivities,
      source: (typeof body.source === 'string' && body.source.slice(0, 100)) || 'unknown',
    })

    // Nothing is switched on, and nobody is added to SendGrid, until the owner of the
    // address clicks the emailed link (see /api/newsletter/confirm). The send is awaited:
    // a serverless function is frozen once the response goes out, and the visitor needs
    // to be told honestly if the email didn't go.
    if (sendConfirmation) {
      const sent = await sendNewsletterConfirmationEmail({
        to: email.trim().toLowerCase(),
        confirmationToken: subscriber.confirmation_token,
        weekly: subscriber.pending_weekly,
        events: subscriber.pending_events,
      })
      if (!sent) {
        await resetConfirmationCooldown(email)
        return NextResponse.json(
          { error: "We couldn't send your confirmation email. Please try again in a few minutes." },
          { status: 502 }
        )
      }
    }

    return NextResponse.json({ ok: true, outcome })
  } catch (err) {
    console.error('[newsletter/subscribe] error:', err)
    return NextResponse.json({ error: 'Subscription failed — please try again' }, { status: 500 })
  }
}
