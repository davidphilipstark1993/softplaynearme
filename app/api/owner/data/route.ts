import { NextRequest, NextResponse } from 'next/server'
import { getSessionClaim, revalidateVenue } from '@/lib/claims/session'
import { isVerifiedClaim, getOwnerData, saveOwnerData, photoLimitFor } from '@/lib/claims/db'
import { validateOwnerData, ownerCompleteness } from '@/lib/ownerData'

export async function GET() {
  const claim = await getSessionClaim()
  if (!claim) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const data = await getOwnerData(claim.venue_id)
  return NextResponse.json({ data: data ?? {}, completeness: ownerCompleteness(data), verified: isVerifiedClaim(claim) })
}

/** Save owner fields: verified claims only. Goes live at once, is logged, and refreshes the page. */
export async function POST(req: NextRequest) {
  const claim = await getSessionClaim()
  if (!claim) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (!isVerifiedClaim(claim) || !claim.venue_id) {
    return NextResponse.json({ error: "Your claim is still being checked. You'll be able to edit once it's verified (usually within 1 working day)." }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { data, errors } = validateOwnerData(body as Record<string, unknown>)
  if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 422 })
  const limit = await photoLimitFor(claim.venue_id)
  if ((data.photos?.length ?? 0) > limit) {
    return NextResponse.json({ error: `You can add up to ${limit} photos${limit < 12 ? ' on the free plan (Premium allows 12)' : ''}.` }, { status: 422 })
  }
  try {
    const changed = await saveOwnerData(claim.venue_id, data, `claim:${claim.id}`, claim.id)
    if (changed.length) revalidateVenue(claim.city_slug, claim.venue_slug)
    const fresh = await getOwnerData(claim.venue_id)
    return NextResponse.json({ ok: true, changed, completeness: ownerCompleteness(fresh) })
  } catch (err) {
    console.error('[owner/data]', err)
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }
}
