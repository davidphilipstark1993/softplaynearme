import { NextRequest, NextResponse } from 'next/server'
import { confirmByToken, markSubscriberSynced } from '@/lib/newsletter/db'
import { pushSendGridContact } from '@/lib/newsletter/sendgrid-contacts'

// POST, not GET: email security scanners prefetch every link in a message, and a GET that
// confirmed would let them subscribe people who never clicked. The emailed link opens
// /newsletter/confirm, which asks the person to press a button that calls this.
export async function POST(req: NextRequest) {
  let token = ''
  try {
    const body = await req.json()
    token = typeof body.token === 'string' ? body.token.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!/^[a-f0-9]{16,64}$/.test(token)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  try {
    const result = await confirmByToken(token)
    if (result.ok === false) {
      return NextResponse.json({ error: result.reason }, { status: result.reason === 'expired' ? 410 : 404 })
    }

    const { subscriber } = result
    // Sync to SendGrid Marketing Contacts only now that consent is confirmed. A failure just
    // leaves sendgrid_synced=false for the admin "Retry SendGrid sync" button.
    if (process.env.SENDGRID_API_KEY && !subscriber.sendgrid_synced) {
      try {
        const jobId = await pushSendGridContact(subscriber.email)
        await markSubscriberSynced(subscriber.email, jobId)
      } catch (err) {
        console.error('[newsletter/confirm] SendGrid contact sync error:', err)
      }
    }

    return NextResponse.json({
      ok: true,
      weeklyNewsletter: subscriber.weekly_newsletter,
      eventsActivities: subscriber.events_activities,
      unsubscribeToken: subscriber.unsubscribe_token,
    })
  } catch (err) {
    console.error('[newsletter/confirm] error:', err)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
