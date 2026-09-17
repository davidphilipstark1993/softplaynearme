// Phase 6-01: adds a genuine public-visibility flag to venues, and cleans up
// the specific Hull data-quality issues found during the Hull city hub
// rebuild (2026-09-16):
//
//   1. venues.is_active (new column, default true) — the admin "Status"
//      dropdown in /admin/venues is actually `plan_status` (billing state:
//      free/premium/trialing/etc), NOT a listing-visibility flag. Setting a
//      venue's plan_status to "inactive" has never hidden it from public
//      pages, which is the reported bug. is_active is the real switch;
//      every public venue query across the site now filters on it (see the
//      PR this migration ships with).
//   2. Deletes the junk test venue "soft ply r us" (1 Test Street, TE5 7ST)
//      — seed/test data that should never have been public.
//   3. Reclassifies Funstation Hull and Laser Station St Stephen's Hull from
//      venue_type='indoor' (counted as genuine soft play) to
//      'family-attraction' (excluded from the main soft-play listing,
//      surfaced only via the "Other family activities" tab) — an arcade/FEC
//      and a laser-tag venue respectively, not soft play.
//   4. Reclassifies William's Den from 'indoor' to 'family-attraction' —
//      adventure play that explicitly states on its own site it is not
//      soft play.
//
// Gravity Active Hull (venue_type='leisure-centre') and Let Loose Yorkshire
// (city_slug='beverley', not 'hull') are not touched here — they're already
// excluded from Hull's primary soft-play list by the existing
// visibleVenueTypeSql()/city_slug scoping respectively.
//
// Usage:
//   node scripts/migrations/phase6-01-active-flag-and-hull-cleanup.mjs           (dry run)
//   node scripts/migrations/phase6-01-active-flag-and-hull-cleanup.mjs --execute (writes)

import { getPool } from './_lib.mjs'

const EXECUTE = process.argv.includes('--execute')

const RECLASSIFY = [
  { id: 28, name: 'Funstation Hull', from: 'indoor', to: 'family-attraction' },
  { id: 49, name: "Laser Station St Stephen's Hull", from: 'indoor', to: 'family-attraction' },
  { id: 36, name: "William's Den", from: 'indoor', to: 'family-attraction' },
]

const DELETE_TARGET = { id: 1932, name: 'soft ply r us', address: '1 Test Street, Test City, TE5 7ST' }

async function main() {
  const pool = await getPool()
  const client = await pool.connect()

  try {
    console.log(`=== Phase 6-01 (${EXECUTE ? 'EXECUTE' : 'DRY RUN'}) ===\n`)

    // 1. Add the is_active column (idempotent, safe to run repeatedly).
    console.log('Step 1: venues.is_active column')
    if (EXECUTE) {
      await client.query(`ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`)
      await client.query(`CREATE INDEX IF NOT EXISTS idx_venues_is_active ON venues(is_active);`)
      console.log('  Added is_active (default true) + index.')
    } else {
      console.log('  Would run: ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;')
    }

    // 2. Delete the test venue — verify by id AND name AND address before deleting.
    console.log('\nStep 2: delete test venue')
    const testRow = await client.query(
      `SELECT id, name, address FROM venues WHERE id = $1`,
      [DELETE_TARGET.id]
    )
    const test = testRow.rows[0]
    if (!test) {
      console.log(`  SKIP — id ${DELETE_TARGET.id} not found (already deleted?)`)
    } else if (test.name !== DELETE_TARGET.name || !test.address?.includes('Test Street')) {
      console.log(`  SKIP — id ${DELETE_TARGET.id} no longer matches expected name/address (found: ${test.name} / ${test.address}). Not deleting.`)
    } else if (EXECUTE) {
      // newsletter_items.venue_id is ON DELETE SET NULL; the rest (reviews,
      // venue_pricing, venue_sessions, venue_photos, venue_enquiries,
      // venue_page_events) need explicit cleanup first — junk test data, so
      // its tracking rows go with it.
      for (const table of ['reviews', 'venue_pricing', 'venue_sessions', 'venue_photos', 'venue_enquiries', 'venue_page_events']) {
        await client.query(`DELETE FROM ${table} WHERE venue_id = $1`, [DELETE_TARGET.id])
      }
      await client.query(`DELETE FROM venues WHERE id = $1`, [DELETE_TARGET.id])
      console.log(`  DELETED id ${DELETE_TARGET.id} (${test.name}) and its dependent rows`)
    } else {
      console.log(`  Would DELETE id ${DELETE_TARGET.id} (${test.name}, ${test.address})`)
    }

    // 3. Reclassify venue_type for the misclassified Hull venues.
    console.log('\nStep 3: reclassify venue_type')
    for (const target of RECLASSIFY) {
      const result = await client.query(`SELECT id, name, venue_type FROM venues WHERE id = $1`, [target.id])
      const row = result.rows[0]
      if (!row) {
        console.log(`  SKIP — id ${target.id} (${target.name}) not found`)
        continue
      }
      if (row.name !== target.name || row.venue_type !== target.from) {
        console.log(`  SKIP — id ${target.id} no longer matches expected name/venue_type (found: ${row.name} / ${row.venue_type})`)
        continue
      }
      if (EXECUTE) {
        await client.query(`UPDATE venues SET venue_type = $2, updated_at = NOW() WHERE id = $1`, [target.id, target.to])
        console.log(`  UPDATED id ${target.id} (${target.name}): venue_type ${target.from} -> ${target.to}`)
      } else {
        console.log(`  Would UPDATE id ${target.id} (${target.name}): venue_type ${target.from} -> ${target.to}`)
      }
    }

    console.log(EXECUTE ? '\nDone.' : '\nRe-run with --execute to write these changes.')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exitCode = 1
})
