// Adds double opt-in to newsletter_subscribers. Additive and idempotent.
//   - confirmed_at / confirmation_token / confirmation_sent_at: confirmation state
//   - pending_weekly / pending_events: lists requested but not yet confirmed (the
//     live weekly_newsletter / events_activities flags only flip on confirmation)
//   - status CHECK now also allows 'pending'
// Everyone already 'subscribed' is grandfathered: confirmed_at = subscribed_at.
//
// Usage: node scripts/migrateNewsletterDoubleOptIn.mjs   (requires DATABASE_URL in the env)
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)
  await client.query(`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;`)
  await client.query(`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex');`)
  await client.query(`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;`)
  await client.query(`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS pending_weekly BOOLEAN NOT NULL DEFAULT false;`)
  await client.query(`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS pending_events BOOLEAN NOT NULL DEFAULT false;`)
  await client.query(`ALTER TABLE newsletter_subscribers DROP CONSTRAINT IF EXISTS newsletter_subscribers_status_check;`)
  await client.query(`ALTER TABLE newsletter_subscribers ADD CONSTRAINT newsletter_subscribers_status_check CHECK (status IN ('pending', 'subscribed', 'unsubscribed'));`)
  const grandfathered = await client.query(
    `UPDATE newsletter_subscribers SET confirmed_at = subscribed_at WHERE status = 'subscribed' AND confirmed_at IS NULL`
  )
  await client.query('COMMIT')
  console.log(`Double opt-in columns ready. Grandfathered ${grandfathered.rowCount} existing subscriber(s).`)
} catch (err) {
  await client.query('ROLLBACK')
  throw err
} finally {
  client.release()
  await pool.end()
}
