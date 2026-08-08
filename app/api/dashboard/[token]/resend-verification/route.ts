import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { sendVerificationEmail } from '@/lib/email'

// ── In-memory rate limiter: 3 resends per hour per token ────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(token: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(token)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(token, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 3) return false
  entry.count++
  return true
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  if (!checkRateLimit(token)) {
    return NextResponse.json(
      { error: 'Too many requests — please wait before trying again' },
      { status: 429 }
    )
  }

  let client
  try {
    client = await getPool().connect()

    const result = await client.query(
      `SELECT name, email, venue_name, verification_token, email_verified, access_token
       FROM venue_claims WHERE access_token = $1 LIMIT 1`,
      [token]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    const claim = result.rows[0]
    if (claim.email_verified) {
      return NextResponse.json({ error: 'Email is already verified' }, { status: 400 })
    }
    if (!claim.verification_token) {
      return NextResponse.json({ error: 'No verification token on file — contact support' }, { status: 400 })
    }

    await sendVerificationEmail({
      to: claim.email,
      ownerName: claim.name,
      venueName: claim.venue_name,
      verificationToken: claim.verification_token,
      accessToken: claim.access_token,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Resend verification error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
