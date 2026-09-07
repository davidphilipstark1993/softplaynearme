import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  let client
  try {
    client = await getPool().connect()

    // Look up the claim by access token
    const claimResult = await client.query(
      `SELECT id, name, email, venue_name, venue_address, venue_phone, venue_website,
              city_slug, venue_slug, venue_url, status, email_verified, created_at
       FROM venue_claims
       WHERE access_token = $1
       LIMIT 1`,
      [token]
    )

    if (claimResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
    }

    const claim = claimResult.rows[0]

    // If claim links to a specific venue in DB, fetch full venue data
    let venue = null
    if (claim.city_slug && claim.venue_slug) {
      const venueResult = await client.query(
        `SELECT v.*,
                COALESCE(NULLIF(COALESCE(AVG(r.rating), 0), 0), v.rating::numeric) as avg_rating,
                CASE WHEN COUNT(r.id) > 0 THEN COUNT(r.id) ELSE COALESCE(v.reviews_count, 0) END as review_count
         FROM venues v
         LEFT JOIN reviews r ON r.venue_id = v.id AND r.approved = true
         WHERE v.city_slug = $1 AND v.slug = $2
         GROUP BY v.id
         LIMIT 1`,
        [claim.city_slug, claim.venue_slug]
      )
      venue = venueResult.rows[0] || null
    }

    let enquiries: unknown[] = []
    let insights = { views30d: 0, clicks30d: 0, leads30d: 0, viewsPrev30d: 0, clicksPrev30d: 0, leadsPrev30d: 0 }
    if (venue) {
      try {
        const enquiriesResult = await client.query(
          `SELECT id, name, email, phone, message, notified, created_at
           FROM venue_enquiries WHERE venue_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [venue.id]
        )
        enquiries = enquiriesResult.rows
      } catch (e) {
        console.warn('[dashboard] enquiries lookup skipped:', (e as Error).message?.slice(0, 120))
      }

      try {
        const [eventsResult, leadsResult] = await Promise.all([
          client.query(
            `SELECT
               COUNT(*) FILTER (WHERE event_type = 'view' AND created_at >= NOW() - INTERVAL '30 days') AS views,
               COUNT(*) FILTER (WHERE event_type LIKE 'click_%' AND created_at >= NOW() - INTERVAL '30 days') AS clicks,
               COUNT(*) FILTER (WHERE event_type = 'view' AND created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS views_prev,
               COUNT(*) FILTER (WHERE event_type LIKE 'click_%' AND created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS clicks_prev
             FROM venue_page_events WHERE venue_id = $1`,
            [venue.id]
          ),
          client.query(
            `SELECT
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS leads,
               COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS leads_prev
             FROM venue_enquiries WHERE venue_id = $1`,
            [venue.id]
          ),
        ])
        const ev = eventsResult.rows[0]
        const ld = leadsResult.rows[0]
        insights = {
          views30d: Number(ev?.views ?? 0),
          clicks30d: Number(ev?.clicks ?? 0),
          leads30d: Number(ld?.leads ?? 0),
          viewsPrev30d: Number(ev?.views_prev ?? 0),
          clicksPrev30d: Number(ev?.clicks_prev ?? 0),
          leadsPrev30d: Number(ld?.leads_prev ?? 0),
        }
      } catch (e) {
        console.warn('[dashboard] insights lookup skipped:', (e as Error).message?.slice(0, 120))
      }
    }

    return NextResponse.json({ claim, venue, enquiries, insights })
  } catch (err) {
    console.error('Dashboard GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
