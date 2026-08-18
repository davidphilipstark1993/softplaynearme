// Priority 2 (category scope creep) — two safe, unambiguous relabeling passes.
// Neither changes what's visible on the site (both target sets are already
// either wrongly counted as genuine soft play, or already excluded and just
// need honest sub-labels) — see reports/data-quality-audit.md and the
// phase5 investigation notes for the full policy discussion, including the
// still-open question of whether "Leisure Centre" (no signal) and "Pub"
// venues should be promoted into the main listing now that they have their
// own venue_type (not decided here).
//
// A. MISCLASSIFIED_AS_INDOOR — 27 venues currently venue_type='indoor' (so
//    counted as genuine soft play, shown in the main listing) that are
//    actually theme parks, adventure/ninja chains, bowling, climbing, gyms,
//    or a spa — identified by name/category denylist match. Moved to
//    'family-attraction', which removes them from the main soft-play count
//    and listing (matches the SQL filter in app/soft-play/[city]/page.tsx).
//
// B. Sub-labeling within the existing (already-excluded) 'family-attraction'
//    bucket, so the front end can eventually distinguish them honestly
//    instead of one undifferentiated catch-all:
//      - category IN ('Bouncy castle hire', 'Party equipment rental service')
//        -> 'mobile-hire' (no premises to visit)
//      - category = 'Shopping Centre', or name = 'IKEA Play Area' (currently
//        mistagged 'park-playground', not actually an outdoor playground)
//        -> 'retail'
//      - category IN ('Leisure Centre', 'Leisure centre') -> 'leisure-centre'
//
//   node scripts/migrations/phase5-01-reclassify-venue-types.mjs [--execute]

import { EXECUTE, getPool, runBatched } from './_lib.mjs'

const NOT_SOFT_PLAY_CATEGORY = [
  'aquarium', 'bowling alley', 'escape room', 'rock climbing gym', 'climbing gym', 'climbing wall',
  'toy shop', 'toy store', 'golf course', 'adventure golf', 'mini golf', 'shopping centre', 'shopping mall',
  'swimming pool', 'water park', 'cinema', 'movie theater', 'museum', 'zoo', 'farm shop', 'garden centre',
  'party equipment rental', 'event planner', 'wedding venue', 'pub', 'bar', 'hotel', 'church',
  'sports complex', 'gym', 'fitness centre', 'car park', 'supermarket', 'department store', 'amusement park',
  'theme park', 'bowling', 'bouncy castle hire', 'inflatable',
]
const NAME_HIRE = /\b(bouncy castle|inflatable)s?\b.*(hire|rental)|hire.*\b(bouncy castle|inflatable)s?\b/i
const NAME_CHAIN = /\b(ninja warrior|gulliver|superbowl|flip out|rock ?up|jump ?inc|airhop|astrabound|jumparooz)\b/i
const NAME_BOWLING = /\bbowl(ing)?\b/i
const NAME_CLIMBING = /\bclimbing\b/i

const pool = await getPool()
try {
  // ── A. misclassified as indoor ──────────────────────────────────────────
  const { rows: indoorRows } = await pool.query(
    `SELECT id, name, city_slug, category FROM venues WHERE venue_type IS NULL OR venue_type = 'indoor'`
  )
  const misclassified = indoorRows.filter((v) => {
    const cat = (v.category || '').toLowerCase()
    const catHit = NOT_SOFT_PLAY_CATEGORY.some((kw) => cat.includes(kw))
    const nameHit = NAME_HIRE.test(v.name) || NAME_CHAIN.test(v.name) || NAME_BOWLING.test(v.name) || NAME_CLIMBING.test(v.name)
    return catHit || nameHit
  })

  console.log(`A. ${misclassified.length} venues currently tagged 'indoor' look like non-soft-play (theme park/adventure chain/bowling/climbing/gym) — moving to 'family-attraction'.`)
  console.log(EXECUTE ? 'EXECUTING' : 'DRY RUN')
  await runBatched(misclassified, async (v) => {
    console.log(`  ${EXECUTE ? 'TAG' : 'would TAG'} id=${v.id} "${v.name}" (${v.city_slug}, ${v.category}) indoor -> family-attraction`)
    if (EXECUTE) await pool.query(`UPDATE venues SET venue_type = 'family-attraction', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [v.id])
    return 'ok'
  })

  // ── B. sub-labeling within family-attraction / park-playground ─────────
  const { rows: faRows } = await pool.query(
    `SELECT id, name, city_slug, category, venue_type FROM venues
     WHERE venue_type = 'family-attraction' OR (venue_type = 'park-playground' AND name ILIKE '%ikea%')`
  )
  const relabel = []
  for (const v of faRows) {
    if (['Bouncy castle hire', 'Party equipment rental service'].includes(v.category)) {
      relabel.push({ v, newType: 'mobile-hire' })
    } else if (v.category === 'Shopping Centre' || v.name.toLowerCase().includes('ikea')) {
      relabel.push({ v, newType: 'retail' })
    } else if (['Leisure Centre', 'Leisure centre'].includes(v.category) && !NAME_CHAIN.test(v.name)) {
      // Franchise chains (Ninja Warrior, Flip Out, etc.) sometimes carry a
      // scraped "Leisure Centre" category despite being a trampoline/
      // adventure park, not a swim/gym facility — leave those as the
      // generic 'family-attraction' label rather than mislabeling them.
      relabel.push({ v, newType: 'leisure-centre' })
    }
  }

  console.log(`\nB. ${relabel.length} already-excluded venues get an honest sub-label instead of generic 'family-attraction'.`)
  const byNewType = {}
  for (const r of relabel) (byNewType[r.newType] ??= 0, byNewType[r.newType]++)
  console.log('  ', JSON.stringify(byNewType))
  console.log(EXECUTE ? 'EXECUTING' : 'DRY RUN')
  await runBatched(relabel, async ({ v, newType }) => {
    console.log(`  ${EXECUTE ? 'TAG' : 'would TAG'} id=${v.id} "${v.name}" (${v.city_slug}, ${v.category}) ${v.venue_type} -> ${newType}`)
    if (EXECUTE) await pool.query(`UPDATE venues SET venue_type = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newType, v.id])
    return 'ok'
  })
} finally {
  await pool.end()
}
