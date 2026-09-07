import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { isStripeConfigured, createBillingPortalSession } from '@/lib/stripe'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.softplaynearme.co.uk'

/** Opens Stripe's hosted Customer Portal so a Premium/Bespoke owner can manage or cancel their subscription. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing management isn’t available right now.' }, { status: 503 })
  }

  let client
  try {
    client = await getPool().connect()

    const claimResult = await client.query(
      `SELECT city_slug, venue_slug FROM venue_claims WHERE access_token = $1 LIMIT 1`,
      [token]
    )
    if (claimResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
    }
    const claim = claimResult.rows[0]
    if (!claim.city_slug || !claim.venue_slug) {
      return NextResponse.json({ error: 'No venue linked to this claim' }, { status: 400 })
    }

    const venueResult = await client.query(
      `SELECT stripe_customer_id FROM venues WHERE city_slug = $1 AND slug = $2 LIMIT 1`,
      [claim.city_slug, claim.venue_slug]
    )
    const stripeCustomerId = venueResult.rows[0]?.stripe_customer_id
    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'No billing account found for this venue yet.' }, { status: 400 })
    }

    const session = await createBillingPortalSession({
      stripeCustomerId,
      returnUrl: `${BASE_URL}/dashboard/${token}`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[dashboard/portal] API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error — please try again' },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}
