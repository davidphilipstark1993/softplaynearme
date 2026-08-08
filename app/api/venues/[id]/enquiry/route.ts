import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { sendLeadNotificationEmail } from '@/lib/email'
import { isPaidActive } from '@/lib/plans'

// ── In-memory rate limiter: 5 enquiries per hour per venue ──────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const venueId = parseInt(id, 10)
  if (!venueId || isNaN(venueId)) {
    return NextResponse.json({ error: 'Invalid venue' }, { status: 400 })
  }

  if (!checkRateLimit(id)) {
    return NextResponse.json(
      { error: 'Too many enquiries — please try again later' },
      { status: 429 }
    )
  }

  let client
  try {
    const body = await request.json()
    const { name, email, phone, message } = body || {}

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    client = await getPool().connect()

    const venueResult = await client.query(
      `SELECT id, name, email, contact_email, plan, plan_status FROM venues WHERE id = $1 LIMIT 1`,
      [venueId]
    )
    if (venueResult.rows.length === 0) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }
    const venue = venueResult.rows[0]

    const cleanName = name.trim().slice(0, 120)
    const cleanEmail = email.trim().slice(0, 160)
    const cleanPhone = phone?.trim()?.slice(0, 30) || null
    const cleanMessage = message.trim().slice(0, 2000)

    const notifyOwner = isPaidActive(venue) && !!(venue.contact_email || venue.email)

    await client.query(
      `INSERT INTO venue_enquiries (venue_id, name, email, phone, message, notified)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [venueId, cleanName, cleanEmail, cleanPhone, cleanMessage, notifyOwner]
    )

    if (notifyOwner) {
      try {
        await sendLeadNotificationEmail({
          to: venue.contact_email || venue.email,
          venueName: venue.name,
          enquirerName: cleanName,
          enquirerEmail: cleanEmail,
          enquirerPhone: cleanPhone || undefined,
          message: cleanMessage,
        })
      } catch (err) {
        console.error('[venue enquiry] Lead notification failed:', err)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[venue enquiry] API error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
