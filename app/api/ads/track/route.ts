import { NextRequest, NextResponse } from 'next/server'
import { recordAdEvent } from '@/lib/ads/db'
import { isPlacementKey } from '@/lib/ads/placements'
import { cleanPath, clientIp, rateLimit, shouldCount } from '@/lib/ads/request'

/**
 * Impressions only (clicks are logged by the redirect in /api/ads/[id]/click).
 * The client sends this once an advert has been at least half visible for a
 * second — see components/ads/AdSlot.tsx. Always answers 204 so a failed
 * beacon is invisible to the visitor.
 */
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 })
  try {
    if (!shouldCount(req)) return done
    if (!rateLimit(`imp:${clientIp(req)}`, 120)) return done

    const body = await req.json().catch(() => null)
    const adId = Number(body?.adId)
    const placement = String(body?.placement ?? '')
    if (!Number.isInteger(adId) || adId <= 0 || !isPlacementKey(placement)) return done

    await recordAdEvent(adId, placement, 'impression', cleanPath(body?.path))
  } catch (err) {
    // FK violation (advert deleted while cached on a page) lands here too.
    console.error('[ads] track error:', err)
  }
  return done
}
