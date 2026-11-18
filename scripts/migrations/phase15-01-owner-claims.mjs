// Phase 15-01: owner claim flow (sign-in links, owner data kept apart from Google data, edit log).
//
//   node scripts/migrations/phase15-01-owner-claims.mjs            # dry run: prints the SQL
//   node scripts/migrations/phase15-01-owner-claims.mjs --execute  # applies it in one transaction
//
// Safe to re-run (IF NOT EXISTS everywhere). Run it BEFORE deploying the owner-claims code:
// the new pages read these tables (they degrade gracefully if missing, but claims can't be made).
//
//   venue_claims        extended: venue_id, role, method, verified_at, reviewed_by, ip_hash.
//                       Legacy status 'approved' becomes 'verified'.
//   owner_login_tokens  single-use sign-in links (sha256 of the token, 24h expiry).
//   venue_owner_data    one row per venue: everything an owner adds. No ingest/enrichment
//                       script writes to this table, so a Google Places refresh can never
//                       overwrite it; the venue page merges it over the base row on render.
//   venue_edit_log      every owner/admin change, field by field, for audit and revert.
//   venues              owner_completeness (0–100), used as a small ranking tie-breaker.
import { getPool, EXECUTE } from './_lib.mjs'

export const SQL = [
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS venue_id INTEGER`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS role VARCHAR(60)`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS method VARCHAR(20) DEFAULT 'manual_review'`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(60)`,
  `ALTER TABLE venue_claims ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(64)`,
  `UPDATE venue_claims c SET venue_id = v.id FROM venues v
     WHERE c.venue_id IS NULL AND v.city_slug = c.city_slug AND v.slug = c.venue_slug`,
  `UPDATE venue_claims SET status = 'verified', verified_at = COALESCE(verified_at, created_at), reviewed_by = COALESCE(reviewed_by, 'legacy-approval')
     WHERE status = 'approved'`,
  // Approved claims made on owner-submitted duplicates that were later retired: point them at
  // the live listing (same venue, checked by hand on 18 Nov 2026) and mark that one claimed.
  // Each row only moves if the target is still active and the names match.
  ...[[13, 874], [18, 1887], [30, 1886], [33, 1888], [36, 1886]].flatMap(([claimId, venueId]) => [
    `UPDATE venue_claims c SET venue_id = v.id, city_slug = v.city_slug, venue_slug = v.slug
       FROM venues v
      WHERE c.id = ${claimId} AND v.id = ${venueId} AND v.is_active = true
        AND lower(split_part(v.name, ' ', 1)) = lower(split_part(c.venue_name, ' ', 1))`,
  ]),
  `UPDATE venues v SET claimed_by_owner = true
     FROM venue_claims c WHERE c.venue_id = v.id AND c.status IN ('verified','approved') AND v.is_active = true`,
  `CREATE INDEX IF NOT EXISTS venue_claims_venue_id_idx ON venue_claims (venue_id)`,
  `CREATE INDEX IF NOT EXISTS venue_claims_email_idx ON venue_claims (lower(email))`,
  `CREATE TABLE IF NOT EXISTS owner_login_tokens (
     id          SERIAL PRIMARY KEY,
     claim_id    INTEGER NOT NULL REFERENCES venue_claims(id) ON DELETE CASCADE,
     token_hash  CHAR(64) NOT NULL UNIQUE,
     expires_at  TIMESTAMPTZ NOT NULL,
     used_at     TIMESTAMPTZ,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE TABLE IF NOT EXISTS venue_owner_data (
     venue_id               INTEGER PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
     prices                 JSONB,
     age_min                SMALLINT,
     age_max                SMALLINT,
     toddler_sessions       TEXT,
     sen_sessions           TEXT,
     party_packages         TEXT,
     opening_hours_override JSONB,
     photos                 JSONB,
     events                 JSONB,
     owner_description      VARCHAR(600),
     facilities             JSONB,
     updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_by_claim_id    INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS venue_edit_log (
     id         SERIAL PRIMARY KEY,
     venue_id   INTEGER NOT NULL,
     field      VARCHAR(60) NOT NULL,
     old_value  JSONB,
     new_value  JSONB,
     edited_by  VARCHAR(80) NOT NULL,
     edited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     reverted_at TIMESTAMPTZ
   )`,
  `CREATE INDEX IF NOT EXISTS venue_edit_log_venue_idx ON venue_edit_log (venue_id, edited_at DESC)`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS owner_completeness SMALLINT DEFAULT 0`,
]

const pool = await getPool()
if (!EXECUTE) {
  for (const s of SQL) console.log(s.replace(/\s+/g, ' ').trim() + ';')
  const { rows } = await pool.query(`SELECT status, count(*) FROM venue_claims GROUP BY 1 ORDER BY 1`)
  console.log('\nvenue_claims now:', rows.map((r) => `${r.status}=${r.count}`).join(', '))
  console.log('Dry run: nothing written. Re-run with --execute.')
  await pool.end()
  process.exit(0)
}
const client = await pool.connect()
try {
  await client.query('BEGIN')
  for (const s of SQL) await client.query(s)
  await client.query('COMMIT')
  const { rows } = await client.query(`SELECT status, count(*) FROM venue_claims GROUP BY 1 ORDER BY 1`)
  console.log('Applied. venue_claims:', rows.map((r) => `${r.status}=${r.count}`).join(', '))
} catch (e) {
  await client.query('ROLLBACK')
  throw e
} finally {
  client.release()
  await pool.end()
}
