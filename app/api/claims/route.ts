import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'

export async function POST(request: NextRequest) {
  let client
  try {
    const body = await request.json()
    const { name, email, venueName, proof, message, venueSlug, citySlug, venueUrl } = body || {}

    if (!name || !email || !venueName || !proof || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    try {
      client = await getPool().connect()

      // Ensure venue_claims table exists with the extended schema.
      // venue_slug / city_slug columns let us link a claim directly to a DB record.
      await client.query(`
        CREATE TABLE IF NOT EXISTS venue_claims (
          id SERIAL PRIMARY KEY,
          name VARCHAR(120) NOT NULL,
          email VARCHAR(160) NOT NULL,
          venue_name VARCHAR(255) NOT NULL,
          city_slug VARCHAR(100),
          venue_slug VARCHAR(255),
          venue_url VARCHAR(500),
          proof VARCHAR(500) NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(30) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Add columns if table already existed without them (idempotent)
      for (const col of [
        "ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS city_slug VARCHAR(100)",
        "ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_slug VARCHAR(255)",
        "ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_url VARCHAR(500)",
      ]) {
        try { await client.query(col) } catch { /* already exists */ }
      }

      await client.query(
        `INSERT INTO venue_claims (name, email, venue_name, city_slug, venue_slug, venue_url, proof, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          name.trim(),
          email.trim(),
          venueName.trim(),
          citySlug?.trim() || null,
          venueSlug?.trim() || null,
          venueUrl?.trim() || null,
          proof.trim(),
          message.trim(),
        ]
      )
    } finally {
      if (client) client.release()
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Claims API error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
