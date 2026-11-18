import { NextRequest, NextResponse } from 'next/server'
import { checkEmailAgainstWebsite } from '@/lib/claims/domain'
import { hashIp } from '@/lib/claims/tokens'
import { getVenueForClaim, hasVerifiedOwner, recentClaimCounts, createClaim, issueLoginToken } from '@/lib/claims/db'
import { sendOwnerSignInEmail, sendAdminClaimReviewEmail } from '@/lib/email'

const BASE = 'https://www.softplaynearme.co.uk'
const MAX_PER_IP_PER_HOUR = 5
const MAX_PER_VENUE_PER_DAY = 3
const REASONS: Record<string, string> = {
  webmail: 'webmail address',
  'no-website': 'no website on file to match',
  'platform-website': 'venue website is on a shared platform',
  'different-domain': "email domain doesn't match the venue website",
  'existing-owner': 'venue already has a verified owner',
}

/**
 * Claim a listing. Always sends a single-use sign-in link to confirm the address. An email
 * on the venue's own website domain is verified when the link is used; anything else
 * (webmail, other domains, a venue that already has an owner) goes to manual review.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const name = String(body.name ?? '').trim().slice(0, 120)
  const role = String(body.role ?? '').trim().slice(0, 60)
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 160)
  const citySlug = String(body.citySlug ?? '')
  const slug = String(body.slug ?? '')
  if (!name || !role || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter your name, your role and a valid email address.' }, { status: 400 })
  }
  // Honeypot: real people never fill the hidden "company" field.
  if (String(body.company ?? '').trim()) return NextResponse.json({ ok: true, method: 'manual_review' })

  try {
    const venue = await getVenueForClaim(citySlug, slug)
    if (!venue) return NextResponse.json({ error: 'We could not find that venue.' }, { status: 404 })

    const ipHash = hashIp(req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip'))
    const counts = await recentClaimCounts(ipHash, venue.id)
    if (counts.ip >= MAX_PER_IP_PER_HOUR || counts.venue >= MAX_PER_VENUE_PER_DAY) {
      return NextResponse.json({ error: 'Too many claims just now. Please try again later or email hello@softplaynearme.co.uk.' }, { status: 429 })
    }

    const domain = checkEmailAgainstWebsite(email, venue.website)
    const existingOwner = await hasVerifiedOwner(venue.id)
    const method = domain.match && !existingOwner ? 'domain_email' : 'manual_review'
    const reason = existingOwner ? 'existing-owner' : 'reason' in domain ? domain.reason : ''

    const claim = await createClaim({ venue, name, email, role, method, ipHash })
    const token = await issueLoginToken(claim.id)
    const signInUrl = `${BASE}/owner/signin?token=${encodeURIComponent(token)}`
    const sends = [sendOwnerSignInEmail({ to: email, ownerName: name, venueName: venue.name, signInUrl, pendingReview: method === 'manual_review' })]
    if (method === 'manual_review') {
      sends.push(sendAdminClaimReviewEmail({
        claimantName: name, claimantEmail: email, role, venueName: venue.name,
        venueUrl: `${BASE}/soft-play/${venue.city_slug}/${venue.slug}`, website: venue.website, reason: REASONS[reason] ?? reason,
      }))
    }
    const results = await Promise.allSettled(sends)
    results.forEach((r) => r.status === 'rejected' && console.error('[owner/claim] email failed:', r.reason))
    return NextResponse.json({ ok: true, method })
  } catch (err) {
    console.error('[owner/claim]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
