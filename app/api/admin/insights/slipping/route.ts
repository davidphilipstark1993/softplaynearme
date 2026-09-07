import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { sendListingSlippingEmail } from '@/lib/email'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.softplaynearme.co.uk'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

/**
 * "Your listing could use some attention" nudge — claimed venues with a low
 * completeness score or stale last_verified_at. Only re-nudges a given
 * venue once every 30 days (last_slipping_reminder_at), so re-running this
 * doesn't spam the same owners. Dry-run by default, ?commit=true to send.
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const commit = req.nextUrl.searchParams.get('commit') === 'true'

  let client
  try {
    client = await getPool().connect()

    await client.query(`ALTER TABLE venues ADD COLUMN IF NOT EXISTS last_slipping_reminder_at TIMESTAMP`)

    const result = await client.query(`
      SELECT DISTINCT ON (v.id)
        v.id, v.name AS venue_name, v.slug, v.city_slug,
        COALESCE(v.completeness_score, 0) AS completeness_score,
        v.last_verified_at,
        v.plan, v.plan_status,
        c.name AS owner_name, c.email AS owner_email, c.access_token
      FROM venues v
      JOIN venue_claims c ON c.city_slug = v.city_slug AND c.venue_slug = v.slug
      WHERE v.claimed_by_owner = true
        AND c.email IS NOT NULL
        AND (v.last_slipping_reminder_at IS NULL OR v.last_slipping_reminder_at < NOW() - INTERVAL '30 days')
        AND (
          COALESCE(v.completeness_score, 0) < 60
          OR v.last_verified_at IS NULL
          OR v.last_verified_at < NOW() - INTERVAL '90 days'
        )
      ORDER BY v.id, c.created_at DESC
    `)

    const recipients = []
    for (const row of result.rows) {
      const daysSinceVerified = row.last_verified_at
        ? Math.floor((Date.now() - new Date(row.last_verified_at).getTime()) / 86400000)
        : null
      const isPaidActive = (row.plan === 'premium' || row.plan === 'bespoke') && row.plan_status === 'active'

      recipients.push({
        venueName: row.venue_name,
        ownerEmail: row.owner_email,
        completenessScore: row.completeness_score,
        daysSinceVerified,
      })

      if (commit) {
        await sendListingSlippingEmail({
          to: row.owner_email,
          ownerName: row.owner_name,
          venueName: row.venue_name,
          dashboardUrl: `${BASE_URL}/dashboard/${row.access_token}`,
          completenessScore: row.completeness_score,
          daysSinceVerified,
          isPaidActive,
        })
        await client.query(`UPDATE venues SET last_slipping_reminder_at = NOW() WHERE id = $1`, [row.id])
      }
    }

    return NextResponse.json({ commit, count: recipients.length, recipients })
  } catch (err) {
    console.error('[admin/insights/slipping] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
