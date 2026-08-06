// Merges duplicate venues — the same real-world place ingested twice. Two
// independent signals, each queried live from the database:
//
//   A. Same phone number, same city — the original signal (see
//      reports/data-quality-audit.md §5). Domain-only matching was tried and
//      discarded there (franchise brands share a domain across genuinely
//      different premises); phone is specific to one physical location.
//      Auto-merges only when name similarity also backs up the phone match.
//
//   B. Same name + same review count + same rating, different slug/address —
//      the same real place scraped twice into different rows (e.g. under two
//      slightly different addresses). Two independent venues coincidentally
//      sharing an exact review count AND exact rating AND exact name is
//      vanishingly unlikely, so this auto-merges without needing name-fuzz
//      confirmation.
//
// Keeps whichever venue in a group has the most complete data (non-empty
// field count), deletes the other(s), and queues a 301 to the survivor via
// data/redirects.json.
//
//   node scripts/migrations/phase2-05-merge-duplicates.mjs [--execute]

import { EXECUTE, getPool, runBatched, appendRedirects } from './_lib.mjs'

function normPhone(p) {
  if (!p) return null
  const digits = String(p).replace(/\D/g, '')
  return digits.length >= 9 ? digits.slice(-9) : null
}
function normName(n) {
  return (n || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const FIELDS_FOR_COMPLETENESS = [
  'address', 'postcode', 'website', 'phone', 'description', 'opening_hours',
  'rating', 'reviews_count', 'main_image_url', 'price_from',
]
function completeness(v) {
  return FIELDS_FOR_COMPLETENESS.reduce((n, f) => n + (v[f] ? 1 : 0), 0)
}

const pool = await getPool()
const redirectsToAdd = []

try {
  const { rows } = await pool.query(
    `SELECT id, name, slug, city_slug, phone, address, postcode, website, description,
            opening_hours, rating, reviews_count, main_image_url, price_from
     FROM venues`
  )

  // ── Signal A: phone + city ──────────────────────────────────────────────
  const byPhoneCity = {}
  for (const v of rows) {
    const p = normPhone(v.phone)
    if (!p) continue
    const key = `${p}|${v.city_slug}`
    ;(byPhoneCity[key] ??= []).push(v)
  }
  const phoneGroups = Object.values(byPhoneCity)
    .filter((g) => g.length > 1)
    .map((g) => {
      const names = g.map((v) => normName(v.name))
      const nameSimilar = names.some((a, i) => names.some((b, j) => i !== j && a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a))))
      return { matchType: 'phone', town: g[0].city_slug, confidence: nameSimilar ? 'HIGH' : 'MEDIUM', venues: g }
    })

  // ── Signal C: phone + postcode, ANY city ────────────────────────────────
  // Signal A only catches duplicates already filed under the same city — but
  // the exact scraping bug that causes wrong-city venues (a wide-radius
  // Google search pulling in a venue under two different city batches) also
  // produces duplicates that land under two different (both often wrong)
  // cities. Phone + postcode both matching is direct proof of the same
  // physical premises regardless of which city each copy was filed under —
  // stronger than phone alone, since a franchise's shared central phone line
  // wouldn't also share a single street-level postcode.
  const byPhonePostcode = {}
  for (const v of rows) {
    const p = normPhone(v.phone)
    if (!p || !v.postcode) continue
    const key = `${p}|${v.postcode.replace(/\s+/g, '').toUpperCase()}`
    ;(byPhonePostcode[key] ??= []).push(v)
  }
  const crossCityGroups = Object.values(byPhonePostcode)
    .filter((g) => g.length > 1)
    .filter((g) => new Set(g.map((v) => v.city_slug)).size > 1) // only the cross-city case; same-city already covered by Signal A
    .map((g) => ({ matchType: 'phone+postcode (cross-city)', town: g[0].city_slug, confidence: 'HIGH', venues: g }))

  // ── Signal B: name + reviewCount + rating ───────────────────────────────
  const byNameCountRating = {}
  for (const v of rows) {
    if (v.reviews_count == null || v.rating == null) continue
    if (Number(v.reviews_count) === 0) continue // 0 reviews is too common to be a useful signal
    const key = `${normName(v.name)}|${v.city_slug}|${v.reviews_count}|${v.rating}`
    ;(byNameCountRating[key] ??= []).push(v)
  }
  const statGroups = Object.values(byNameCountRating)
    .filter((g) => g.length > 1)
    .filter((g) => new Set(g.map((v) => v.slug)).size > 1) // different slugs, i.e. actually two rows
    .map((g) => ({ matchType: 'name+reviews+rating', town: g[0].city_slug, confidence: 'HIGH', venues: g }))

  const highGroups = [...phoneGroups.filter((g) => g.confidence === 'HIGH'), ...crossCityGroups, ...statGroups]
  const mediumGroups = phoneGroups.filter((g) => g.confidence === 'MEDIUM')

  console.log(`Found ${phoneGroups.length} phone-match groups (${phoneGroups.filter(g=>g.confidence==='HIGH').length} HIGH, ${mediumGroups.length} MEDIUM), ${crossCityGroups.length} cross-city phone+postcode groups, and ${statGroups.length} name+reviews+rating groups.`)
  console.log(`Auto-merging ${highGroups.length} HIGH-confidence groups. MEDIUM groups need a manual look:`)
  for (const g of mediumGroups) {
    console.log(`  MANUAL  ${g.town}: ${g.venues.map((v) => v.name).join(' <-> ')}`)
  }

  console.log(EXECUTE ? '\nEXECUTING — this will DELETE the less-complete duplicate(s) and append to data/redirects.json.' : '\nDRY RUN — no changes will be made.')

  await runBatched(highGroups, async (g) => {
    const client = await pool.connect()
    try {
      const ranked = [...g.venues].sort((a, b) => completeness(b) - completeness(a))
      const keep = ranked[0]
      const remove = ranked.slice(1)

      const keepCheck = await client.query('SELECT id, name, city_slug FROM venues WHERE id = $1', [keep.id])
      if (keepCheck.rows.length === 0) {
        console.log(`  SKIP  ${g.town} group — survivor id=${keep.id} "${keep.name}" no longer in DB`)
        return 'skipped'
      }
      const keepCitySlug = keepCheck.rows[0].city_slug
      for (const r of remove) {
        const rCheck = await client.query('SELECT id, name FROM venues WHERE id = $1', [r.id])
        if (rCheck.rows.length === 0) {
          console.log(`  SKIP  id=${r.id} "${r.name}" — already gone`)
          continue
        }
        console.log(`  ${EXECUTE ? 'MERGE' : 'would MERGE'}  [${g.matchType}] "${r.name}" (id=${r.id}, ${r.city_slug}) -> "${keep.name}" (id=${keep.id}, ${keepCitySlug})`)
        if (EXECUTE) {
          await client.query('DELETE FROM venues WHERE id = $1', [r.id])
        }
        redirectsToAdd.push({
          source: `/soft-play/${r.city_slug}/${r.slug}`,
          destination: `/soft-play/${keepCitySlug}/${keep.slug}`,
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
