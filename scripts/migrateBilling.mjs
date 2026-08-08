/**
 * Migration: freemium plans (Free / Premium / Bespoke)
 *
 * Adds subscription/plan columns to `venues` (Stripe-ready but not
 * Stripe-wired yet — a future webhook just writes into these same
 * columns) and a `venue_enquiries` table for the venue contact/lead form.
 *
 * Safe to run multiple times — uses ADD COLUMN IF NOT EXISTS / CREATE
 * TABLE IF NOT EXISTS.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/migrateBilling.mjs
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
    console.log('Running billing/plans migration…\n')

    const columns = [
      // 'free' | 'premium' | 'bespoke'
      { name: 'plan', type: 'VARCHAR(20)', default: "'free'", notNull: true },
      // 'inactive' | 'active' | 'trialing' | 'past_due' | 'cancelled'
      { name: 'plan_status', type: 'VARCHAR(20)', default: "'inactive'", notNull: true },
      { name: 'plan_started_at', type: 'TIMESTAMP', default: null },
      { name: 'plan_renews_at', type: 'TIMESTAMP', default: null },
      { name: 'stripe_customer_id', type: 'VARCHAR(255)', default: null },
      { name: 'stripe_subscription_id', type: 'VARCHAR(255)', default: null },
      // Bespoke ad placements, e.g. {"homepage": true, "city_pages": ["london"]}
      { name: 'ad_placements', type: 'JSONB', default: null },
    ]

    for (const col of columns) {
      const def = col.default !== null ? `DEFAULT ${col.default}` : ''
      const notNull = col.notNull ? 'NOT NULL' : ''
      try {
        await client.query(
          `ALTER TABLE venues ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${def} ${notNull}`
        )
        console.log(`  ✓ venues.${col.name}`)
      } catch (err) {
        console.warn(`  ⚠ venues.${col.name}: ${err.message}`)
      }
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS venue_enquiries (
        id          SERIAL PRIMARY KEY,
        venue_id    INTEGER NOT NULL REFERENCES venues(id),
        name        VARCHAR(120) NOT NULL,
        email       VARCHAR(160) NOT NULL,
        phone       VARCHAR(30),
        message     TEXT NOT NULL,
        notified    BOOLEAN DEFAULT false,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('  ✓ venue_enquiries table')

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_venue_enquiries_venue_id ON venue_enquiries(venue_id)`
    )
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_venues_plan ON venues(plan, plan_status)`
    )
    console.log('  ✓ indexes')

    console.log('\n✅ Billing/plans migration complete!')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
