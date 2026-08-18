// Priority 2/6 follow-up — found while adding a review-count ceiling to the
// curated modules: sorting the 'indoor' bucket by review count surfaced
// large non-soft-play attractions (piers, bowling/arcade chains, retail and
// leisure parks, heritage sites) that the first reclassification pass
// (phase5-01) missed because their category/name didn't match its
// denylist. Same "exclude if 0 evidence of a soft play" standard the site
// owner set for the leisure-centre bucket, applied here — except for
// unambiguous chain brands (Tenpin, Namco Funscape) which are excluded on
// name alone regardless of signal, same as Ninja Warrior/Superbowl in
// phase5-01.
//
//   node scripts/migrations/phase5-03-reclassify-round2.mjs [--execute]

import { EXECUTE, getPool, runBatched } from './_lib.mjs'

const CATEGORY_EXCLUDE = [
  'Family friendly', 'Park and Garden', 'Recreation Centre', 'Conference Centre',
  'Tourist attraction', 'Food court',
]
const CATEGORY_SUBSTRING_EXCLUDE = ['shopping'] // catches "Shopping outlet", "Shopping Centre", etc.

// Brand names excluded regardless of signal — these are structurally bowling
// alleys / arcades / a heritage site, not soft play, whatever a stray
// facility flag says.
const NAME_BRAND_ALWAYS = /\b(tenpin|namco funscape)\b/i
const NAME_PATTERN_CHECK_SIGNAL = /\badventure park\b|\bgarden centre\b|\bheritage (centre|site)\b/i

// Explicit one-off large attractions found by review-count outlier review —
// unique names/categories that don't fit a reusable pattern.
const EXPLICIT_IDS = {
  275: 'Coral Island — seafront arcade complex, Blackpool',
  737: "Clacton Pier — amusement pier, category mislabeled 'Indoor Soft Play'",
  418: 'StarCity — cinema/bowling/casino leisure complex, Birmingham',
  652: 'Tower Park — retail/leisure park (cinema, bowling), Bournemouth',
  1045: 'Pavilion Gardens, Buxton — public park/garden',
  1368: 'Runway Visitor Park — Manchester Airport viewing park',
  1044: 'Elsecar Heritage Centre — heritage/tourist site',
  118: 'Stockeld Park — large outdoor events/maze park',
  1387: 'Queens Links Leisure Park — retail/leisure park, Aberdeen',
  488: "Codona's — seaside amusement park, Aberdeen",
  228: 'York Barbican — conference/events venue',
  222: 'York Maze — outdoor maze attraction',
  237: 'SPARK York — food court',
  648: 'Snowtrax Alpine Activity Centre — ski/snowsports centre',
  1032: 'Elsecar Park — public park',
}

const pool = await getPool()
try {
  const { rows } = await pool.query(
    `SELECT id, name, city_slug, category, toddler_area, baby_area, has_multi_level_play
     FROM venues WHERE venue_type = 'indoor'`
  )

  const targets = []
  for (const v of rows) {
    if (EXPLICIT_IDS[v.id]) {
      targets.push({ v, reason: EXPLICIT_IDS[v.id] })
      continue
    }
    if (NAME_BRAND_ALWAYS.test(v.name)) {
      targets.push({ v, reason: `brand name match (${v.name})` })
      continue
    }
    const catMatch = CATEGORY_EXCLUDE.includes(v.category) || CATEGORY_SUBSTRING_EXCLUDE.some((s) => (v.category || '').toLowerCase().includes(s))
    const namePatternMatch = NAME_PATTERN_CHECK_SIGNAL.test(v.name)
    if (!catMatch && !namePatternMatch) continue
    const hasSignal = v.toddler_area || v.baby_area || v.has_multi_level_play
    if (hasSignal) continue // real facility evidence — leave alone regardless of category/name match
    targets.push({ v, reason: `category/name match, no facility signal (category="${v.category}")` })
  }

  console.log(`${targets.length} additional 'indoor' venues to move to 'family-attraction'.\n`)
  console.log(EXECUTE ? 'EXECUTING' : 'DRY RUN')

  await runBatched(targets, async ({ v, reason }) => {
    console.log(`  ${EXECUTE ? 'TAG' : 'would TAG'} id=${v.id} "${v.name}" (${v.city_slug}) -> family-attraction [${reason}]`)
    if (EXECUTE) await pool.query(`UPDATE venues SET venue_type = 'family-attraction', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [v.id])
    return 'ok'
  })
} finally {
  await pool.end()
}
