import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { constructStripeWebhookEvent } from '@/lib/stripe'
import { sendPremiumActivatedEmail } from '@/lib/email'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.softplaynearme.co.uk'

/**
 * Handles Checkout Sessions completing. In subscription mode with
 * payment_method_types: ['bacs_debit'], a completed session means the
 * customer both authorised the Direct Debit mandate and Stripe created the
 * recurring subscription — there's no separate "create subscription" step
 * like GoCardless's Billing Request → Subscription flow.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('Stripe-Signature')

  const event = constructStripeWebhookEvent(rawBody, signature)
  if (!event) {
    console.error('[webhooks/stripe] Invalid or missing signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as {
    id: string
    mode: string
    customer: string | null
    subscription: string | null
    metadata: Record<string, string> | null
  }
  if (session.mode !== 'subscription') {
    return NextResponse.json({ received: true })
  }

  const claimId = session.metadata?.claim_id ? Number(session.metadata.claim_id) : null
  if (!claimId) {
    console.error('[webhooks/stripe] Session completed with no claim_id metadata', session.id)
    return NextResponse.json({ received: true })
  }

  let client
  try {
    client = await getPool().connect()

    // Same non-fatal, additive schema pattern used across the other routes.
    const schemaSql = [
      `ALTER TABLE venues ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(50)`,
      `ALTER TABLE venues ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(50)`,
    ]
    for (const sql of schemaSql) {
      try { await client.query(sql) } catch (e) {
        console.warn('[webhooks/stripe] Schema step skipped:', (e as Error).message?.slice(0, 120))
      }
    }

    const claimResult = await client.query(
      `SELECT id, name, email, venue_name, city_slug, venue_slug, access_token,
              stripe_subscription_id
       FROM venue_claims WHERE id = $1 LIMIT 1`,
      [claimId]
    )
    if (claimResult.rows.length === 0) {
      console.warn('[webhooks/stripe] No claim found for id', claimId)
      return NextResponse.json({ received: true })
    }
    const claim = claimResult.rows[0]

    // Idempotency — Stripe retries webhook delivery, and duplicate delivery
    // must not re-run activation for the same claim.
    if (claim.stripe_subscription_id) {
      return NextResponse.json({ received: true })
    }

    await client.query(
      `UPDATE venue_claims
       SET stripe_customer_id = $1, stripe_subscription_id = $2
       WHERE id = $3`,
      [session.customer || null, session.subscription || null, claim.id]
    )

    // Already claiming an existing venue — activate the plan immediately.
    // Brand-new venues get their plan carried over when the admin approves
    // the claim (see createVenueForClaim in /api/admin/claims).
    if (claim.city_slug && claim.venue_slug) {
      await client.query(
        `UPDATE venues
         SET claimed_by_owner = true, plan = 'premium', plan_status = 'active',
             plan_started_at = COALESCE(plan_started_at, CURRENT_TIMESTAMP),
             stripe_customer_id = $1, stripe_subscription_id = $2
         WHERE city_slug = $3 AND slug = $4`,
        [session.customer || null, session.subscription || null, claim.city_slug, claim.venue_slug]
      )
    }

    sendPremiumActivatedEmail({
      to: claim.email,
      ownerName: claim.name,
      venueName: claim.venue_name,
      dashboardUrl: `${BASE_URL}/dashboard/${claim.access_token}`,
    }).catch((e) => console.error('[webhooks/stripe] confirmation email failed:', e))

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhooks/stripe] error:', err)
    // 500 tells Stripe to retry the webhook delivery.
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
