/**
 * Remove fabricated/seed data from the database.
 *
 * This script:
 *   1. Deletes 10 fake Hull venues inserted by scripts/seedHullVenues.js
 *      (identified by their known slugs AND fake phone prefix 01234 5678)
 *   2. Strips fabricated keys from the facilities JSONB that were hardcoded
 *      in scripts/migrateSchema.js regardless of actual venue data:
 *        - baby_changing  (hardcoded true for all venues without data)
 *        - socks_required (hardcoded true)
 *        - lockers        (hardcoded false — unknown, not confirmed absent)
 *        - outdoor_area   (hardcoded false — unknown)
 *        - air_conditioning (hardcoded false — unknown)
 *      Only keys sourced from real boolean DB columns (cafe, parking, parties,
 *      toddler_area, baby_area, sen_friendly, wheelchair_access, free_wifi)
 *      are retained.
 *
 * Run:
 *   DATABASE_URL=... node scripts/cleanFabricatedData.js
 */
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

// Slugs from scripts/seedHullVenues.js — all fictional venues
const FAKE_SLUGS = [
  'adventure-land-play-centre',
  'jungle-jims-play-zone',
  'little-explorers-soft-play',
  'mega-fun-factory',
  'playtown-hull',
  'rainbow-soft-play',
  'pirate-petes-play-ship',
  'sunshine-play-centre',
  'the-play-pit',
  'wild-woods-indoor-play',
]

// Keys that were hardcoded in migrateSchema.js without any real source data
// These must be removed — we cannot claim any of these without a real source.
const FABRICATED_FACILITY_KEYS = [
  'baby_changing',
  'socks_required',
  'lockers',
  'outdoor_area',
  'air_conditioning',
]

async function clean() {
  const client = await pool.connect()
  try {
    console.log('=== Cleaning fabricated data ===\n')

    // ── Step 1: Delete fake seed venues ───────────────────────────────────
    console.log('Step 1: Removing fake seed venues from Hull…')

    // Sanity check — confirm they actually have fake phone numbers before deleting
    const check = await client.query(`
      SELECT id, name, slug, phone FROM venues
      WHERE city_slug = 'hull'
        AND slug = ANY($1::text[])
    `, [FAKE_SLUGS])

    const fakeVenueIds = check.rows.map(r => r.id)

    for (const row of check.rows) {
      const isFakePhone = !row.phone || row.phone.startsWith('01234 5678') || row.phone.startsWith('01234567')
      const isExampleWeb = false // already checked earlier
      console.log(`  ${isFakePhone ? '🗑' : '⚠'} [${row.id}] ${row.name} | phone: ${row.phone || 'none'}`)
    }

    if (fakeVenueIds.length > 0) {
      // Delete cascade covers venue_pricing, venue_sessions, venue_photos, reviews
      await client.query(
        `DELETE FROM venues WHERE id = ANY($1::int[])`,
        [fakeVenueIds]
      )
      console.log(`  ✓ Deleted ${fakeVenueIds.length} fake venues (and their pricing/session/review rows)\n`)
    } else {
      console.log('  No matching fake venues found (already cleaned?)\n')
    }

    // ── Step 2: Strip fabricated facility keys from JSONB ─────────────────
    console.log('Step 2: Stripping fabricated facility keys from facilities JSONB…')

    // Build a SQL expression that removes each fabricated key in sequence
    // e.g. facilities #- '{baby_changing}' #- '{socks_required}' ...
    const stripExpr = FABRICATED_FACILITY_KEYS
      .map(key => `#- '{${key}}'`)
      .join(' ')

    const before = await client.query(`
      SELECT COUNT(*) FROM venues
      WHERE ${FABRICATED_FACILITY_KEYS.map((k, i) => `facilities ? $${i + 1}`).join(' OR ')}
    `, FABRICATED_FACILITY_KEYS)
    console.log(`  Venues with at least one fabricated key before: ${before.rows[0].count}`)

    await client.query(`
      UPDATE venues
      SET facilities = (facilities ${stripExpr}),
          updated_at = CURRENT_TIMESTAMP
      WHERE facilities IS NOT NULL
        AND (${FABRICATED_FACILITY_KEYS.map((k, i) => `facilities ? $${i + 1}`).join(' OR ')})
    `, FABRICATED_FACILITY_KEYS)

    const after = await client.query(`
      SELECT COUNT(*) FROM venues
      WHERE ${FABRICATED_FACILITY_KEYS.map((k, i) => `facilities ? $${i + 1}`).join(' OR ')}
    `, FABRICATED_FACILITY_KEYS)
    console.log(`  Venues with fabricated keys after:  ${after.rows[0].count}`)
    console.log('  ✓ Fabricated facility keys removed\n')

    // ── Step 3: Recompute completeness scores ─────────────────────────────
    console.log('Step 3: Recomputing completeness scores…')
    await client.query(`
      UPDATE venues SET completeness_score = (
        (CASE WHEN name        IS NOT NULL AND name <> ''        THEN 10 ELSE 0 END) +
        (CASE WHEN address     IS NOT NULL AND address <> ''     THEN 10 ELSE 0 END) +
        (CASE WHEN phone       IS NOT NULL AND phone <> ''       THEN 10 ELSE 0 END) +
        (CASE WHEN website     IS NOT NULL AND website <> ''     THEN 10 ELSE 0 END) +
        (CASE WHEN description IS NOT NULL AND description <> '' THEN 15 ELSE 0 END) +
        (CASE WHEN opening_hours IS NOT NULL                     THEN 10 ELSE 0 END) +
        (CASE WHEN price_from  IS NOT NULL                       THEN 10 ELSE 0 END) +
        (CASE WHEN (cafe OR parking OR parties OR toddler_area OR
                    baby_area OR sen_friendly OR wheelchair_access)
              THEN 10 ELSE 0 END) +
        (CASE WHEN images IS NOT NULL AND array_length(images, 1) > 0 THEN 5 ELSE 0 END) +
        (CASE WHEN email IS NOT NULL AND email <> ''             THEN 5 ELSE 0 END) +
        (CASE WHEN lat IS NOT NULL AND lng IS NOT NULL           THEN 5 ELSE 0 END)
      ),
      updated_at = CURRENT_TIMESTAMP
    `)
    console.log('  ✓ Scores refreshed\n')

    // ── Summary ───────────────────────────────────────────────────────────
    const stats = await client.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE completeness_score >= 60)     AS rich,
        COUNT(*) FILTER (WHERE completeness_score >= 20
                           AND completeness_score < 60)      AS partial,
        COUNT(*) FILTER (WHERE completeness_score < 20)      AS thin
      FROM venues
    `)
    const s = stats.rows[0]
    console.log('=== Final DB state ===')
    console.log(`Total venues : ${s.total}`)
    console.log(`Rich  (≥60)  : ${s.rich}`)
    console.log(`Partial      : ${s.partial}`)
    console.log(`Thin  (<20)  : ${s.thin}  ← noindex`)
    console.log('\n✅ Done.')

  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

clean()
