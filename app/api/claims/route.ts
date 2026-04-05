import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { sendWelcomeEmail } from '@/lib/email'

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

    try {
      client = await getPool().connect()

      // Create table with full schema (idempotent)
      await client.query(`
        CREATE TABLE IF NOT EXISTS venue_claims (
          id            SERIAL PRIMARY KEY,
          name          VARCHAR(120) NOT NULL,
          email         VARCHAR(160) NOT NULL,
          venue_name    VARCHAR(255) NOT NULL,
          venue_address TEXT,
          venue_phone   VARCHAR(30),
          venue_website VARCHAR(500),
          city_slug     VARCHAR(100),
          venue_slug    VARCHAR(255),
          venue_url     VARCHAR(500),
          proof         VARCHAR(500),
          message       TEXT,
          access_token  UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
          status        VARCHAR(30) DEFAULT 'pending',
          created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Idempotent migrations for existing installations
      for (const sql of [
        `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_address TEXT`,
        `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_phone VARCHAR(30)`,
        `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_website VARCHAR(500)`,
        `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS access_token UUID UNIQUE DEFAULT gen_random_uuid()`,
      ]) {
        try { await client.query(sql) } catch { /* column already exists */ }
      }

      const result = await client.query(
        `INSERT INTO venue_claims
           (name, email, venue_name, venue_address, venue_phone, venue_website,
            city_slug, venue_slug, venue_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING access_token`,
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

      const accessToken = result.rows[0].access_token as string

      // Fire-and-forget welcome email (doesn't block the response)
      sendWelcomeEmail({
        to: email.trim(),
        ownerName: name.trim(),
        venueName: venueName.trim(),
        accessToken,
        citySlug: citySlug?.trim() || undefined,
        venueSlug: venueSlug?.trim() || undefined,
      }).catch(console.error)

      return NextResponse.json({ success: true, token: accessToken })
    } finally {
      if (client) client.release()
    }
  } catch (err) {
    console.error('Claims API error:', err)
    return NextResponse.json({ error: 'Server error — please try again' }, { status: 500 })
  }
}
