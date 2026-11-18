import { NextRequest, NextResponse } from 'next/server'
import { claimsForEmail, issueLoginToken } from '@/lib/claims/db'
import { sendOwnerSignInEmail } from '@/lib/email'

/** Email a fresh sign-in link to a returning owner. Always answers OK (no account lookup leak). */
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({ email: '' }))
  const address = String(email ?? '').trim().toLowerCase()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    try {
      const claim = (await claimsForEmail(address))[0]
      if (claim) {
        const token = await issueLoginToken(claim.id)
        await sendOwnerSignInEmail({
          to: claim.email, ownerName: claim.name, venueName: claim.venue_name,
          signInUrl: `https://www.softplaynearme.co.uk/owner/signin?token=${encodeURIComponent(token)}`,
        })
      }
    } catch (err) {
      console.error('[owner/request-link]', err)
    }
  }
  return NextResponse.json({ ok: true })
}
