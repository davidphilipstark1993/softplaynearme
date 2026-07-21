import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'

// ── In-memory rate limiter: 30 saves per hour per token ──────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(token: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(token)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(token, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 30) return false
  entry.count++
  return true
}

// ── Validators ────────────────────────────────────────────────────────────────
function isValidTime(t: unknown): t is string {
  return typeof t === 'string' && /^\d{2}:\d{2}$/.test(t)
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function isValidUrl(u: unknown): boolean {
  if (!u || u === '') return true // optional fields
  if (typeof u !== 'string') return false
  return u.startsWith('https://') || u.startsWith('http://')
}

// ── New columns (idempotent) ──────────────────────────────────────────────────
const NEW_COLUMNS = [
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS session_pricing JSONB`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS photo_urls JSONB`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS special_notes TEXT`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS air_conditioning BOOLEAN DEFAULT false`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS party_rooms BOOLEAN DEFAULT false`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS food_served BOOLEAN DEFAULT false`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS changing_facilities BOOLEAN DEFAULT false`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS role_play_area BOOLEAN DEFAULT false`,
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  if (!checkRateLimit(token)) {
    return NextResponse.json(
      { error: 'Too many updates — please wait before saving again' },
      { status: 429 }
    )
  }

  let client
  try {
    client = await getPool().connect()

    // Validate token
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

    // Ensure new columns exist
    for (const sql of NEW_COLUMNS) {
      try { await client.query(sql) } catch { /* already exists */ }
    }

    const body = await request.json()
    const errors: string[] = []

    // ── Validate opening hours ───────────────────────────────────────────────
    if (body.opening_hours !== undefined) {
      if (typeof body.opening_hours !== 'object' || Array.isArray(body.opening_hours)) {
        errors.push('opening_hours must be an object')
      } else {
        for (const [day, val] of Object.entries(body.opening_hours as Record<string, unknown>)) {
          if (val === null) continue
          if (typeof val !== 'object' || Array.isArray(val)) {
            errors.push(`opening_hours.${day}: must be null or {open, close}`)
            continue
          }
          const { open, close } = val as Record<string, unknown>
          if (!isValidTime(open)) errors.push(`opening_hours.${day}.open: must be HH:MM`)
          if (!isValidTime(close)) errors.push(`opening_hours.${day}.close: must be HH:MM`)
          if (isValidTime(open) && isValidTime(close) && timeToMinutes(open) >= timeToMinutes(close)) {
            errors.push(`Opening hours for ${day}: open time must be before close time`)
          }
        }
      }
    }

    // ── Validate prices ──────────────────────────────────────────────────────
    if (body.price_from !== undefined && body.price_from !== '') {
      const n = parseFloat(body.price_from)
      if (isNaN(n) || n < 0) errors.push('Price from must be a positive number')
    }
    if (body.price_to !== undefined && body.price_to !== '') {
      const n = parseFloat(body.price_to)
      if (isNaN(n) || n < 0) errors.push('Price to must be a positive number')
    }

    // ── Validate URLs ────────────────────────────────────────────────────────
    if (body.website && !isValidUrl(body.website)) {
      errors.push('Website must start with https://')
    }
    if (body.main_image_url && !isValidUrl(body.main_image_url)) {
      errors.push('Main image URL must start with https://')
    }

    // ── Validate session pricing ─────────────────────────────────────────────
    if (body.session_pricing !== undefined) {
      if (!Array.isArray(body.session_pricing)) {
        errors.push('session_pricing must be an array')
      } else {
        for (let i = 0; i < body.session_pricing.length; i++) {
          const s = body.session_pricing[i] as Record<string, unknown>
          if (!s || typeof s !== 'object') { errors.push(`session_pricing[${i}]: invalid`); continue }
          if (s.price_from !== undefined && s.price_from !== '' && (isNaN(parseFloat(String(s.price_from))) || parseFloat(String(s.price_from)) < 0)) {
            errors.push(`Session ${i + 1}: price from must be a positive number`)
          }
          if (s.price_to !== undefined && s.price_to !== '' && (isNaN(parseFloat(String(s.price_to))) || parseFloat(String(s.price_to)) < 0)) {
            errors.push(`Session ${i + 1}: price to must be a positive number`)
          }
        }
      }
    }

    // ── Validate photo URLs ──────────────────────────────────────────────────
    if (body.photo_urls !== undefined) {
      if (!Array.isArray(body.photo_urls)) {
        errors.push('photo_urls must be an array')
      } else {
        const photos = body.photo_urls as unknown[]
        for (let i = 0; i < Math.min(photos.length, 10); i++) {
          if (photos[i] && !isValidUrl(photos[i])) {
            errors.push(`Photo ${i + 1}: URL must start with https://`)
          }
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 422 })
    }

    // ── Build UPDATE ─────────────────────────────────────────────────────────
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
    if (body.phone !== undefined) set('phone', String(body.phone).slice(0, 30) || null)
    if (body.website !== undefined) set('website', String(body.website).slice(0, 300) || null)
    if (body.description !== undefined) set('description', String(body.description).slice(0, 3000))
    if (body.special_notes !== undefined) set('special_notes', String(body.special_notes).slice(0, 1000) || null)

    // Pricing
    if (body.price_from !== undefined) set('price_from', body.price_from === '' ? null : parseFloat(body.price_from))
    if (body.price_to !== undefined) set('price_to', body.price_to === '' ? null : parseFloat(body.price_to))
    if (body.price_range !== undefined) set('price_range', String(body.price_range).slice(0, 100) || null)
    if (Array.isArray(body.session_pricing)) {
      const sessions = (body.session_pricing as Record<string, unknown>[])
        .slice(0, 20)
        .map((s) => ({
          type: String(s.type ?? '').slice(0, 100),
          price_from: s.price_from === '' || s.price_from === undefined ? null : parseFloat(String(s.price_from)),
          price_to: s.price_to === '' || s.price_to === undefined ? null : parseFloat(String(s.price_to)),
          description: String(s.description ?? '').slice(0, 300),
        }))
      set('session_pricing', JSON.stringify(sessions))
    }

    // All 14 facilities
    for (const col of [
      'cafe', 'parking', 'parties', 'toddler_area', 'baby_area',
      'sen_friendly', 'wheelchair_access', 'free_wifi', 'has_outdoor_play',
      'air_conditioning', 'party_rooms', 'food_served', 'changing_facilities', 'role_play_area',
    ]) {
      if (col in body) set(col, Boolean(body[col]))
    }

    // Opening hours
    if (body.opening_hours !== undefined && typeof body.opening_hours === 'object') {
      set('opening_hours', JSON.stringify(body.opening_hours))
    }

    // Photos
    if (body.main_image_url !== undefined) {
      set('main_image_url', String(body.main_image_url).trim() || null)
    }
    if (Array.isArray(body.photo_urls)) {
      const urls = (body.photo_urls as unknown[])
        .slice(0, 10)
        .filter((u): u is string => typeof u === 'string' && u.trim() !== '')
        .map((u) => u.trim())
      set('photo_urls', JSON.stringify(urls))
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
