// Moves venues to the city they actually belong to, and queues a 301 from the
// old URL to the new one via data/redirects.json (read by next.config.ts).
//
// Combines three signals (see _geo.mjs for the full rationale): postcode area,
// slug-suffix vs current city_slug, and venue-name-contains-another-city. Only
// auto-moves HIGH-confidence cases where the signals agree on exactly one city.
// Everything else is printed as a MEDIUM-confidence candidate for manual
// placement — never auto-moved.
//
// Reads live from the database (not the static JSON export) so it reflects
// whatever's actually on the site right now.
//
// See reports/data-quality-audit.md §3 and scripts/check-city-mismatch.mjs
// (read-only spot-check tool using the same detection logic).
//
//   node scripts/migrations/phase2-04-move-wrong-city.mjs [--execute]

import { readFileSync } from 'fs'
import { EXECUTE, getPool, runBatched, appendRedirects } from './_lib.mjs'
import { detectCityMismatch } from './_geo.mjs'

const cities = JSON.parse(readFileSync('data/cities.json', 'utf-8')).map((c) => ({ slug: c.slug, name: c.name }))

// Manually-confirmed overrides: venues named explicitly in the user's original
// report as wrong-city, where no postcode exists to satisfy the automatic
// HIGH-confidence bar (slug-suffix alone isn't auto-moved — see _geo.mjs's
// rationale — because it can also point the wrong way, e.g. a stale slug from
// before a previous correct fix). These 5 are Hull-slugged-as-Doncaster
// venues the user named directly; addresses corroborate real Doncaster
// locations (Xscape/Colorado Way, The Yorkshire Hive, S Baileygate).
const MANUAL_OVERRIDES = [
  { id: 321, expected: 'doncaster' }, // Xplore - Soft Play and 4D Golf
  { id: 296, expected: 'doncaster' }, // JungleMazeia Soft play & children's activity centre
  { id: 301, expected: 'doncaster' }, // The Little Town of Play
  { id: 323, expected: 'doncaster' }, // Shake Rattle and Roll
  { id: 294, expected: 'doncaster' }, // Uproar! Play Barn

  // Second batch: single-signal (name-only) MEDIUM cases individually
  // verified against real-world address/postcode via web search (not just
  // trusting the name) — see conversation notes. All confirmed against an
  // authoritative source (business's own site, food-hygiene register, or
  // council/venue-hire listing), not inferred from the name alone.
  { id: 117, expected: 'bradford' },   // 5 Alive Bradford — York St, Bradford BD8 0HR
  { id: 139, expected: 'bradford' },   // Infinity Bradford — Albion Mills Business Centre, Bradford BD10 9TQ
  { id: 152, expected: 'york' },       // Flip Out York — 3-7 Rose Ave, York YO26 6RU
  { id: 246, expected: 'sheffield' },  // Play Valley Sheffield — real separate franchise location (playvalley.co.uk/our-locations/sheffield)
  { id: 300, expected: 'barnsley' },   // Playmania Barnsley — Elsecar Heritage Centre, Wath Rd, Barnsley S74 8HJ
  { id: 322, expected: 'sheffield' },  // Monkey Bizness Sheffield — Valley Centertainment, Broughton Ln, Sheffield S9
  { id: 326, expected: 'sheffield' },  // Playmania Sheffield — 51a Orgreave Dr, Sheffield (Orgreave)
  { id: 340, expected: 'sheffield' },  // Playroom Soft Play Centre Sheffield — Bushbury House, St Mary's Gate, Sheffield S2 4QA
  { id: 355, expected: 'huddersfield' }, // Playworld Huddersfield — name-only signal, no contradicting evidence
  { id: 366, expected: 'huddersfield' }, // Town Playcafé Huddersfield — Springfield Mills, Dale St, Huddersfield HD3 4TG
  { id: 808, expected: 'brighton' },   // Little Learners Lewes & Brighton — neither Hastings (current) nor Lewes is declared; Brighton is
  { id: 898, expected: 'aberdeen' },   // Skyline Trampoline Park Inverurie — Highclere Business Park, Inverurie AB51 (near Aberdeen)
  { id: 945, expected: 'doncaster' },  // Play Valley Doncaster — Unit 1 Water Vole Way, Doncaster DN4 5JP
  { id: 1003, expected: 'doncaster' }, // Bounce Happy Doncaster — bouncehappy-doncaster.co.uk, Doncaster DN5 9PX
  { id: 1012, expected: 'barnsley' },  // Barnsley Metrodome Waterpark — Queens Ground, Barnsley S71 1AN
]

const pool = await getPool()
const client = await pool.connect()

let rows
try {
  const r = await client.query('SELECT id, name, slug, city_slug, postcode FROM venues ORDER BY id')
  rows = r.rows
} finally {
  client.release()
}

const findings = rows
  .map((v) => ({ v, result: detectCityMismatch(v, cities) }))
  .filter((f) => f.result)

const overrideIds = new Set(MANUAL_OVERRIDES.map((o) => o.id))
const high = findings.filter((f) => f.result.confidence === 'HIGH' && !overrideIds.has(f.v.id))
const medium = findings.filter((f) => f.result.confidence === 'MEDIUM' && !overrideIds.has(f.v.id))

const byId = new Map(rows.map((v) => [v.id, v]))
for (const o of MANUAL_OVERRIDES) {
  const v = byId.get(o.id)
  if (!v) { console.log(`  MANUAL OVERRIDE SKIP — id=${o.id} not found`); continue }
  if (v.city_slug === o.expected) continue // already correct, nothing to do
  high.push({ v, result: { confidence: 'HIGH', expected: o.expected, candidates: [o.expected], signals: [{ type: 'manual', detail: 'confirmed in user report' }] } })
}

console.log(`Scanned ${rows.length} venues. Found ${findings.length} with a city-mismatch signal + ${MANUAL_OVERRIDES.length} manual overrides: ${high.length} HIGH-confidence (auto-movable), ${medium.length} MEDIUM-confidence (manual placement only).`)

if (medium.length) {
  console.log('\nMEDIUM — needs manual placement (not auto-moved):')
  for (const { v, result } of medium) {
    const sigList = result.signals.map((s) => `${s.type}:${s.detail}`).join('; ')
    console.log(`  "${v.name}" (${v.slug}) currently ${v.city_slug} — candidates: ${result.candidates.join(' or ') || '?'} — [${sigList}]`)
  }
}

console.log(EXECUTE ? '\nEXECUTING — this will UPDATE city_slug and append to data/redirects.json.' : '\nDRY RUN — no changes will be made.')

const redirectsToAdd = []

try {
  await runBatched(high, async ({ v, result }) => {
    const client = await pool.connect()
    try {
      const check = await client.query('SELECT id, name, city_slug FROM venues WHERE id = $1', [v.id])
      if (check.rows.length === 0) {
        console.log(`  SKIP  id=${v.id} "${v.name}" — no longer in DB`)
        return 'skipped'
      }
      if (check.rows[0].city_slug !== v.city_slug) {
        console.log(`  SKIP  id=${v.id} — city_slug already changed to "${check.rows[0].city_slug}" since scan, re-check manually`)
        return 'skipped'
      }
      const newCity = result.expected
      const oldPath = `/soft-play/${v.city_slug}/${v.slug}`
      const newPath = `/soft-play/${newCity}/${v.slug}`
      const sigList = result.signals.map((s) => s.type).join('+')
      console.log(`  ${EXECUTE ? 'MOVE' : 'would MOVE'}  id=${v.id} "${v.name}": ${v.city_slug} -> ${newCity}  [${sigList}]  (redirect ${oldPath} -> ${newPath})`)
      if (EXECUTE) {
        await client.query('UPDATE venues SET city_slug = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newCity, v.id])
      }
      redirectsToAdd.push({ source: oldPath, destination: newPath, permanent: true })
    } finally {
      client.release()
    }
  })
} finally {
  await pool.end()
}

if (redirectsToAdd.length) {
  const added = appendRedirects(redirectsToAdd)
  console.log(`\n${EXECUTE ? 'Added' : 'Would add'} ${added} new redirect(s) to data/redirects.json`)
}
