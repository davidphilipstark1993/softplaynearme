import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { isAdminRequest } from '@/lib/ads/request'
import { listAdsForAdmin } from '@/lib/ads/db'
import { adInputSchema, firstIssue } from '@/lib/ads/validation'
import { cities } from '@/lib/venues'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const ads = await listAdsForAdmin()
    return NextResponse.json({
      ads,
      cities: cities.map((c) => ({ slug: c.slug, name: c.name })),
    })
  } catch (err) {
    console.error('[admin/ads] GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const parsed = adInputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 422 })
  const a = parsed.data

  try {
    const { rows } = await getPool().query(
      `INSERT INTO ads (title, description, cta_text, destination_url, image_url, image_alt,
                        advertiser_name, advertiser_type, utm_campaign, status, starts_at, ends_at,
                        priority, placements, city_slugs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [a.title, a.description, a.ctaText, a.destinationUrl, a.imageUrl, a.imageAlt, a.advertiserName,
       a.advertiserType, a.utmCampaign, a.status, a.startsAt, a.endsAt, a.priority, a.placements, a.citySlugs]
    )
    return NextResponse.json({ id: rows[0].id }, { status: 201 })
  } catch (err) {
    console.error('[admin/ads] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
