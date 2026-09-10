import { NextRequest, NextResponse } from 'next/server'
import { subscribeEmail } from '@/lib/newsletter/db'
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
    return NextResponse.json({ ok: true, outcome: 'created' })
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
    const { subscriber, outcome } = await subscribeEmail({
      email,
      weeklyNewsletter,
      eventsActivities,
      source: (typeof body.source === 'string' && body.source.slice(0, 100)) || 'unknown',
    })
    return NextResponse.json({
      ok: true,
      outcome,
      weeklyNewsletter: subscriber.weekly_newsletter,
      eventsActivities: subscriber.events_activities,
    })
  } catch (err) {
    console.error('[newsletter/subscribe] error:', err)
    return NextResponse.json({ error: 'Subscription failed — please try again' }, { status: 500 })
  }
}
