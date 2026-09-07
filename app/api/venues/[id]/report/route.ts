import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { sendContactFormNotification } from '@/lib/email'

const REPORT_TYPES = new Set(['incorrect_info', 'permanently_closed', 'other'])

// ── In-memory rate limiter: 5 reports per hour per venue ─────────────────────
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

/** Lets any visitor flag a listing as wrong/closed — distinct from the owner claim/enquiry flows, no account or venue ownership needed. */
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
    return NextResponse.json({ error: 'Too many reports — please try again later' }, { status: 429 })
  }

  let client
  try {
    const body = await request.json()
    const { reportType, message, email } = body || {}

    if (!REPORT_TYPES.has(reportType)) {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Please describe the issue' }, { status: 400 })
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    client = await getPool().connect()

    await client.query(
      `CREATE TABLE IF NOT EXISTS venue_reports (
        id           SERIAL PRIMARY KEY,
        venue_id     INTEGER NOT NULL REFERENCES venues(id),
        report_type  VARCHAR(30) NOT NULL,
        message      TEXT NOT NULL,
        reporter_email VARCHAR(160),
        resolved     BOOLEAN DEFAULT false,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    )

    const venueResult = await client.query(
      `SELECT name, city_slug, slug FROM venues WHERE id = $1 LIMIT 1`,
      [venueId]
    )
    if (venueResult.rows.length === 0) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }
    const venue = venueResult.rows[0]

    const cleanMessage = message.trim().slice(0, 2000)
    const cleanEmail = email?.trim()?.slice(0, 160) || null

    await client.query(
      `INSERT INTO venue_reports (venue_id, report_type, message, reporter_email)
       VALUES ($1, $2, $3, $4)`,
      [venueId, reportType, cleanMessage, cleanEmail]
    )

    const typeLabel: Record<string, string> = {
      incorrect_info: 'Incorrect information',
      permanently_closed: 'Permanently closed',
      other: 'Other issue',
    }

    sendContactFormNotification({
      name: 'Anonymous reporter',
      email: cleanEmail || 'no-reply@softplaynearme.co.uk',
      topic: `${typeLabel[reportType]} — ${venue.name} (/soft-play/${venue.city_slug}/${venue.slug})`,
      message: cleanMessage,
    }).catch((e) => console.error('[venue report] admin notification failed:', e))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[venue report] API error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
