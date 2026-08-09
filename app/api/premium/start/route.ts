import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { isStripeConfigured, createPremiumCheckoutSession } from '@/lib/stripe'
import { sendAdminClaimNotification } from '@/lib/email'

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Premium sign-up isn’t available yet — payment setup is still being configured. Please check back soon or contact us.' },
      { status: 503 }
    )
  }

  let client
  try {
    const body = await request.json()
    const {
      name,
      email,
      venueName,
      venueAddress,
      venuePhone,
      venueWebsite,
      citySlug,
      venueSlug,
      venueUrl,
    } = body || {}

    if (!name?.trim() || !email?.trim() || !venueName?.trim()) {
      return NextResponse.json({ error: 'Name, email, and venue name are required' }, { status: 400 })
    }

    client = await getPool().connect()

    // Same non-fatal, additive schema pattern as /api/claims.
    const schemaSql = [
      `CREATE TABLE IF NOT EXISTS venue_claims (
        id                 SERIAL PRIMARY KEY,
        name               VARCHAR(120) NOT NULL,
        email              VARCHAR(160) NOT NULL,
        venue_name         VARCHAR(255) NOT NULL,
        venue_address      TEXT,
        venue_phone        VARCHAR(30),
        venue_website      VARCHAR(500),
        city_slug          VARCHAR(100),
        venue_slug         VARCHAR(255),
        venue_url          VARCHAR(500),
        proof              VARCHAR(500),
        message            TEXT,
        access_token       UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
        verification_token UUID UNIQUE DEFAULT gen_random_uuid(),
        email_verified     BOOLEAN DEFAULT FALSE,
        status             VARCHAR(30) DEFAULT 'pending',
        created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS plan_interest VARCHAR(20) DEFAULT 'free'`,
      `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255)`,
      `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(50)`,
      `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(50)`,
    ]
    for (const sql of schemaSql) {
      try { await client.query(sql) } catch (e) {
        console.warn('[premium/start] Schema step skipped:', (e as Error).message?.slice(0, 120))
      }
    }

    const result = await client.query(
      `INSERT INTO venue_claims
         (name, email, venue_name, venue_address, venue_phone, venue_website,
          city_slug, venue_slug, venue_url, proof, message, plan_interest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'','','premium')
       RETURNING id, access_token`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        venueName.trim(),
        venueAddress?.trim() || null,
        venuePhone?.trim() || null,
        venueWebsite?.trim() || null,
        citySlug?.trim() || null,
        venueSlug?.trim() || null,
        venueUrl?.trim() || null,
      ]
    )
    const claimId = result.rows[0].id as number
    const accessToken = result.rows[0].access_token as string

    const session = await createPremiumCheckoutSession({
      email: email.trim().toLowerCase(),
      venueName: venueName.trim(),
      claimId,
      accessToken,
    })

    await client.query(
      `UPDATE venue_claims SET stripe_checkout_session_id = $1 WHERE id = $2`,
      [session.id, claimId]
    )

    // Let the admin know someone's started Premium sign-up, in case they
    // drop off before completing the Direct Debit step on Stripe.
    sendAdminClaimNotification({
      claimantName: name.trim(),
      claimantEmail: email.trim(),
      venueName: venueName.trim(),
      venueAddress: venueAddress?.trim() || undefined,
      venuePhone: venuePhone?.trim() || undefined,
      venueWebsite: venueWebsite?.trim() || undefined,
      citySlug: citySlug?.trim() || undefined,
      venueSlug: venueSlug?.trim() || undefined,
      planInterest: 'premium',
    }).catch((e) => console.error('[premium/start] admin notification failed:', e))

    if (!session.url) {
      throw new Error('Stripe did not return a Checkout URL')
    }

    return NextResponse.json({ authorisationUrl: session.url, token: accessToken })
  } catch (err) {
    console.error('[premium/start] API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error — please try again' },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}
