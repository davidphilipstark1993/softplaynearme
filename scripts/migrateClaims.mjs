// Creates / upgrades the venue_claims table. Idempotent. This used to run inside
// every POST to /api/claims; it lives here so the request path never issues DDL.
//
// Usage: node scripts/migrateClaims.mjs   (requires DATABASE_URL in the env)
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const steps = [
  `CREATE TABLE IF NOT EXISTS venue_claims (
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(120) NOT NULL,
    email              VARCHAR(160) NOT NULL,
    venue_name         VARCHAR(255) NOT NULL,
    venue_address      TEXT,
    venue_phone        VARCHAR(30),
    venue_website      VARCHAR(500),
    city_slug          VARCHAR(100),
    venue_slug         VARCHAR(255),
    venue_url          VARCHAR(500),
    proof              VARCHAR(500),
    message            TEXT,
    access_token       UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    verification_token UUID UNIQUE DEFAULT gen_random_uuid(),
    email_verified     BOOLEAN DEFAULT FALSE,
    status             VARCHAR(30) DEFAULT 'pending',
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_address TEXT`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_phone VARCHAR(30)`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_website VARCHAR(500)`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS access_token UUID UNIQUE DEFAULT gen_random_uuid()`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS verification_token UUID UNIQUE DEFAULT gen_random_uuid()`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS plan_interest VARCHAR(20) DEFAULT 'free'`,
  // Supports the per-email / per-venue / global rate-limit counts in the route.
  `CREATE INDEX IF NOT EXISTS idx_venue_claims_email_created ON venue_claims(email, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_venue_claims_created ON venue_claims(created_at)`,
]

const client = await pool.connect()
try {
  for (const sql of steps) await client.query(sql)
  console.log('venue_claims ready')
} finally {
  client.release()
  await pool.end()
}
