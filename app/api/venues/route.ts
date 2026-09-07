import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { getBoundingBox, parseRadius } from '@/lib/geo'
import { isOpenNow } from '@/lib/utils'

export async function GET(request: NextRequest) {
  let client
  try {
    client = await getPool().connect()
    const searchParams = request.nextUrl.searchParams

    // Basic filters
    const city = searchParams.get('city')
    const filter = searchParams.get('filter')
    const filters = searchParams.get('filters')?.split(',').filter(Boolean) || []
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    // Location-based params
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const radius = parseRadius(searchParams.get('radius'))

    // Sorting
    const sort = searchParams.get('sort') || (lat && lng ? 'distance' : 'rating')

    const params: (string | number)[] = []
    const where: string[] = []
    let distanceSelect = ''
    let orderBy = ''

    // Handle location-based search
    const hasLocation = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))

    if (hasLocation) {
      const userLat = parseFloat(lat)
      const userLng = parseFloat(lng)

      // Add lat/lng as first params for distance calculation
      params.push(userLat)
      params.push(userLng)

      // Haversine distance formula in SQL
      distanceSelect = `,
        (3959 * acos(
          LEAST(1, GREATEST(-1,
            cos(radians($1)) * cos(radians(v.lat)) *
            cos(radians(v.lng) - radians($2)) +
            sin(radians($1)) * sin(radians(v.lat))
          ))
        )) as distance`

      // Use bounding box for initial filtering (more efficient)
      const bbox = getBoundingBox({ lat: userLat, lng: userLng }, radius)
      where.push(`v.lat BETWEEN ${bbox.minLat} AND ${bbox.maxLat}`)
      where.push(`v.lng BETWEEN ${bbox.minLng} AND ${bbox.maxLng}`)
    }

    // City filter
    if (city) {
      params.push(city)
      where.push(`v.city_slug = $${params.length}`)
    }

    // Single filter (legacy support)
    if (filter) {
      if (filter === 'toddler') where.push('v.toddler_area = true')
      else if (filter === 'under_1s') where.push('v.has_under_1s = true')
      else if (filter === 'parties') where.push('v.parties = true')
      else if (filter === 'sen') where.push('v.sen_friendly = true')
      else if (filter === 'outdoor') where.push('v.has_outdoor_play = true')
      else if (filter === 'cafe') where.push('v.cafe = true')
      else if (filter === 'parking') where.push('v.parking = true')
      else if (filter === 'wheelchair') where.push('v.wheelchair_access = true')
    }

    // Multiple filters
    if (filters.length > 0) {
      for (const f of filters) {
        if (f === 'toddler') where.push('v.toddler_area = true')
        else if (f === 'under_1s') where.push('v.has_under_1s = true')
        else if (f === 'parties') where.push('v.parties = true')
        else if (f === 'sen') where.push('v.sen_friendly = true')
        else if (f === 'outdoor') where.push('v.has_outdoor_play = true')
        else if (f === 'cafe') where.push('v.cafe = true')
        else if (f === 'parking') where.push('v.parking = true')
        else if (f === 'wheelchair') where.push('v.wheelchair_access = true')
        // Note: 'open_now' handled client-side after fetch
      }
    }

    // Text search
    if (search) {
      params.push(`%${search}%`)
      where.push(`(v.name ILIKE $${params.length} OR v.description ILIKE $${params.length})`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    // Sorting logic
    switch (sort) {
      case 'distance':
        orderBy = hasLocation ? 'distance ASC NULLS LAST' : 'v.name ASC'
        break
      case 'price_low':
        orderBy = 'v.price_from ASC NULLS LAST, v.name ASC'
        break
      case 'price_high':
        orderBy = 'v.price_to DESC NULLS LAST, v.name ASC'
        break
      case 'name':
        orderBy = 'v.name ASC'
        break
      case 'rating':
      default:
        orderBy = 'avg_rating DESC, review_count DESC, v.name ASC'
    }

    params.push(limit)
    const limitIdx = params.length

    const sql = `
      SELECT v.*,
             COALESCE(AVG(r.rating), 0) as avg_rating,
             COUNT(r.id) as review_count
             ${distanceSelect}
      FROM venues v
      LEFT JOIN reviews r ON r.venue_id = v.id AND r.approved = true
      ${whereSql}
      GROUP BY v.id
      ${hasLocation ? `HAVING (3959 * acos(LEAST(1, GREATEST(-1, cos(radians($1)) * cos(radians(v.lat)) * cos(radians(v.lng) - radians($2)) + sin(radians($1)) * sin(radians(v.lat)))))) <= ${radius}` : ''}
      ORDER BY (v.featured AND (v.featured_until IS NULL OR v.featured_until > NOW())) DESC, ${orderBy}
      LIMIT $${limitIdx}
    `

    const result = await client.query(sql, params)

    // Apply open_now filter client-side (requires parsing opening_hours)
    let venues = result.rows.map((v: any) => ({
      ...v,
      featured: !!v.featured && (!v.featured_until || new Date(v.featured_until) > new Date()),
    }))
    if (filters.includes('open_now')) {
      venues = venues.filter((v: any) => isOpenNow(v.opening_hours))
    }

    return NextResponse.json(venues)
  } catch (err: any) {
    console.error('Venues API error:', err)
    return NextResponse.json({ error: 'Database error', details: err?.message }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
