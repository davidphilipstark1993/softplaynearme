/**
 * Migration: sponsored placements + lead notification email
 *
 * Adds:
 *  - venues.featured_until   — optional expiry for a featured/sponsored slot
 *                              (NULL = indefinite, matches current behaviour)
 *  - venues.lead_notification_email — owner-configurable address for lead
 *                              alerts, distinct from the venue's public
 *                              contact email (falls back to it when unset)
 *
 * Safe to run multiple times — uses ADD COLUMN IF NOT EXISTS.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/migrateAdsAndLeads.mjs
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
    console.log('Running ads/leads migration…\n')

    const columns = [
      { name: 'featured_until', type: 'TIMESTAMP', default: null },
      { name: 'lead_notification_email', type: 'VARCHAR(160)', default: null },
    ]

    for (const col of columns) {
      const def = col.default !== null ? `DEFAULT ${col.default}` : ''
      try {
        await client.query(
          `ALTER TABLE venues ADD COLUMN IF NOT EXISTS ${col.name} ${col.type} ${def}`
        )
        console.log(`  ✓ venues.${col.name}`)
      } catch (err) {
        console.warn(`  ⚠ venues.${col.name}: ${err.message}`)
      }
    }

    console.log('\n✅ Ads/leads migration complete!')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
