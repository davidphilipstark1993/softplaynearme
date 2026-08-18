// Merges the cross-city duplicate venues found by phase4-01-geo-distance-audit
// (same name, same coordinates, filed under two or three different cities —
// whole batches re-imported under a second city label, not scattered error).
//
// For each duplicate group:
//   1. Determine the correct city: postcode (ground truth, via _geo.mjs) if
//      any member has one and it resolves unambiguously; otherwise nearest
//      declared hub by distance.
//   2. Exception: if distance alone resolves to "mossley", prefer
//      "manchester" instead when Manchester is within 1.5x the distance —
//      Oldham/Tameside/Mottram read as Greater Manchester to anyone
//      searching "soft play near me", even though Mossley (a ~10k-person
//      town) is technically the nearest declared hub. Confirmed with the
//      site owner before writing this in.
//   3. Keep whichever member already has the correct city AND the most
//      complete data; if no member has the correct city, keep the most
//      complete member and correct its city_slug. Delete the rest, 301 the
//      deleted URLs to the survivor.
//   4. Skip groups with out-of-UK coordinates (data-integrity bug, not a
//      real duplicate) — reported separately, not auto-fixed here.
//
// Every survivor whose final city differs from its original city_slug is
// written to data/_phase4_needs_description_regen.json — the brief requires
// descriptions to be regenerated for any venue whose city changed, since the
// wrong city is baked into the stored text.
//
//   node scripts/migrations/phase4-02-merge-city-duplicates.mjs [--execute]

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

function normName(n) {
  return (n || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const FIELDS_FOR_COMPLETENESS = [
  'address', 'postcode', 'website', 'phone', 'description', 'opening_hours_text',
  'rating', 'reviews_count', 'main_image_url', 'price_from',
]
function completeness(v) {
  return FIELDS_FOR_COMPLETENESS.reduce((n, f) => n + (v[f] ? 1 : 0), 0)
}

const pool = await getPool()
const redirectsToAdd = []
const needsRegen = []

try {
  const { rows } = await pool.query(
    `SELECT id, name, slug, city_slug, address, postcode, lat, lng, phone, website, description,
            opening_hours_text, rating, reviews_count, main_image_url, price_from
     FROM venues WHERE lat IS NOT NULL AND lng IS NOT NULL`
  )

  const byCoord = {}
  for (const v of rows) {
    const key = `${parseFloat(v.lat).toFixed(4)},${parseFloat(v.lng).toFixed(4)}`
    ;(byCoord[key] ??= []).push(v)
  }

  const groups = Object.values(byCoord).filter((g) => {
    if (g.length < 2) return false
    const names = g.map((v) => normName(v.name))
    return names.every((n) => n === names[0]) // same-name only — different-name co-located businesses are left alone
  })

  console.log(`Found ${groups.length} same-name coordinate-duplicate groups.\n`)

  const validGroups = []
  let bogusCount = 0
  for (const g of groups) {
    const lat = parseFloat(g[0].lat), lng = parseFloat(g[0].lng)
    if (lat < 49 || lat > 61 || lng < -8 || lng > 2) {
      bogusCount++
      console.log(`  SKIP (bad coordinates, not UK) — ${g.map((v) => `id=${v.id} "${v.name}"`).join(' | ')} at ${lat},${lng}`)
      continue
    }
    validGroups.push(g)
  }
  console.log(`${bogusCount} group(s) skipped for out-of-UK coordinates (data bug, not a duplicate — needs separate lat/lng fix).\n`)

  console.log(EXECUTE ? 'EXECUTING — this will DELETE inferior duplicates, correct survivor city_slug where needed, and append redirects.' : 'DRY RUN — no changes will be made.')

  await runBatched(validGroups, async (g) => {
    const client = await pool.connect()
    try {
      const pos = [parseFloat(g[0].lat), parseFloat(g[0].lng)]

      // 1. Determine correct city — postcode ground truth first.
      let correctCity = null, basis = null
      for (const v of g) {
        if (!v.postcode) continue
        const resolved = expectedCitiesForPostcode(v.postcode)
        if (resolved && resolved.expected.length === 1) {
          correctCity = resolved.expected[0]
          basis = `postcode ${v.postcode} (${resolved.detail})`
          break
        }
      }
      // Fall back to nearest declared hub by distance.
      if (!correctCity) {
        const { best, bestDist } = nearestHub(pos)
        correctCity = best
        basis = `nearest hub by distance (${bestDist.toFixed(1)}mi)`
        // Mossley -> Manchester override (Greater Manchester satellite towns
        // read as Manchester to searchers even when a smaller declared hub
        // is technically closer).
        if (correctCity === 'mossley') {
          const mcrDist = haversineMiles(pos, HUB_COORDS.manchester)
          // Keep Mossley only when the venue is genuinely in Mossley itself
          // (<2mi) — everything else in this Tameside/Oldham cluster reads
          // as Greater Manchester to searchers even though Mossley (a
          // ~10k-person town) is technically closer on paper.
          if (bestDist >= 2 && mcrDist <= 10) {
            correctCity = 'manchester'
            basis = `mossley nearest (${bestDist.toFixed(1)}mi) but not in Mossley itself — Manchester (${mcrDist.toFixed(1)}mi) preferred, Greater Manchester override`
          }
        }
      }

      // 2. Pick survivor: prefer already-correct city_slug, then completeness.
      const ranked = [...g].sort((a, b) => {
        const aCorrect = a.city_slug === correctCity ? 1 : 0
        const bCorrect = b.city_slug === correctCity ? 1 : 0
        if (aCorrect !== bCorrect) return bCorrect - aCorrect
        return completeness(b) - completeness(a)
      })
      const keep = ranked[0]
      const remove = ranked.slice(1)
      const needsCityFix = keep.city_slug !== correctCity

      const check = await client.query('SELECT id, name, city_slug, slug FROM venues WHERE id = $1', [keep.id])
      if (check.rows.length === 0) {
        console.log(`  SKIP group — survivor id=${keep.id} "${keep.name}" no longer in DB`)
        return 'skipped'
      }
      const liveCitySlug = check.rows[0].city_slug

      console.log(`  Group "${keep.name}" [${basis}] -> correct city: ${correctCity}`)
      if (needsCityFix) {
        console.log(`    ${EXECUTE ? 'FIX' : 'would FIX'} survivor id=${keep.id}: city_slug ${liveCitySlug} -> ${correctCity}`)
        if (EXECUTE) {
          await client.query('UPDATE venues SET city_slug = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [correctCity, keep.id])
        }
        needsRegen.push({ id: keep.id, name: keep.name, slug: keep.slug, newCity: correctCity, oldCity: liveCitySlug })
      }

      for (const r of remove) {
        const rCheck = await client.query('SELECT id, name FROM venues WHERE id = $1', [r.id])
        if (rCheck.rows.length === 0) {
          console.log(`    SKIP id=${r.id} "${r.name}" — already gone`)
          continue
        }
        console.log(`    ${EXECUTE ? 'DELETE' : 'would DELETE'} id=${r.id} (was ${r.city_slug}) -> redirect to id=${keep.id} (${correctCity})`)
        if (EXECUTE) {
          await client.query('DELETE FROM venues WHERE id = $1', [r.id])
        }
        redirectsToAdd.push({
          source: `/soft-play/${r.city_slug}/${r.slug}`,
          destination: `/soft-play/${correctCity}/${keep.slug}`,
          permanent: true,
        })
      }
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
  writeFileSync('data/_phase4_needs_description_regen.json', JSON.stringify(needsRegen, null, 2))
  console.log(`${EXECUTE ? '' : 'Would write: '}${needsRegen.length} survivor(s) need description regeneration -> data/_phase4_needs_description_regen.json`)
}
