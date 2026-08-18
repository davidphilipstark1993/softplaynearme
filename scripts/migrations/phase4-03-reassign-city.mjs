// Follow-up to phase4-02 (duplicate merge). Handles the remaining
// non-duplicate mis-tags: a single venue record filed under the wrong city,
// with no second copy to merge — just a direct city_slug correction.
//
// Same correctness logic as phase4-02: postcode (ground truth, via _geo.mjs)
// where available, else nearest declared hub by distance, with the
// Mossley->Manchester override for the Tameside/Oldham cluster. Only moves
// a venue when its assigned city is clearly wrong (>15mi from its own hub)
// and a different hub is clearly right (<=15mi away) — anything more
// marginal than that is left alone as a boundary case for manual review,
// not auto-moved.
//
//   node scripts/migrations/phase4-03-reassign-city.mjs [--execute]

import { writeFileSync } from 'fs'
import { EXECUTE, getPool, runBatched, appendRedirects } from './_lib.mjs'
import { expectedCitiesForPostcode } from './_geo.mjs'

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

function nearestHub(pos) {
  let best = null, bestDist = Infinity
  for (const [slug, coord] of Object.entries(HUB_COORDS)) {
    const d = haversineMiles(pos, coord)
    if (d < bestDist) { bestDist = d; best = slug }
  }
  return { best, bestDist }
}

const REASSIGN_ASSIGNED_MIN = 15
const REASSIGN_NEAREST_MAX = 15

const pool = await getPool()
const redirectsToAdd = []
const needsRegen = []

try {
  const { rows } = await pool.query(
    `SELECT id, name, slug, city_slug, address, postcode, lat, lng
       FROM venues WHERE lat IS NOT NULL AND lng IS NOT NULL ORDER BY id`
  )

  const candidates = []
  for (const v of rows) {
    const lat = parseFloat(v.lat), lng = parseFloat(v.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue
    if (lat < 49 || lat > 61 || lng < -8 || lng > 2) continue // out-of-UK coords, separate data bug
    const pos = [lat, lng]

    let correctCity = null, basis = null
    if (v.postcode) {
      const resolved = expectedCitiesForPostcode(v.postcode)
      if (resolved && resolved.expected.length === 1) {
        correctCity = resolved.expected[0]
        basis = `postcode ${v.postcode} (${resolved.detail})`
      }
    }
    if (!correctCity) {
      const { best, bestDist } = nearestHub(pos)
      const assignedDist = HUB_COORDS[v.city_slug] ? haversineMiles(pos, HUB_COORDS[v.city_slug]) : null
      let candidateCity = best
      if (candidateCity === 'mossley' && bestDist >= 2) {
        const mcrDist = haversineMiles(pos, HUB_COORDS.manchester)
        if (mcrDist <= 10) candidateCity = 'manchester'
      }
      if (candidateCity !== v.city_slug && (assignedDist == null || assignedDist > REASSIGN_ASSIGNED_MIN) && bestDist <= REASSIGN_NEAREST_MAX) {
        correctCity = candidateCity
        basis = `nearest hub by distance (${bestDist.toFixed(1)}mi, was ${assignedDist != null ? assignedDist.toFixed(1) + 'mi' : '?'} from assigned hub)`
      }
    }
    if (correctCity && correctCity !== v.city_slug) {
      candidates.push({ v, correctCity, basis })
    }
  }

  console.log(`${candidates.length} venues to reassign.\n`)
  console.log(EXECUTE ? 'EXECUTING — this will UPDATE city_slug and append redirects.' : 'DRY RUN — no changes will be made.')

  await runBatched(candidates, async ({ v, correctCity, basis }) => {
    const client = await pool.connect()
    try {
      const check = await client.query('SELECT id, name, city_slug FROM venues WHERE id = $1', [v.id])
      if (check.rows.length === 0) {
        console.log(`  SKIP  id=${v.id} "${v.name}" — no longer in DB`)
        return 'skipped'
      }
      if (check.rows[0].city_slug !== v.city_slug) {
        console.log(`  SKIP  id=${v.id} — city_slug already changed since scan`)
        return 'skipped'
      }
      console.log(`  ${EXECUTE ? 'MOVE' : 'would MOVE'}  id=${v.id} "${v.name}": ${v.city_slug} -> ${correctCity}  [${basis}]`)
      if (EXECUTE) {
        await client.query('UPDATE venues SET city_slug = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [correctCity, v.id])
      }
      redirectsToAdd.push({
        source: `/soft-play/${v.city_slug}/${v.slug}`,
        destination: `/soft-play/${correctCity}/${v.slug}`,
        permanent: true,
      })
      needsRegen.push({ id: v.id, name: v.name, slug: v.slug, newCity: correctCity, oldCity: v.city_slug })
      return 'ok'
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
if (needsRegen.length) {
  writeFileSync('data/_phase4_reassign_needs_regen.json', JSON.stringify(needsRegen, null, 2))
  console.log(`${needsRegen.length} venue(s) need description regeneration -> data/_phase4_reassign_needs_regen.json`)
}
