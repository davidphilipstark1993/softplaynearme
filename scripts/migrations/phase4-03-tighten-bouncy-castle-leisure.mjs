// Correction to phase4-02: the has-a-signal check used `parties` as one of
// the qualifying facility flags, but `parties` is circular for "Bouncy
// castle hire" — any hire business is definitionally party-related, so the
// flag doesn't distinguish a real walk-in venue from a pure delivery
// company. It let several venues the original audit specifically named as
// non-soft-play HIGH confidence (Airplay Bouncy Castles, FUN4ALL BOUNCY
// CASTLES, etc — reports/data-quality-audit.md §2.1) slip back into the
// main listing.
//
// Fix: "Bouncy castle hire" is bucketed unconditionally — the category
// itself (Google's own classification) is the authoritative HIGH-confidence
// signal here, same call the original audit made. For "Leisure Centre",
// require toddler_area or multi_level_play specifically (not bare
// `parties`) to stay in the main listing — a public leisure centre hosting
// a generic kids' party in a hall isn't the same as having a soft play
// facility.
//
//   node scripts/migrations/phase4-03-tighten-bouncy-castle-leisure.mjs [--execute]

import { EXECUTE, getPool, runBatched } from './_lib.mjs'

const pool = await getPool()
try {
  const { rows } = await pool.query(`
    SELECT id, name, category, toddler_area, has_multi_level_play FROM venues
    WHERE (venue_type IS NULL OR venue_type = 'indoor')
      AND (
        category = 'Bouncy castle hire'
        OR (category IN ('Leisure Centre', 'Leisure centre') AND NOT (toddler_area OR has_multi_level_play))
      )
  `)

  console.log(`Found ${rows.length} venues to bucket (all remaining Bouncy castle hire + Leisure Centre venues without a toddler/multi-level signal).`)
  console.log(EXECUTE ? '\nEXECUTING — this will UPDATE venue_type.' : '\nDRY RUN — no changes will be made.')

  await runBatched(rows, async (v) => {
    const check = await pool.query('SELECT id FROM venues WHERE id = $1', [v.id])
    if (!check.rows.length) { console.log(`  SKIP id=${v.id} "${v.name}" — no longer in DB`); return 'skipped' }
    console.log(`  ${EXECUTE ? 'TAG' : 'would TAG'}  id=${v.id} "${v.name}" (${v.category}) -> family-attraction`)
    if (EXECUTE) await pool.query(`UPDATE venues SET venue_type = 'family-attraction', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [v.id])
  })
} finally {
  await pool.end()
}
