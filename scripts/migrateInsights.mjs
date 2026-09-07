/**
 * Migration: lightweight first-party analytics for Premium/Bespoke insights
 *
 * GA4 events (wired up in an earlier session) aren't queryable from our own
 * backend without the GA4 Reporting API (OAuth/service account — a much
 * bigger lift). This is a simple event log instead: one row per page view
 * or CTA click, so "views/clicks in the last 30 days" or "this month vs
 * last month" are just date-range queries — no running counters or
 * snapshot-diffing to get wrong.
 *
 * Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/migrateInsights.mjs
 */
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Running insights migration…\n')

    await client.query(`
      CREATE TABLE IF NOT EXISTS venue_page_events (
        id         SERIAL PRIMARY KEY,
        venue_id   INTEGER NOT NULL REFERENCES venues(id),
        event_type VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('  ✓ venue_page_events table')

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_venue_page_events_venue_date ON venue_page_events(venue_id, created_at)`
    )
    console.log('  ✓ index on (venue_id, created_at)')

    // 'month' | 'year' — set on Premium activation, read back by the renewal
    // reminder job so it only nudges annual subscribers (a monthly reminder
    // every month would just be spam).
    await client.query(`ALTER TABLE venues ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(10)`)
    console.log('  ✓ venues.billing_interval')

    // Prevents the "listing needs attention" job from re-emailing the same
    // venue every run — only nudge once per cool-off period.
    await client.query(`ALTER TABLE venues ADD COLUMN IF NOT EXISTS last_slipping_reminder_at TIMESTAMP`)
    console.log('  ✓ venues.last_slipping_reminder_at')

    console.log('\n✅ Insights migration complete!')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
