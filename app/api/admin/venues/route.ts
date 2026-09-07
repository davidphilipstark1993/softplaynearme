import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { verifyAdminSessionToken } from '@/lib/adminAuth'

const PLANS = new Set(['free', 'premium', 'bespoke'])
const PLAN_STATUSES = new Set(['inactive', 'active', 'trialing', 'past_due', 'cancelled'])
const PAGE_SIZE = 50

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const search = req.nextUrl.searchParams.get('search')?.trim() || ''
  const city = req.nextUrl.searchParams.get('city')?.trim() || ''
  const needsReviewOnly = req.nextUrl.searchParams.get('needsReview') === 'true'
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10) || 1)

  let client
  try {
    client = await getPool().connect()

    const where: string[] = []
    const params: unknown[] = []

    if (search) {
      params.push(`%${search}%`)
      where.push(`name ILIKE $${params.length}`)
    }
    if (city) {
      params.push(city)
      where.push(`city_slug = $${params.length}`)
    }
    if (needsReviewOnly) {
      where.push(`needs_review = true`)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const countResult = await client.query(
      `SELECT COUNT(*)::int AS total FROM venues ${whereSql}`,
      params
    )
    const total = countResult.rows[0]?.total ?? 0

    params.push(PAGE_SIZE, (page - 1) * PAGE_SIZE)
    const result = await client.query(
      `SELECT id, name, city_slug, slug, claimed_by_owner, featured, featured_until,
              plan, plan_status, plan_started_at, ad_placements,
              COALESCE(needs_review, false) AS needs_review
       FROM venues
       ${whereSql}
       ORDER BY name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    return NextResponse.json({ venues: result.rows, total, page, pageSize: PAGE_SIZE })
  } catch (err) {
    console.error('[admin/venues] GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, plan, planStatus, featured, featuredUntil, adPlacements, needsReview } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'Missing venue id' }, { status: 400 })
  }
  if (plan !== undefined && !PLANS.has(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }
  if (planStatus !== undefined && !PLAN_STATUSES.has(planStatus)) {
    return NextResponse.json({ error: 'Invalid plan status' }, { status: 400 })
  }

  let client
  try {
    client = await getPool().connect()

    if (plan === 'premium' || plan === 'bespoke') {
      const venueResult = await client.query(
        `SELECT claimed_by_owner FROM venues WHERE id = $1 LIMIT 1`,
        [id]
      )
      if (venueResult.rows.length === 0) {
        return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
      }
      if (!venueResult.rows[0].claimed_by_owner) {
        return NextResponse.json(
          { error: 'Only claimed venues can be put on a paid plan' },
          { status: 400 }
        )
      }
    }

    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1
    function set(col: string, val: unknown) {
      updates.push(`${col} = $${idx++}`)
      values.push(val)
    }

    if (plan !== undefined) set('plan', plan)
    if (planStatus !== undefined) {
      set('plan_status', planStatus)
      if (planStatus === 'active') {
        updates.push(`plan_started_at = COALESCE(plan_started_at, CURRENT_TIMESTAMP)`)
      }
    }
    if (featured !== undefined) set('featured', Boolean(featured))
    if (featuredUntil !== undefined) set('featured_until', featuredUntil || null)
    if (adPlacements !== undefined) set('ad_placements', JSON.stringify(adPlacements))
    if (needsReview !== undefined) set('needs_review', Boolean(needsReview))

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    values.push(id)
    await client.query(`UPDATE venues SET ${updates.join(', ')} WHERE id = $${idx}`, values)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/venues] PATCH error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Manually add a venue an admin has vetted themselves — lands with needs_review=false, unlike the scraper pipeline. */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { name, citySlug, address, postcode, phone, website } = await req.json()
  if (!name?.trim() || !citySlug?.trim()) {
    return NextResponse.json({ error: 'Venue name and city are required' }, { status: 400 })
  }

  let client
  try {
    client = await getPool().connect()

    const baseSlug = toSlug(name.trim())
    if (!baseSlug) {
      return NextResponse.json({ error: 'Could not generate a URL slug from that name' }, { status: 400 })
    }
    let slug = baseSlug
    let suffix = 2
    while (true) {
      const clash = await client.query(
        `SELECT 1 FROM venues WHERE city_slug = $1 AND slug = $2 LIMIT 1`,
        [citySlug.trim(), slug]
      )
      if (clash.rows.length === 0) break
      slug = `${baseSlug}-${suffix++}`
    }

    const result = await client.query(
      `INSERT INTO venues (name, slug, city_slug, address, postcode, phone, website, needs_review)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING id, slug`,
      [
        name.trim(),
        slug,
        citySlug.trim(),
        address?.trim() || null,
        postcode?.trim()?.toUpperCase() || null,
        phone?.trim() || null,
        website?.trim() || null,
      ]
    )

    return NextResponse.json({ success: true, id: result.rows[0].id, slug: result.rows[0].slug })
  } catch (err) {
    console.error('[admin/venues] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
