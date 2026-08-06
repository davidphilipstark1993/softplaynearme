// Second pass on category scope creep — resolves the categories
// phase4-01-classify-venue-types.mjs deliberately left for manual review
// (Leisure Centre, Bouncy castle hire, Party equipment rental service,
// Amusement park, Events Venue, Video arcade, Party planner) because some
// plausibly still contain a real soft-play offering.
//
// Data-driven split rather than a blanket call: checked whether each venue
// has any positive kids-facility signal (toddler_area, baby_area, parties,
// multi_level_play).
//   - Leisure Centre: only 8/107 (7%) have any signal — the vast majority
//     are plain swim/gym centres with no dedicated kids' soft play offering.
//     Bucket the ones with no signal; leave the ~8 with a real signal alone.
//   - Bouncy castle hire: only 8/46 (17%) have a signal — most are pure
//     hire/delivery businesses with no walk-in venue at all. Same split.
//   - Party equipment rental service: 24/25 show a "parties" signal, but
//     that's circular (of course a party-rental business gets tagged
//     "parties") — it doesn't indicate a visitable venue. Bucket all 25.
//   - Amusement park (4, 0 signal) and Video arcade (1, 0 signal): bucket,
//     consistent with these categories already being HIGH-confidence
//     non-soft-play elsewhere.
//   - Events Venue (3): all 3 show a real signal — evidence of genuine
//     overlap (e.g. "Active+ Hull" runs kids sessions). Left alone.
//   - Party planner (1): has a signal but "party planner" as a category
//     name is categorically a service, not a venue. Bucketed.
//
//   node scripts/migrations/phase4-02-classify-remaining-categories.mjs [--execute]

import { EXECUTE, getPool, runBatched } from './_lib.mjs'

const BUCKET_NO_SIGNAL = ['Leisure Centre', 'Leisure centre', 'Bouncy castle hire']
const BUCKET_ALWAYS = ['Party equipment rental service', 'Amusement park', 'Video arcade', 'Party planner']

const pool = await getPool()
try {
  const { rows } = await pool.query(`
    SELECT id, name, category,
      (toddler_area OR baby_area OR parties OR has_multi_level_play) as has_signal
    FROM venues
    WHERE (venue_type IS NULL OR venue_type = 'indoor')
      AND category IN ('Leisure Centre','Leisure centre','Bouncy castle hire','Party equipment rental service','Amusement park','Events Venue','Video arcade','Party planner')
  `)

  const targets = rows.filter((v) => {
    if (BUCKET_ALWAYS.includes(v.category)) return true
    if (BUCKET_NO_SIGNAL.includes(v.category) && !v.has_signal) return true
    return false // Events Venue, or a signal-bearing Leisure Centre/Bouncy castle hire — left alone
  })

  console.log(`Found ${targets.length} venues to bucket as 'family-attraction' out of ${rows.length} scanned in the deferred categories.`)
  console.log(EXECUTE ? '\nEXECUTING — this will UPDATE venue_type.' : '\nDRY RUN — no changes will be made.')

  await runBatched(targets, async (v) => {
    const check = await pool.query('SELECT id, venue_type FROM venues WHERE id = $1', [v.id])
    if (!check.rows.length) { console.log(`  SKIP id=${v.id} "${v.name}" — no longer in DB`); return 'skipped' }
    console.log(`  ${EXECUTE ? 'TAG' : 'would TAG'}  id=${v.id} "${v.name}" (${v.category}) -> family-attraction`)
    if (EXECUTE) await pool.query(`UPDATE venues SET venue_type = 'family-attraction', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [v.id])
  })
} finally {
  await pool.end()
}
