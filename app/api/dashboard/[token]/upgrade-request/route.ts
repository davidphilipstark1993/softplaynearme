import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { sendUpgradeRequestNotification } from '@/lib/email'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.softplaynearme.co.uk'

// ── In-memory rate limiter: 3 requests per hour per token ───────────────────
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
  req: NextRequest,
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

  const body = await req.json().catch(() => ({}))
  const requestedPlan = body?.plan === 'bespoke' ? 'bespoke' : 'premium'

  let client
  try {
    client = await getPool().connect()

    const claimResult = await client.query(
      `SELECT name, email, venue_name, city_slug, venue_slug FROM venue_claims WHERE access_token = $1 LIMIT 1`,
      [token]
    )
    if (claimResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }
    const claim = claimResult.rows[0]

    await sendUpgradeRequestNotification({
      venueName: claim.venue_name,
      ownerName: claim.name,
      ownerEmail: claim.email,
      requestedPlan,
      dashboardUrl: `${BASE_URL}/dashboard/${token}`,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Upgrade request error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
