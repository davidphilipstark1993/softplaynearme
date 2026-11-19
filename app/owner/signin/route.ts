import { NextRequest, NextResponse } from 'next/server'
import { consumeLoginToken } from '@/lib/claims/db'
import { createSessionValue, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/claims/tokens'
import { revalidateVenue } from '@/lib/claims/session'

/** A sign-in link lands here: use the token once, set the session, go to the dashboard. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? ''
  const result = token ? await consumeLoginToken(token).catch(() => null) : null
  if (!result) return NextResponse.redirect(new URL('/owner/login?expired=1', req.url))
  const session = createSessionValue(result.claim.id)
  if (!session) return NextResponse.redirect(new URL('/owner/login?error=config', req.url))
  if (result.justVerified) revalidateVenue(result.claim.city_slug, result.claim.venue_slug)
  const dest = new URL(result.justVerified ? '/owner/dashboard?welcome=1' : '/owner/dashboard', req.url)
  const res = NextResponse.redirect(dest)
  res.cookies.set(SESSION_COOKIE, session, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_MS / 1000 })
  return res
}
