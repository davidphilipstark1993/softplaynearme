import { NextRequest, NextResponse } from 'next/server'
import { buildDestination, getAdById, recordAdEvent } from '@/lib/ads/db'
import { isPlacementKey } from '@/lib/ads/placements'
import { clientIp, cleanPath, rateLimit, shouldCount } from '@/lib/ads/request'

/**
 * Click tracking + outbound redirect. The advert's real destination never
 * appears in page HTML: the link points here, we log the click and 302 to the
 * stored URL with UTM parameters added. Redirecting by stored id (never by a
 * URL in the query string) means this can't be abused as an open redirect.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const adId = Number(id)
  const placementParam = req.nextUrl.searchParams.get('p') ?? ''
  const placement = isPlacementKey(placementParam) ? placementParam : 'unknown'
  const home = new URL('/', req.nextUrl.origin)

  const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }

  if (!Number.isInteger(adId) || adId <= 0) {
    return NextResponse.redirect(home, { status: 302, headers })
  }

  try {
    const ad = await getAdById(adId)
    if (!ad) return NextResponse.redirect(home, { status: 302, headers })

    // Counted even if the advert expired a moment ago on a cached page — the
    // visitor really did click it — but never for bots or the site owner.
    if (shouldCount(req) && rateLimit(`clk:${clientIp(req)}`, 60)) {
      const referer = req.headers.get('referer')
      let path: string | null = null
      try {
        if (referer) path = cleanPath(new URL(referer).pathname)
      } catch {}
      await recordAdEvent(adId, placement, 'click', path).catch((err) =>
        console.error('[ads] click log error:', err)
      )
    }

    return NextResponse.redirect(buildDestination(ad, placement), { status: 302, headers })
  } catch (err) {
    console.error('[ads] click error:', err)
    return NextResponse.redirect(home, { status: 302, headers })
  }
}
