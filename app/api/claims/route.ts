import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { sendWelcomeEmail, sendVerificationEmail, sendAdminClaimNotification } from '@/lib/email'

export async function POST(request: NextRequest) {
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

    // Schema setup — each statement is individually non-fatal so a DDL permission
    // error or pre-existing column never kills the request.
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
      `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_address TEXT`,
      `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_phone VARCHAR(30)`,
      `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_website VARCHAR(500)`,
      `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS access_token UUID UNIQUE DEFAULT gen_random_uuid()`,
      `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS verification_token UUID UNIQUE DEFAULT gen_random_uuid()`,
      `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`,
    ]

    for (const sql of schemaSql) {
      try { await client.query(sql) } catch (e) {
        console.warn('[claims] Schema step skipped:', (e as Error).message?.slice(0, 120))
      }
    }

    const result = await client.query(
      `INSERT INTO venue_claims
         (name, email, venue_name, venue_address, venue_phone, venue_website,
          city_slug, venue_slug, venue_url, proof, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING access_token,
                 COALESCE(verification_token::text, '') AS verification_token`,
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
        '',
        '',
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
      sendWelcomeEmail(emailOpts),
      verificationToken
        ? sendVerificationEmail({ ...emailOpts, verificationToken })
        : Promise.resolve(),
      sendAdminClaimNotification({
        claimantName: name.trim(),
        claimantEmail: email.trim(),
        venueName: venueName.trim(),
        venueAddress: venueAddress?.trim() || undefined,
        venuePhone: venuePhone?.trim() || undefined,
        venueWebsite: venueWebsite?.trim() || undefined,
        citySlug: citySlug?.trim() || undefined,
        venueSlug: venueSlug?.trim() || undefined,
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
