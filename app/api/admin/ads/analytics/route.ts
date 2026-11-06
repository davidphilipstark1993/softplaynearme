import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { isAdminRequest } from '@/lib/ads/request'

const RANGES = [7, 30, 90]

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const requested = Number(req.nextUrl.searchParams.get('days'))
  const days = RANGES.includes(requested) ? requested : 30
  const pool = getPool()
  // Whole UK days, so "last 7 days" matches what the owner sees on a calendar.
  const since = `(date_trunc('day', now() AT TIME ZONE 'Europe/London') - ($1::int - 1) * interval '1 day')`
  const sinceTs = `(${since} AT TIME ZONE 'Europe/London')`

  try {
    const [totals, byAd, byPlacement, byDay] = await Promise.all([
      pool.query(
        `SELECT count(*) FILTER (WHERE event_type='impression')::int AS impressions,
                count(*) FILTER (WHERE event_type='click')::int      AS clicks
           FROM ad_events WHERE created_at >= ${sinceTs}`,
        [days]
      ),
      pool.query(
        `SELECT a.id, a.title, a.status,
                count(e.*) FILTER (WHERE e.event_type='impression')::int AS impressions,
                count(e.*) FILTER (WHERE e.event_type='click')::int      AS clicks
           FROM ads a
           LEFT JOIN ad_events e ON e.ad_id = a.id AND e.created_at >= ${sinceTs}
          GROUP BY a.id
          ORDER BY impressions DESC, a.id`,
        [days]
      ),
      pool.query(
        `SELECT placement,
                count(*) FILTER (WHERE event_type='impression')::int AS impressions,
                count(*) FILTER (WHERE event_type='click')::int      AS clicks
           FROM ad_events WHERE created_at >= ${sinceTs}
          GROUP BY placement ORDER BY impressions DESC`,
        [days]
      ),
      pool.query(
        `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
                COALESCE(e.impressions, 0)::int AS impressions,
                COALESCE(e.clicks, 0)::int      AS clicks
           FROM generate_series(${since}::date, (now() AT TIME ZONE 'Europe/London')::date, interval '1 day') AS d(day)
           LEFT JOIN (
             SELECT (created_at AT TIME ZONE 'Europe/London')::date AS day,
                    count(*) FILTER (WHERE event_type='impression') AS impressions,
                    count(*) FILTER (WHERE event_type='click')      AS clicks
               FROM ad_events WHERE created_at >= ${sinceTs}
              GROUP BY 1
           ) e ON e.day = d.day::date
          ORDER BY d.day`,
        [days]
      ),
    ])

    return NextResponse.json({
      days,
      totals: totals.rows[0],
      byAd: byAd.rows,
      byPlacement: byPlacement.rows,
      byDay: byDay.rows,
    })
  } catch (err) {
    console.error('[admin/ads] analytics error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
