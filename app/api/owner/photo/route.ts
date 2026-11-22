import { NextRequest, NextResponse } from 'next/server'
import { getSessionClaim } from '@/lib/claims/session'
import { isVerifiedClaim } from '@/lib/claims/db'
import { uploadVenuePhoto } from '@/lib/venuePhotoUpload'

export const runtime = 'nodejs'

/** Upload one photo (see lib/venuePhotoUpload.ts). The owner then saves the list from the dashboard. */
export async function POST(req: NextRequest) {
  const claim = await getSessionClaim()
  if (!claim) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (!isVerifiedClaim(claim) || !claim.venue_id) return NextResponse.json({ error: 'Your claim is still being checked.' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  const result = await uploadVenuePhoto(claim.venue_id, form?.get('file'), 'owner')
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ url: result.url })
}
