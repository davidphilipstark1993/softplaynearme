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

    return NextResponse.json({ claim, venue })
  } catch (err) {
    console.error('Dashboard GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
