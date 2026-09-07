import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { isStripeConfigured, createPremiumCheckoutSession } from '@/lib/stripe'

/**
 * Self-serve "Upgrade to Premium" from an already-claimed venue's
 * dashboard — goes straight to Stripe Checkout, unlike
 * `/api/dashboard/[token]/upgrade-request` (which only emails the admin,
 * used for the Bespoke request-a-quote path).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Premium sign-up isn’t available yet — please check back soon or contact us.' },
      { status: 503 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const interval = body?.interval === 'year' ? 'year' : 'month'

  let client
  try {
    client = await getPool().connect()

    const claimResult = await client.query(
      `SELECT id, name, email, venue_name, city_slug, venue_slug, access_token
       FROM venue_claims WHERE access_token = $1 LIMIT 1`,
      [token]
    )
    if (claimResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
    }
    const claim = claimResult.rows[0]

    if (!claim.city_slug || !claim.venue_slug) {
      return NextResponse.json(
        { error: 'Your claim is still being reviewed — you can upgrade once it’s approved.' },
        { status: 400 }
      )
    }

    const venueResult = await client.query(
      `SELECT id, claimed_by_owner, plan, plan_status FROM venues WHERE city_slug = $1 AND slug = $2 LIMIT 1`,
      [claim.city_slug, claim.venue_slug]
    )
    const venue = venueResult.rows[0]
    if (!venue || !venue.claimed_by_owner) {
      return NextResponse.json(
        { error: 'Claim your venue first before upgrading.' },
        { status: 403 }
      )
    }
    if (venue.plan === 'premium' && venue.plan_status === 'active') {
      return NextResponse.json({ error: 'This venue is already on Premium.' }, { status: 400 })
    }

    const session = await createPremiumCheckoutSession({
      email: claim.email,
      venueName: claim.venue_name,
      claimId: claim.id,
      accessToken: claim.access_token,
      interval,
    })

    if (!session.url) {
      throw new Error('Stripe did not return a Checkout URL')
    }

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[dashboard/checkout] API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error — please try again' },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}
