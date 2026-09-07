import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { sendMonthlyInsightsEmail } from '@/lib/email'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.softplaynearme.co.uk'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

/**
 * Monthly insights email for active Premium/Bespoke venues — dry-run by
 * default (returns the recipient list without sending), pass
 * ?commit=true to actually send. This is a one-way email to real venue
 * owners, so always review the dry-run list first.
 */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const commit = req.nextUrl.searchParams.get('commit') === 'true'

  let client
  try {
    client = await getPool().connect()

    const result = await client.query(`
      SELECT DISTINCT ON (v.id)
        v.id, v.name AS venue_name, v.slug, v.city_slug,
        c.name AS owner_name, c.email AS owner_email, c.access_token
      FROM venues v
      JOIN venue_claims c ON c.city_slug = v.city_slug AND c.venue_slug = v.slug
      WHERE v.claimed_by_owner = true
        AND v.plan IN ('premium', 'bespoke')
        AND v.plan_status = 'active'
        AND c.email IS NOT NULL
      ORDER BY v.id, c.created_at DESC
    `)

    const recipients = []
    for (const row of result.rows) {
      const [eventsResult, leadsResult] = await Promise.all([
        client.query(
          `SELECT
             COUNT(*) FILTER (WHERE event_type = 'view' AND created_at >= NOW() - INTERVAL '30 days') AS views,
             COUNT(*) FILTER (WHERE event_type LIKE 'click_%' AND created_at >= NOW() - INTERVAL '30 days') AS clicks,
             COUNT(*) FILTER (WHERE event_type = 'view' AND created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS views_prev,
             COUNT(*) FILTER (WHERE event_type LIKE 'click_%' AND created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS clicks_prev
           FROM venue_page_events WHERE venue_id = $1`,
          [row.id]
        ),
        client.query(
          `SELECT
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS leads,
             COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS leads_prev
           FROM venue_enquiries WHERE venue_id = $1`,
          [row.id]
        ),
      ])
      const ev = eventsResult.rows[0]
      const ld = leadsResult.rows[0]
      const stats = {
        views: Number(ev?.views ?? 0),
        clicks: Number(ev?.clicks ?? 0),
        leads: Number(ld?.leads ?? 0),
        viewsPrev: Number(ev?.views_prev ?? 0),
        clicksPrev: Number(ev?.clicks_prev ?? 0),
        leadsPrev: Number(ld?.leads_prev ?? 0),
      }

      recipients.push({
        venueName: row.venue_name,
        ownerEmail: row.owner_email,
        ...stats,
      })

      if (commit) {
        await sendMonthlyInsightsEmail({
          to: row.owner_email,
          ownerName: row.owner_name,
          venueName: row.venue_name,
          dashboardUrl: `${BASE_URL}/dashboard/${row.access_token}`,
          ...stats,
        })
      }
    }

    return NextResponse.json({ commit, count: recipients.length, recipients })
  } catch (err) {
    console.error('[admin/insights/monthly] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
