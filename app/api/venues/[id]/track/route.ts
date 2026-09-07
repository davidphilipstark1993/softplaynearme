import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'

const EVENT_TYPES = new Set(['view', 'click_call', 'click_directions', 'click_website'])

/**
 * First-party event log backing the dashboard Insights card and monthly
 * insights email (Phase 5) — see scripts/migrateInsights.mjs for why this
 * exists instead of pulling from GA4. Fire-and-forget from the client via
 * sendBeacon, so this must never throw in a way that blocks navigation —
 * errors are swallowed after logging.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const venueId = parseInt(id, 10)
  if (!venueId || isNaN(venueId)) {
    return NextResponse.json({ error: 'Invalid venue' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const eventType = body?.eventType
  if (!EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
  }

  let client
  try {
    client = await getPool().connect()
    await client.query(
      `INSERT INTO venue_page_events (venue_id, event_type) VALUES ($1, $2)`,
      [venueId, eventType]
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[venue track] error:', err)
    // Never surface this to the client — it's a background beacon, not a
    // user-facing action, and a missed data point isn't worth an error.
    return NextResponse.json({ success: false })
  } finally {
    if (client) client.release()
  }
}
