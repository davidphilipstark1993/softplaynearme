import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  let client
  try {
    client = await getPool().connect()

    // Validate token and get claim
    const claimResult = await client.query(
      `SELECT city_slug, venue_slug FROM venue_claims WHERE access_token = $1 LIMIT 1`,
      [token]
    )
    if (claimResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    const { city_slug, venue_slug } = claimResult.rows[0]
    if (!city_slug || !venue_slug) {
      return NextResponse.json({ error: 'No venue linked to this claim yet' }, { status: 400 })
    }

    const body = await request.json()

    // Only update safe, whitelisted fields
    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    function set(col: string, val: unknown) {
      updates.push(`${col} = $${idx++}`)
      values.push(val)
    }

    // Basic info
    if (body.name !== undefined) set('name', String(body.name).slice(0, 255))
    if (body.address !== undefined) set('address', String(body.address).slice(0, 500))
    if (body.postcode !== undefined) set('postcode', String(body.postcode).slice(0, 10).toUpperCase())
    if (body.phone !== undefined) set('phone', String(body.phone).slice(0, 30))
    if (body.website !== undefined) set('website', String(body.website).slice(0, 300))
    if (body.description !== undefined) set('description', String(body.description).slice(0, 3000))

    // Pricing
    if (body.price_from !== undefined) set('price_from', body.price_from === '' ? null : parseFloat(body.price_from))
    if (body.price_to !== undefined) set('price_to', body.price_to === '' ? null : parseFloat(body.price_to))
    if (body.price_range !== undefined) set('price_range', String(body.price_range).slice(0, 100))

    // Facilities (boolean)
    for (const col of [
      'cafe', 'parking', 'parties', 'toddler_area', 'baby_area',
      'sen_friendly', 'wheelchair_access', 'free_wifi', 'has_outdoor_play',
    ]) {
      if (col in body) set(col, Boolean(body[col]))
    }

    // Opening hours (validated as JSONB-safe object)
    if (body.opening_hours !== undefined && typeof body.opening_hours === 'object') {
      set('opening_hours', JSON.stringify(body.opening_hours))
    }

    // Photo URL (main image)
    if (body.main_image_url !== undefined) {
      const url = String(body.main_image_url).trim()
      set('main_image_url', url || null)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    set('updated_at', new Date().toISOString())
    values.push(city_slug, venue_slug)

    await client.query(
      `UPDATE venues SET ${updates.join(', ')}
       WHERE city_slug = $${idx++} AND slug = $${idx++}`,
      values
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Dashboard update error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
