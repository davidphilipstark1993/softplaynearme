// Read-only report: cross-checks every venue's city_slug against its own
// lat/lng, independent of postcode. Built because detectCityMismatch()
// (_geo.mjs) needs a postcode, slug-suffix, or declared-city-name match to
// fire a signal — and 725/1877 live venues (39%) have no postcode at all,
// so a large share of mis-tagged venues (especially ones named after a real
// but non-declared town, e.g. "Bounce Central Oldham") are invisible to it.
// lat/lng coverage is 99.2% (1862/1877), so distance-to-hub is the more
// complete signal here; postcode/_geo.mjs stays authoritative where present.
//
// Does not write anything. Outputs a grouped report to stdout and a full
// JSON dump to data/_geo_distance_findings.json for review.
//
//   node scripts/migrations/phase4-01-geo-distance-audit.mjs

import { readFileSync, writeFileSync } from 'fs'
import { getPool } from './_lib.mjs'

// Well-known UK city/town-centre coordinates for every declared hub in
// data/cities.json. Public geography, not derived from any proprietary source.
const HUB_COORDS = {
  aberdeen: [57.1497, -2.0943], barnsley: [53.5526, -1.4797], beverley: [53.8459, -0.4269],
  birmingham: [52.4862, -1.8904], blackpool: [53.8175, -3.0357], bolton: [53.5769, -2.4282],
  bournemouth: [50.7192, -1.8808], bradford: [53.7960, -1.7594], bridlington: [54.0827, -0.1922],
  brighton: [50.8225, -0.1372], bristol: [51.4545, -2.5879], cardiff: [51.4816, -3.1791],
  colchester: [51.8959, 0.8919], crewe: [53.0977, -2.4425], doncaster: [53.5228, -1.1285],
  edinburgh: [55.9533, -3.1883], glasgow: [55.8642, -4.2518], halifax: [53.7218, -1.8637],
  hastings: [50.8543, 0.5730], huddersfield: [53.6458, -1.7850], hull: [53.7457, -0.3367],
  inverness: [57.4778, -4.2247], ipswich: [52.0567, 1.1482], leeds: [53.8008, -1.5491],
  leicester: [52.6369, -1.1398], lincoln: [53.2307, -0.5406], liverpool: [53.4084, -2.9916],
  llanelli: [51.6809, -4.1626], london: [51.5074, -0.1278], manchester: [53.4808, -2.2426],
  mossley: [53.5178, -2.0413], newcastle: [54.9783, -1.6178], norwich: [52.6309, 1.2974],
  nottingham: [52.9548, -1.1581], portsmouth: [50.8198, -1.0880], sheffield: [53.3811, -1.4701],
  southend: [51.5459, 0.7077], stoke: [53.0027, -2.1794], sunderland: [54.9069, -1.3838],
  swansea: [51.6214, -3.9436], worthing: [50.8180, -0.3714], york: [53.9600, -1.0873],
}

function haversineMiles([lat1, lng1], [lat2, lng2]) {
  const R = 3958.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// Thresholds, chosen for UK town-spacing:
// - REASSIGN: assigned hub is implausibly far (>15mi) AND a different hub is
//   genuinely close (<=15mi) -> venue is almost certainly just mis-stamped
//   with a neighbouring/search-batch city, safe to move directly.
// - REVIEW: nearest hub is meaningfully closer than assigned but not by the
//   REASSIGN margin, or assigned is moderately far -> boundary case, don't
//   auto-move.
// - NO_HUB_NEARBY: nearest declared hub is still >15mi away regardless of
//   what's assigned -> venue's true town likely has no hub page at all;
//   this is the "near-X vs exclude" policy decision, not a mechanical move.
const REASSIGN_ASSIGNED_MIN = 15
const REASSIGN_NEAREST_MAX = 15
const NO_HUB_MAX = 15

const pool = await getPool()
const client = await pool.connect()
let rows
try {
  const r = await client.query(
    `SELECT id, name, slug, city_slug, address, postcode, lat, lng, phone
       FROM venues ORDER BY id`
  )
  rows = r.rows
} finally {
  client.release()
  await pool.end()
}

const withCoords = rows.filter((v) => v.lat != null && v.lng != null)
console.log(`${rows.length} total venues, ${withCoords.length} with lat/lng (${rows.length - withCoords.length} skipped, no coordinates).\n`)

const reassign = []
const review = []
const noHubNearby = []
const ok = []

for (const v of withCoords) {
  const pos = [parseFloat(v.lat), parseFloat(v.lng)]
  if (Number.isNaN(pos[0]) || Number.isNaN(pos[1])) continue

  let nearestHub = null
  let nearestDist = Infinity
  let assignedDist = HUB_COORDS[v.city_slug] ? haversineMiles(pos, HUB_COORDS[v.city_slug]) : null

  for (const [slug, coord] of Object.entries(HUB_COORDS)) {
    const d = haversineMiles(pos, coord)
    if (d < nearestDist) {
      nearestDist = d
      nearestHub = slug
    }
  }

  const entry = { id: v.id, name: v.name, slug: v.slug, city_slug: v.city_slug, address: v.address, postcode: v.postcode, assignedDist: assignedDist != null ? +assignedDist.toFixed(1) : null, nearestHub, nearestDist: +nearestDist.toFixed(1) }

  if (nearestHub === v.city_slug) {
    ok.push(entry)
    continue
  }

  if (nearestDist > NO_HUB_MAX) {
    noHubNearby.push(entry)
  } else if ((assignedDist == null || assignedDist > REASSIGN_ASSIGNED_MIN) && nearestDist <= REASSIGN_NEAREST_MAX) {
    reassign.push(entry)
  } else {
    review.push(entry)
  }
}

console.log(`OK (nearest hub matches assigned city): ${ok.length}`)
console.log(`REASSIGN (assigned hub implausibly far, different hub close): ${reassign.length}`)
console.log(`REVIEW (boundary case, needs a human look): ${review.length}`)
console.log(`NO_HUB_NEARBY (no declared hub within ${NO_HUB_MAX}mi at all): ${noHubNearby.length}`)

console.log(`\n--- REASSIGN: by current city -> proposed city ---`)
const reassignByPair = {}
for (const e of reassign) {
  const key = `${e.city_slug} -> ${e.nearestHub}`
  ;(reassignByPair[key] ??= []).push(e)
}
for (const [pair, list] of Object.entries(reassignByPair).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${pair}: ${list.length}`)
}

console.log(`\n--- NO_HUB_NEARBY: clustered by nearest-hub + rough locality (from address) ---`)
// Group by current city_slug so the report reads city-by-city like the brief.
const noHubByCurrentCity = {}
for (const e of noHubNearby) {
  ;(noHubByCurrentCity[e.city_slug] ??= []).push(e)
}
for (const [city, list] of Object.entries(noHubByCurrentCity).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  currently "${city}": ${list.length} venues with no declared hub within ${NO_HUB_MAX}mi`)
  for (const e of list.slice(0, 30)) {
    console.log(`    "${e.name}" (${e.address || 'no address'}) — nearest hub ${e.nearestHub} is ${e.nearestDist}mi away`)
  }
  if (list.length > 30) console.log(`    ... and ${list.length - 30} more`)
}

console.log(`\n--- REVIEW: boundary cases ---`)
for (const e of review.slice(0, 40)) {
  console.log(`  "${e.name}" currently ${e.city_slug} (${e.assignedDist}mi from its hub) — ${e.nearestHub} is ${e.nearestDist}mi away`)
}
if (review.length > 40) console.log(`  ... and ${review.length - 40} more`)

// Near-identical-coordinate duplicate scan (catches same-venue-two-cities
// cases that phone/address dedupe missed, e.g. one record has no place_id).
console.log(`\n--- Possible duplicates (same coordinates, different city or record) ---`)
const byRoundedCoord = {}
for (const v of withCoords) {
  const key = `${parseFloat(v.lat).toFixed(4)},${parseFloat(v.lng).toFixed(4)}`
  ;(byRoundedCoord[key] ??= []).push(v)
}
let coordDupeCount = 0
for (const [key, list] of Object.entries(byRoundedCoord)) {
  if (list.length > 1) {
    coordDupeCount++
    console.log(`  ${key}: ${list.map((v) => `id=${v.id} "${v.name}" (${v.city_slug})`).join(' | ')}`)
  }
}
console.log(`Total coordinate-duplicate groups: ${coordDupeCount}`)

writeFileSync('data/_geo_distance_findings.json', JSON.stringify({ ok: ok.length, reassign, review, noHubNearby, coordDuplicateGroups: Object.values(byRoundedCoord).filter((l) => l.length > 1) }, null, 2))
console.log(`\nFull findings written to data/_geo_distance_findings.json`)
