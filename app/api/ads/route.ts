import { NextRequest, NextResponse } from 'next/server'
import { getActiveAds } from '@/lib/ads/db'
import { isPlacementKey } from '@/lib/ads/placements'

/**
 * Public: the adverts eligible for one placement right now. Pages are
 * prerendered/ISR, so <AdSlot> fetches this client-side — that is what lets an
 * advert go live, expire or be paused within about a minute with no redeploy.
 * Inactive, scheduled-for-later and expired adverts never leave the database.
 */
export async function GET(req: NextRequest) {
  const placement = req.nextUrl.searchParams.get('placement') ?? ''
  const city = req.nextUrl.searchParams.get('city')
  if (!isPlacementKey(placement)) {
    return NextResponse.json({ ads: [] }, { status: 400 })
  }
  const citySlug = city && /^[a-z0-9-]{1,60}$/.test(city) ? city : null

  try {
    const ads = await getActiveAds(placement, citySlug)
    return NextResponse.json(
      { ads },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch (err) {
    // A database outage must never break a page — slots just stay empty.
    console.error('[ads] GET error:', err)
    return NextResponse.json({ ads: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
