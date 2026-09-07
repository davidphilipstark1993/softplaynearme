import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { sendRenewalReminderEmail } from '@/lib/email'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.softplaynearme.co.uk'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

/**
 * Annual-plan renewal reminder — only for billing_interval='year' venues
 * renewing in the next 7 days. Monthly subscribers aren't reminded (Stripe
 * just renews automatically each month; an email every 30 days would be
 * spam). Dry-run by default, ?commit=true to send.
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
        v.id, v.name AS venue_name, v.plan_renews_at,
        c.name AS owner_name, c.email AS owner_email, c.access_token
      FROM venues v
      JOIN venue_claims c ON c.city_slug = v.city_slug AND c.venue_slug = v.slug
      WHERE v.claimed_by_owner = true
        AND v.plan = 'premium'
        AND v.plan_status = 'active'
        AND v.billing_interval = 'year'
        AND v.plan_renews_at IS NOT NULL
        AND v.plan_renews_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
        AND c.email IS NOT NULL
      ORDER BY v.id, c.created_at DESC
    `)

    const recipients = result.rows.map((row) => ({
      venueName: row.venue_name,
      ownerEmail: row.owner_email,
      renewsAt: row.plan_renews_at,
    }))

    if (commit) {
      for (const row of result.rows) {
        await sendRenewalReminderEmail({
          to: row.owner_email,
          ownerName: row.owner_name,
          venueName: row.venue_name,
          dashboardUrl: `${BASE_URL}/dashboard/${row.access_token}`,
          renewsAt: row.plan_renews_at,
          amount: '£249',
        })
      }
    }

    return NextResponse.json({ commit, count: recipients.length, recipients })
  } catch (err) {
    console.error('[admin/insights/renewals] error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
