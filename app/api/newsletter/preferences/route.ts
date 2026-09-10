import { NextRequest, NextResponse } from 'next/server'
import { getSubscriberByToken, updatePreferencesByToken } from '@/lib/newsletter/db'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const subscriber = await getSubscriberByToken(token)
  if (!subscriber) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    email: subscriber.email,
    weeklyNewsletter: subscriber.weekly_newsletter,
    eventsActivities: subscriber.events_activities,
    status: subscriber.status,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const token = typeof body?.token === 'string' ? body.token : ''
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const weeklyNewsletter = body.weeklyNewsletter === true
  const eventsActivities = body.eventsActivities === true

  const subscriber = await updatePreferencesByToken(token, { weeklyNewsletter, eventsActivities })
  if (!subscriber) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ok: true,
    weeklyNewsletter: subscriber.weekly_newsletter,
    eventsActivities: subscriber.events_activities,
    status: subscriber.status,
  })
}
