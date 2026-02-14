import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { addStoredReview, getStoredReviews } from '@/lib/reviewsStore'

export async function GET(request: NextRequest) {
  let client
  try {
    client = await getPool().connect()
    const venueId = request.nextUrl.searchParams.get('venueId')
    const citySlug = request.nextUrl.searchParams.get('citySlug')
    const venueSlug = request.nextUrl.searchParams.get('venueSlug')

    if (!venueId && !(citySlug && venueSlug)) {
      return NextResponse.json({ error: 'venueId or citySlug+venueSlug required' }, { status: 400 })
    }

    let result
    if (venueId) {
      result = await client.query(
        'SELECT * FROM reviews WHERE venue_id = $1 AND approved = true ORDER BY created_at DESC',
        [venueId]
      )
    } else {
      result = await client.query(
        `SELECT r.*
         FROM reviews r
         INNER JOIN venues v ON v.id = r.venue_id
         WHERE v.city_slug = $1 AND v.slug = $2 AND r.approved = true
         ORDER BY r.created_at DESC`,
        [citySlug, venueSlug]
      )
    }

    return NextResponse.json(result.rows)
  } catch {
    const venueId = Number(request.nextUrl.searchParams.get('venueId') || '')
    const citySlug = request.nextUrl.searchParams.get('citySlug') || undefined
    const venueSlug = request.nextUrl.searchParams.get('venueSlug') || undefined
    const rows = await getStoredReviews({
      venueId: Number.isFinite(venueId) && venueId > 0 ? venueId : undefined,
      citySlug,
      venueSlug,
    })
    return NextResponse.json(rows)
  } finally {
    if (client) client.release()
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { venueId, citySlug, venueSlug, reviewerName, reviewerEmail, rating, comment } = body
  let client
  try {
    client = await getPool().connect()

    if ((!venueId && !(citySlug && venueSlug)) || !reviewerName || !rating || !comment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (venueId) {
      await client.query(
        `INSERT INTO reviews (venue_id, reviewer_name, reviewer_email, rating, comment, approved)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [venueId, reviewerName, reviewerEmail || null, rating, comment]
      )
    } else {
      const venueResult = await client.query(
        'SELECT id FROM venues WHERE city_slug = $1 AND slug = $2 LIMIT 1',
        [citySlug, venueSlug]
      )
      if (!venueResult.rows[0]) {
        return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
      }
      await client.query(
        `INSERT INTO reviews (venue_id, reviewer_name, reviewer_email, rating, comment, approved)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [venueResult.rows[0].id, reviewerName, reviewerEmail || null, rating, comment]
      )
    }

    return NextResponse.json({ success: true, message: 'Review submitted for moderation' })
  } catch {
    if (!(citySlug && venueSlug) || !reviewerName || !rating || !comment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await addStoredReview({
      venueId: Number.isFinite(Number(venueId)) ? Number(venueId) : undefined,
      citySlug,
      venueSlug,
      reviewerName,
      reviewerEmail,
      rating: Number(rating),
      comment,
      approved: true,
    })
    return NextResponse.json({ success: true, message: 'Review submitted successfully' })
  } finally {
    if (client) client.release()
  }
}
