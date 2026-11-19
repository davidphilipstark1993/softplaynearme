import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { adminQueues, recentEdits, revertEdit, getClaim, markVerified, rejectClaim, issueLoginToken } from '@/lib/claims/db'
import { revalidateVenue } from '@/lib/claims/session'
import { sendClaimApprovedEmail } from '@/lib/email'

const authed = (req: NextRequest) => verifyAdminSessionToken(req.cookies.get('admin_session')?.value)

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const [queues, edits] = await Promise.all([adminQueues(), recentEdits(100)])
    return NextResponse.json({ ...queues, edits })
  } catch (err) {
    console.error('[admin/owners]', err)
    return NextResponse.json({ error: 'Could not load (has phase15-01 been run?)' }, { status: 500 })
  }
}

/** { action: 'approve' | 'reject', claimId } or { action: 'revert', editId } */
export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const { action, claimId, editId } = await req.json().catch(() => ({}))
  try {
    if (action === 'revert') {
      const r = await revertEdit(Number(editId))
      if (!r) return NextResponse.json({ error: 'Edit not found or already reverted' }, { status: 404 })
      revalidateVenue(r.citySlug, r.slug)
      return NextResponse.json({ ok: true })
    }
    const claim = await getClaim(Number(claimId))
    if (!claim || !claim.venue_id) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    if (action === 'approve') {
      await markVerified(claim.id, claim.venue_id, 'admin')
      revalidateVenue(claim.city_slug, claim.venue_slug)
      const token = await issueLoginToken(claim.id)
      await sendClaimApprovedEmail({
        to: claim.email, ownerName: claim.name, venueName: claim.venue_name,
        signInUrl: `https://www.softplaynearme.co.uk/owner/signin?token=${encodeURIComponent(token)}`,
      }).catch((e) => console.error('[admin/owners] approved email failed', e))
      return NextResponse.json({ ok: true })
    }
    if (action === 'reject') {
      await rejectClaim(claim.id, 'admin')
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[admin/owners]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
