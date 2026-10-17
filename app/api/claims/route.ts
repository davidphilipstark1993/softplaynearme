import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { getClientIp, isRateLimited as isIpRateLimited } from '@/lib/newsletter/rateLimit'
import { sendWelcomeEmail, sendVerificationEmail, sendAdminClaimNotification } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  let client
  try {
    if (isIpRateLimited(getClientIp(request.headers))) {
      return NextResponse.json({ error: 'Too many requests — please try again shortly' }, { status: 429 })
    }

    const body = await request.json()
    // Honeypot: hidden field a real visitor never fills in. Pretend success so bots don't retry.
    if (body?.company) {
      return NextResponse.json({ success: true, token: '' })
    }
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
      planInterest,
      message,
    } = body || {}

    if (!name?.trim() || !email?.trim() || !venueName?.trim()) {
      return NextResponse.json({ error: 'Name, email, and venue name are required' }, { status: 400 })
    }

    if (!EMAIL_RE.test(email.trim()) || email.length > 160 || name.length > 120 || venueName.length > 255) {
      return NextResponse.json({ error: 'Please check your details and try again' }, { status: 400 })
    }

    const isBespoke = planInterest === 'bespoke'

    client = await getPool().connect()

    // Abuse limits that hold across serverless instances (counted from the claims
    // table itself, unlike an in-memory map). Tables/columns are created by
    // scripts/migrateClaims.mjs, not here.
    const cleanEmail = email.trim().toLowerCase()
    const recent = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour')::int AS by_email,
         COUNT(*) FILTER (WHERE venue_name ILIKE $2 AND created_at > NOW() - INTERVAL '24 hours')::int AS by_venue,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS total
       FROM venue_claims`,
      [cleanEmail, venueName.trim()]
    )
    const counts = recent.rows[0] as { by_email: number; by_venue: number; total: number }
    if (counts.by_email >= 3 || counts.by_venue >= 5 || counts.total >= 40) {
      return NextResponse.json({ error: 'Too many requests — please try again later' }, { status: 429 })
    }

    const result = await client.query(
      `INSERT INTO venue_claims
         (name, email, venue_name, venue_address, venue_phone, venue_website,
          city_slug, venue_slug, venue_url, proof, message, plan_interest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING access_token,
                 COALESCE(verification_token::text, '') AS verification_token`,
      [
        name.trim(),
        cleanEmail,
        venueName.trim(),
        venueAddress?.trim() || null,
        venuePhone?.trim() || null,
        venueWebsite?.trim() || null,
        citySlug?.trim() || null,
        venueSlug?.trim() || null,
        venueUrl?.trim() || null,
        '',
        message?.trim() || '',
        isBespoke ? 'bespoke' : 'free',
      ]
    )

    client.release()
    client = undefined

    const accessToken = result.rows[0].access_token as string
    const verificationToken = result.rows[0].verification_token as string

    // Emails are awaited (not fire-and-forget) — Vercel's serverless runtime
    // doesn't keep a function alive for background work after the response
    // is sent, so un-awaited sends were getting cut off mid-request and
    // silently failing. Promise.allSettled means one failure doesn't stop
    // the others or fail the request.
    const emailOpts = {
      to: email.trim(),
      ownerName: name.trim(),
      venueName: venueName.trim(),
      accessToken,
      citySlug: citySlug?.trim() || undefined,
      venueSlug: venueSlug?.trim() || undefined,
    }
    const emailResults = await Promise.allSettled([
      // Bespoke enquiries aren't a free-listing claim, so skip the
      // "your listing is ready" welcome/verification emails for them.
      isBespoke ? Promise.resolve() : sendWelcomeEmail(emailOpts),
      isBespoke || !verificationToken
        ? Promise.resolve()
        : sendVerificationEmail({ ...emailOpts, verificationToken }),
      sendAdminClaimNotification({
        claimantName: name.trim(),
        claimantEmail: email.trim(),
        venueName: venueName.trim(),
        venueAddress: venueAddress?.trim() || undefined,
        venuePhone: venuePhone?.trim() || undefined,
        venueWebsite: venueWebsite?.trim() || undefined,
        citySlug: citySlug?.trim() || undefined,
        venueSlug: venueSlug?.trim() || undefined,
        planInterest: isBespoke ? 'bespoke' : 'free',
        message: message?.trim() || undefined,
      }),
    ])
    const emailLabels = ['welcome email', 'verification email', 'admin notification']
    emailResults.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`[claims] ${emailLabels[i]}:`, r.reason)
    })

    return NextResponse.json({ success: true, token: accessToken })
  } catch (err) {
    console.error('[claims] API error:', err)
    return NextResponse.json(
      { error: 'Server error — please try again' },
      { status: 500 }
    )
  } finally {
    if (client) client.release()
  }
}
