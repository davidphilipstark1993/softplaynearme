import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'

export async function GET(request: NextRequest) {
  let client
  try {
    client = await getPool().connect()
    const searchParams = request.nextUrl.searchParams
    const city = searchParams.get('city')
    const filter = searchParams.get('filter')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    const params: (string | number)[] = []
    const where: string[] = []

    if (city) {
      params.push(city)
      where.push(`city_slug = $${params.length}`)
    }

    if (filter) {
      if (filter === 'toddler') where.push('toddler_area = true')
      else if (filter === 'parties') where.push('parties = true')
      else if (filter === 'sen') where.push('sen_friendly = true')
      else if (filter === 'cafe') where.push('cafe = true')
      else if (filter === 'parking') where.push('parking = true')
    }

    if (search) {
      params.push(`%${search}%`)
      where.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    params.push(limit)
    const limitIdx = params.length

    const sql = `
      SELECT v.*,
             COALESCE(AVG(r.rating), 0) as avg_rating,
             COUNT(r.id) as review_count
      FROM venues v
      LEFT JOIN reviews r ON r.venue_id = v.id AND r.approved = true
      ${whereSql}
      GROUP BY v.id
      ORDER BY avg_rating DESC, review_count DESC, v.name ASC
      LIMIT $${limitIdx}
    `

    const result = await client.query(sql, params)
    return NextResponse.json(result.rows)
  } catch (err: any) {
    return NextResponse.json({ error: 'Database error', details: err?.message }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
