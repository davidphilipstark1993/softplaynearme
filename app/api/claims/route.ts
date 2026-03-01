import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'

export async function POST(request: NextRequest) {
  let client
  try {
    const body = await request.json()
    const { name, email, venueName, proof, message } = body || {}

    if (!name || !email || !venueName || !proof || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    try {
      client = await getPool().connect()
      await client.query(`
        CREATE TABLE IF NOT EXISTS venue_claims (
          id SERIAL PRIMARY KEY,
          name VARCHAR(120) NOT NULL,
          email VARCHAR(160) NOT NULL,
          venue_name VARCHAR(255) NOT NULL,
          proof VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(30) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      await client.query(
        `INSERT INTO venue_claims (name, email, venue_name, proof, message)
         VALUES ($1, $2, $3, $4, $5)`,
        [name, email, venueName, proof, message]
      )
    } finally {
      if (client) client.release()
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
