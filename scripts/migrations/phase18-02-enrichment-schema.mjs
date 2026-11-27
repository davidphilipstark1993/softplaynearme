// Phase 18-02: schema for verified venue facts and their provenance (27 Nov 2026).
//
// Adds (all nullable, IF NOT EXISTS, so it is safe to re-run):
//   venues.description_source   'researched' | NULL. The venue page shows a stored description only
//                               when it is 'researched' (an owner's own text, from lib/ownerData.ts,
//                               always shows); every other page gets copy built from the venue's
//                               facts (lib/venueSummary.ts).
//   venues.has_soft_play        a source confirms the venue runs soft play (leisure centres need it to
//                               be indexed: lib/indexing.ts)
//   venues.age_range_min / _max already exist (migrateEnrichment.js); re-asserted here.
//   venue_fact_candidates       the review queue: what the website scraper (scripts/enrichment/
//                               scrape-venue-facts.mjs) found, with the evidence text, source URL and
//                               fetch date. Nothing in it is live until approved.
//   venue_fact_sources          provenance for every live fact: field, value, source URL, date checked,
//                               who approved it. Written by scripts/enrichment/review-queue.mjs.
// And marks the 83 hand-researched descriptions (phase18-02-researched-descriptions.json) as
// 'researched'.
//
//   node scripts/migrations/phase18-02-enrichment-schema.mjs             # dry run
//   node scripts/migrations/phase18-02-enrichment-schema.mjs --execute
//   node scripts/migrations/phase18-02-enrichment-schema.mjs --rollback  # clears description_source (tables/columns stay; they're empty or additive)
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool, EXECUTE } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROLLBACK = process.argv.includes('--rollback')
const { researched } = JSON.parse(readFileSync(path.join(ROOT, 'scripts/migrations/phase18-02-researched-descriptions.json'), 'utf8'))

const DDL = [
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS description_source VARCHAR(20)`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_soft_play BOOLEAN`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS age_range_min SMALLINT`,
  `ALTER TABLE venues ADD COLUMN IF NOT EXISTS age_range_max SMALLINT`,
  `CREATE TABLE IF NOT EXISTS venue_fact_candidates (
     id SERIAL PRIMARY KEY,
     venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
     field VARCHAR(40) NOT NULL,
     value JSONB NOT NULL,
     evidence TEXT,
     source_url TEXT NOT NULL,
     fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
     reviewed_at TIMESTAMPTZ,
     reviewed_by TEXT,
     note TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_fact_candidates_status ON venue_fact_candidates(status, venue_id)`,
  // One pending candidate per venue/field/value/source: re-running the scraper doesn't duplicate.
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_fact_candidates_pending ON venue_fact_candidates(venue_id, field, md5(value::text), source_url) WHERE status = 'pending'`,
  `CREATE TABLE IF NOT EXISTS venue_fact_sources (
     id SERIAL PRIMARY KEY,
     venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
     field VARCHAR(40) NOT NULL,
     value JSONB NOT NULL,
     source_url TEXT NOT NULL,
     checked_at DATE NOT NULL,
     approved_by TEXT,
     candidate_id INTEGER REFERENCES venue_fact_candidates(id),
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_fact_sources_venue ON venue_fact_sources(venue_id, field)`,
]

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

const pool = await getPool()
const client = await pool.connect()
try {
  if (ROLLBACK) {
    if (!EXECUTE) { console.log('Dry run: would set description_source = NULL on every venue. Add --execute.'); process.exit(0) }
    const r = await client.query(`UPDATE venues SET description_source = NULL WHERE description_source IS NOT NULL`)
    console.log(`Cleared description_source on ${r.rowCount} rows.`)
    process.exit(0)
  }
  const { rows } = await client.query(`SELECT id, name, description FROM venues WHERE id = ANY($1)`, [researched.map((r) => r.id)])
  const byId = new Map(rows.map((r) => [r.id, r]))
  const mark = researched.filter((r) => {
    const row = byId.get(r.id)
    const ok = row && norm(row.name) === norm(r.name) && (row.description ?? '').startsWith(r.starts)
    if (!ok) console.log(`skip ${r.id} ${r.name}: row or description changed since the export`)
    return ok
  })
  console.log(`DDL: ${DDL.length} statements. Mark researched: ${mark.length}/${researched.length}.`)
  if (!EXECUTE) { console.log('Dry run. Pass --execute.'); process.exit(0) }

  await client.query('BEGIN')
  for (const sql of DDL) await client.query(sql)
  await client.query(`UPDATE venues SET description_source = 'researched' WHERE id = ANY($1)`, [mark.map((r) => r.id)])
  await client.query('COMMIT')
  console.log(`Applied. researched: ${mark.length}. Now run: npm run data:rebuild`)
} catch (e) {
  await client.query('ROLLBACK').catch(() => {})
  throw e
} finally {
  client.release()
  await pool.end()
}
