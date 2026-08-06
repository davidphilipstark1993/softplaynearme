// Category scope creep: tags non-soft-play venues with `venue_type` so they
// can be excluded from the main soft-play A-Z listing/count/schema
// (app/soft-play/[city]/page.tsx) and surfaced instead via an "Other family
// activities" filter tab. See lib/venueTypes.ts for the enum this feeds and
// reports/data-quality-audit.md §2 for the category signals this reuses.
//
// User decision: bucket, don't delete — except venues that aren't real,
// visitable businesses at all (B2B equipment suppliers). Also NOT deleting
// the broader "category='Playground'" set wholesale: that category is used
// by Google for both literal public park playgrounds AND some substantial
// commercial attractions (e.g. "York Maze", 2,812 reviews) that just got a
// generic tag — only the subset whose *name* also matches a park-playground
// naming pattern is bucketed as 'park-playground'.
//
// Deliberately conservative on categories that plausibly still contain real
// soft play (Leisure Centre — 109 venues, some do have a soft play area
// attached; Bouncy castle hire — 47; Events Venue; Amusement park; Indoor
// golf course; Arcade; Party planner; Inflatable) — these are left alone and
// reported as a MEDIUM-confidence list for a manual follow-up decision,
// same pattern as Phase 1/2's MEDIUM lists.
//
//   node scripts/migrations/phase4-01-classify-venue-types.mjs [--execute]

import { EXECUTE, getPool, runBatched } from './_lib.mjs'

// ── DELETE: not a visitable venue at all ────────────────────────────────
const SUPPLIER_CATEGORY = 'playground equipment supplier'

// ── BUCKET: park-playground (category is literally "Playground" AND the
// name itself uses park-playground naming, e.g. "X Play Area") ──────────
const PARK_PLAYGROUND_NAME = /\b(play\s*area|playground|play\s*park)\b/i

// ── BUCKET: trampoline-park ──────────────────────────────────────────────
const TRAMPOLINE_PATTERN = /trampoline/i

// ── BUCKET: play-farm ─────────────────────────────────────────────────────
const FARM_PATTERN = /\bfarm\b/i

// ── BUCKET: family-attraction, HIGH confidence (definitely not soft play) ──
const NOT_SOFT_PLAY_CATEGORY_HIGH = [
  'aquarium', 'bowling alley', 'escape room', 'rock climbing gym', 'climbing gym',
  'climbing wall', 'toy shop', 'toy store', 'golf course', 'adventure golf',
  'mini golf', 'shopping centre', 'shopping mall', 'swimming pool', 'water park',
  'cinema', 'movie theater', 'museum', 'zoo', 'farm shop', 'garden centre',
  'wedding venue', 'pub', 'bar', 'hotel', 'church', 'car park', 'supermarket',
  'department store',
]
const NAME_KEYWORDS_HIGH = [
  /\bbowling\b/i, /\bbowl\b/i, /\bescape room/i, /\bclimbing\b/i, /\baquarium\b/i,
  /\btoys?\b.*(store|superstore|shop)/i, /\badventure golf\b/i, /\bmini golf\b/i,
  /\bface paint/i, /\bcinema\b/i, /\bmuseum\b/i, /\bzoo\b/i,
]

// ── MEDIUM: reported, not auto-bucketed — plausibly still contains real
// soft play, or needs a human call ──────────────────────────────────────
const MEDIUM_CATEGORIES = [
  'leisure centre', 'events venue', 'amusement park', 'indoor golf course',
  'arcade', 'party planner', 'bouncy castle hire', 'party equipment rental service',
]

function classify(v) {
  const cat = (v.category || '').toLowerCase()
  const name = v.name || ''

  if (cat === SUPPLIER_CATEGORY) return { action: 'delete', reason: `category="${v.category}"` }

  if (cat === 'playground' && PARK_PLAYGROUND_NAME.test(name)) {
    return { action: 'bucket', venueType: 'park-playground', reason: `category="Playground" + name matches park-playground pattern` }
  }

  if (TRAMPOLINE_PATTERN.test(name) || cat.includes('trampoline')) {
    return { action: 'bucket', venueType: 'trampoline-park', reason: TRAMPOLINE_PATTERN.test(name) ? `name matches /trampoline/` : `category="${v.category}"` }
  }

  if (FARM_PATTERN.test(name) || cat.includes('farm')) {
    return { action: 'bucket', venueType: 'play-farm', reason: FARM_PATTERN.test(name) ? `name matches /farm/` : `category="${v.category}"` }
  }

  for (const kw of NOT_SOFT_PLAY_CATEGORY_HIGH) {
    if (cat.includes(kw)) return { action: 'bucket', venueType: 'family-attraction', reason: `category="${v.category}"` }
  }
  for (const rx of NAME_KEYWORDS_HIGH) {
    if (rx.test(name)) return { action: 'bucket', venueType: 'family-attraction', reason: `name matches ${rx}` }
  }

  for (const kw of MEDIUM_CATEGORIES) {
    if (cat.includes(kw)) return { action: 'review', reason: `category="${v.category}"` }
  }

  return null
}

const pool = await getPool()
try {
  const { rows } = await pool.query(`SELECT id, name, category, venue_type FROM venues WHERE venue_type IS NULL OR venue_type = 'indoor'`)

  const toDelete = []
  const toBucket = []
  const toReview = []
  for (const v of rows) {
    const c = classify(v)
    if (!c) continue
    if (c.action === 'delete') toDelete.push({ v, ...c })
    else if (c.action === 'bucket') toBucket.push({ v, ...c })
    else toReview.push({ v, ...c })
  }

  const bucketCounts = toBucket.reduce((acc, { venueType }) => ((acc[venueType] = (acc[venueType] || 0) + 1), acc), {})
  const reviewCounts = toReview.reduce((acc, { v }) => {
    const cat = v.category || 'unknown'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {})

  console.log(`Scanned ${rows.length} venues currently classified as soft play.`)
  console.log(`  Delete (not a real venue): ${toDelete.length}`)
  console.log(`  Bucket (real venue, not soft play):`, bucketCounts)
  console.log(`  Review only, not auto-bucketed (plausibly still soft play):`, reviewCounts, `— ${toReview.length} total`)

  console.log(EXECUTE ? '\nEXECUTING — this will DELETE and UPDATE venue_type.' : '\nDRY RUN — no changes will be made.')

  await runBatched(toDelete, async ({ v, reason }) => {
    const check = await pool.query('SELECT id FROM venues WHERE id = $1', [v.id])
    if (!check.rows.length) { console.log(`  SKIP id=${v.id} "${v.name}" — already gone`); return 'skipped' }
    console.log(`  ${EXECUTE ? 'DELETE' : 'would DELETE'}  id=${v.id} "${v.name}" — ${reason}`)
    if (EXECUTE) await pool.query('DELETE FROM venues WHERE id = $1', [v.id])
  })

  await runBatched(toBucket, async ({ v, venueType, reason }) => {
    const check = await pool.query('SELECT id, venue_type FROM venues WHERE id = $1', [v.id])
    if (!check.rows.length) { console.log(`  SKIP id=${v.id} "${v.name}" — no longer in DB`); return 'skipped' }
    console.log(`  ${EXECUTE ? 'TAG' : 'would TAG'}  id=${v.id} "${v.name}" -> ${venueType} — ${reason}`)
    if (EXECUTE) await pool.query(`UPDATE venues SET venue_type = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [venueType, v.id])
  })
} finally {
  await pool.end()
}
