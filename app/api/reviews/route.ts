import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'

export async function GET(request: NextRequest) {
  let client
  try {
    client = await getPool().connect()
    const venueId = request.nextUrl.searchParams.get('venueId')

    if (!venueId) {
      return NextResponse.json({ error: 'venueId required' }, { status: 400 })
    }

    const result = await client.query(
      'SELECT * FROM reviews WHERE venue_id = $1 AND approved = true ORDER BY created_at DESC',
      [venueId]
    )

    return NextResponse.json(result.rows)
  } catch (err: any) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

export async function POST(request: NextRequest) {
  let client
  try {
    client = await getPool().connect()
    const body = await request.json()
    const { venueId, reviewerName, reviewerEmail, rating, comment } = body

    if (!venueId || !reviewerName || !rating || !comment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await client.query(
      `INSERT INTO reviews (venue_id, reviewer_name, reviewer_email, rating, comment, approved)
       VALUES ($1, $2, $3, $4, $5, false)`,
      [venueId, reviewerName, reviewerEmail || null, rating, comment]
    )

    return NextResponse.json({ success: true, message: 'Review submitted for moderation' })
  } catch (err: any) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
