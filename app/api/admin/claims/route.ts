import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { slugify } from '@/lib/utils'
import { cities } from '@/lib/venues'

const CITY_SLUGS = new Set(cities.map((c) => c.slug))

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let client
  try {
    client = await getPool().connect()
    const result = await client.query(
      `SELECT id, name, email, venue_name, venue_address, venue_phone, venue_website,
              city_slug, venue_slug, status, email_verified, created_at,
              plan_interest, message
       FROM venue_claims
       ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
         created_at DESC`
    )
    return NextResponse.json({ claims: result.rows })
  } catch (err) {
    console.error('[admin/claims] GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, status, citySlug } = await req.json()
  if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  let client
  try {
    client = await getPool().connect()

    if (status === 'approved') {
      const claimResult = await client.query(
        `SELECT venue_name, venue_address, venue_phone, venue_website, city_slug, venue_slug,
                plan_interest, stripe_customer_id, stripe_subscription_id
         FROM venue_claims WHERE id = $1 LIMIT 1`,
        [id]
      )
      if (claimResult.rows.length === 0) {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
      }
      const claim = claimResult.rows[0]
      // Only a claim whose Direct Debit subscription is actually confirmed
      // (the webhook sets stripe_subscription_id once Stripe Checkout
      // completes) counts as a paid Premium sign-up here — someone who
      // abandoned the Stripe page mid-flow gets approved as a normal free
      // listing instead.
      const isPaidPremium = claim.plan_interest === 'premium' && !!claim.stripe_subscription_id

      // Creates a `venues` row for this claim and points the claim's
      // city_slug/venue_slug at it. Used both for genuinely-new listings
      // (no slugs on the claim yet) and for orphaned ones (slugs set but
      // pointing at a venue that was never imported into `venues`).
      async function createVenueForClaim(targetCitySlug: string, preferredSlug?: string) {
        const baseSlug = preferredSlug || slugify(claim.venue_name)
        let slug = baseSlug
        let suffix = 2
        // Slugs only need to be unique within a city (UNIQUE(city_slug, slug)).
        for (;;) {
          const existing = await client!.query(
            `SELECT 1 FROM venues WHERE city_slug = $1 AND slug = $2 LIMIT 1`,
            [targetCitySlug, slug]
          )
          if (existing.rows.length === 0) break
          slug = `${baseSlug}-${suffix++}`
        }

        await client!.query(
          `INSERT INTO venues
             (name, slug, city_slug, address, phone, website, owner_submitted, claimed_by_owner, needs_review,
              plan, plan_status, plan_started_at, stripe_customer_id, stripe_subscription_id)
           VALUES ($1,$2,$3,$4,$5,$6, true, true, true,
                   $7, $8, $9, $10, $11)`,
          [
            claim.venue_name,
            slug,
            targetCitySlug,
            claim.venue_address || null,
            claim.venue_phone || null,
            claim.venue_website || null,
            isPaidPremium ? 'premium' : 'free',
            isPaidPremium ? 'active' : 'inactive',
            isPaidPremium ? new Date() : null,
            isPaidPremium ? claim.stripe_customer_id : null,
            isPaidPremium ? claim.stripe_subscription_id : null,
          ]
        )

        await client!.query(
          `UPDATE venue_claims SET city_slug = $1, venue_slug = $2 WHERE id = $3`,
          [targetCitySlug, slug, id]
        )
      }

      if (claim.city_slug && claim.venue_slug) {
        // Claiming an existing venue already in the directory — mark it owner-claimed,
        // carrying over the Premium plan if the Direct Debit mandate already came through.
        const updateResult = await client.query(
          isPaidPremium
            ? `UPDATE venues SET claimed_by_owner = true, plan = 'premium', plan_status = 'active',
                 plan_started_at = COALESCE(plan_started_at, CURRENT_TIMESTAMP),
                 stripe_customer_id = $3, stripe_subscription_id = $4
               WHERE city_slug = $1 AND slug = $2`
            : `UPDATE venues SET claimed_by_owner = true WHERE city_slug = $1 AND slug = $2`,
          isPaidPremium
            ? [claim.city_slug, claim.venue_slug, claim.stripe_customer_id, claim.stripe_subscription_id]
            : [claim.city_slug, claim.venue_slug]
        )
        if (updateResult.rowCount === 0) {
          // Orphaned claim: slugs were set (e.g. from a static/un-imported
          // listing) but no matching `venues` row exists. The claim's own
          // city_slug is already a valid supported city, so reuse it and
          // the claim's existing slug rather than asking the admin again.
          await createVenueForClaim(claim.city_slug, claim.venue_slug)
        }
      } else {
        // Brand-new venue — nothing in `venues` exists for it yet, so create it here.
        // The claim's free-text address can't be reliably mapped to one of our
        // supported cities, so the admin picks it explicitly when approving.
        if (!citySlug || !CITY_SLUGS.has(citySlug)) {
          return NextResponse.json(
            { error: 'Select a city before approving a new listing' },
            { status: 400 }
          )
        }
        await createVenueForClaim(citySlug)
      }
    }

    await client.query(
      `UPDATE venue_claims SET status = $1 WHERE id = $2`,
      [status, id]
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/claims] PATCH error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
