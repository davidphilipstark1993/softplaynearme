#!/usr/bin/env node
/**
 * Discover new soft play venues via the Google Places Text Search API and
 * insert them into `venues`. None of the other scripts in this repo do
 * discovery — enrich-venues.mjs and fetch-google-ratings.mjs only add detail
 * to venues that already exist. This is the missing "find new ones" step.
 *
 * Dry-run by default — prints what it would insert without touching the DB.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=AIza... node scripts/discover-google-places-venues.mjs --city london
 *   GOOGLE_PLACES_API_KEY=AIza... node scripts/discover-google-places-venues.mjs --city london --commit
 */

import pg from 'pg'
import { toSlug, extractLikelyPostcode, normalizeUkPostcode } from './enrichment-utils.mjs'

const { Pool } = pg

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('DATABASE_URL is not set. Export it or run via a tool that loads .env.local.')
  process.exit(1)
}
const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY
if (!API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY environment variable is required.')
  process.exit(1)
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg) => {
    if (arg === '--commit') pairs.push(['commit', true])
    else if (arg.startsWith('--city=')) pairs.push(['city', arg.replace('--city=', '')])
    return pairs
  }, [])
)
const commit = !!args.commit
const citySlug = args.city
if (!citySlug) {
  console.error('Usage: node scripts/discover-google-places-venues.mjs --city=<slug> [--commit]')
  process.exit(1)
}

// City search centres + a few query variants to cast a reasonably wide net
// across genuine soft play / indoor play venue naming conventions.
const CITY_CENTRES = {
  london: { lat: 51.5074, lng: -0.1278, radius: 25000, name: 'London' },
}

const center = CITY_CENTRES[citySlug]
if (!center) {
  console.error(`No search centre configured for city "${citySlug}" — add one to CITY_CENTRES.`)
  process.exit(1)
}

const QUERIES = [
  `soft play ${center.name}`,
  `indoor play centre ${center.name}`,
  `children's play centre ${center.name}`,
  `soft play cafe ${center.name}`,
  `kids indoor play area ${center.name}`,
]

async function textSearch(query) {
  const results = []
  let pageToken = null
  let page = 0
  do {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
    url.searchParams.set('query', query)
    url.searchParams.set('location', `${center.lat},${center.lng}`)
    url.searchParams.set('radius', String(center.radius))
    url.searchParams.set('key', API_KEY)
    if (pageToken) url.searchParams.set('pagetoken', pageToken)

    // Google requires a short delay before a pagetoken becomes valid.
    if (pageToken) await new Promise((r) => setTimeout(r, 2000))

    const res = await fetch(url)
    const data = await res.json()
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error(`  [warn] "${query}" page ${page + 1}: ${data.status} ${data.error_message || ''}`)
      break
    }
    results.push(...(data.results || []))
    pageToken = data.next_page_token || null
    page++
  } while (pageToken && page < 3)
  return results
}

function looksLikeSoftPlay(place) {
  const name = (place.name || '').toLowerCase()
  const types = place.types || []
  if (types.includes('lodging') || types.includes('school') || types.includes('gym')) return false
  const keywords = ['soft play', 'play centre', 'play center', 'indoor play', 'play cafe', 'play café', 'kids play', "children's play", 'play zone', 'play world', 'play barn', 'play farm']
  return keywords.some((k) => name.includes(k))
}

async function main() {
  console.log(`Discovering new venues for ${center.name} (${citySlug})${commit ? ' — COMMITTING' : ' — DRY RUN'}\n`)

  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  const existing = await client.query(
    `SELECT place_id, google_place_id, name, address FROM venues WHERE city_slug = $1`,
    [citySlug]
  )
  const knownPlaceIds = new Set(
    existing.rows.flatMap((r) => [r.place_id, r.google_place_id].filter(Boolean))
  )
  // Name-based dedup within the same city — Google's Text Search can hand
  // back a different place_id for a business that's already in the DB
  // (duplicate/merged Google listings, or the existing row was imported from
  // a non-Google source and never had a place_id at all), so place_id alone
  // isn't reliable. A normalised exact-name match within the same city is a
  // stronger signal than it sounds — false positives here would only cause
  // a missed insert, not a bad one, whereas the reverse creates duplicates.
  const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const knownNames = new Set(existing.rows.map((r) => normalizeName(r.name)))
  // Same building, different trading name (rename/rebrand, or a duplicate
  // Google listing) — a street-address match on its own is a strong enough
  // signal to exclude, since two unrelated soft play venues sharing one
  // street address is implausible.
  const normalizeAddress = (s) => String(s || '').split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
  const knownAddresses = new Set(existing.rows.map((r) => normalizeAddress(r.address)).filter(Boolean))
  console.log(`${existing.rows.length} existing venues in ${citySlug} (${knownPlaceIds.size} with a place_id).\n`)

  const seen = new Map() // place_id -> place
  for (const q of QUERIES) {
    console.log(`Searching: "${q}"`)
    const results = await textSearch(q)
    console.log(`  -> ${results.length} results`)
    for (const place of results) {
      if (!place.place_id || seen.has(place.place_id)) continue
      seen.set(place.place_id, place)
    }
  }

  const addressMatches = []
  const candidates = [...seen.values()].filter((p) => {
    if (knownPlaceIds.has(p.place_id)) return false
    if (knownNames.has(normalizeName(p.name))) return false
    if (!looksLikeSoftPlay(p)) return false
    if (p.business_status === 'CLOSED_PERMANENTLY') return false
    if (knownAddresses.has(normalizeAddress(p.formatted_address))) {
      addressMatches.push(p)
      return false
    }
    return true
  })

  console.log(`\n${seen.size} unique places found across all queries.`)
  console.log(`${candidates.length} are new, look like genuine soft play venues, and aren't permanently closed.`)
  if (addressMatches.length > 0) {
    console.log(`${addressMatches.length} excluded — same street address as an existing venue under a different name (likely a rename/rebrand, needs a human look, not an auto-insert):`)
    for (const p of addressMatches) console.log(`  ? ${p.name} — ${p.formatted_address}`)
  }
  console.log()

  let inserted = 0
  for (const place of candidates) {
    const postcode = normalizeUkPostcode(extractLikelyPostcode(place.formatted_address || '')) || null
    const baseSlug = toSlug(place.name)
    let slug = baseSlug
    let suffix = 2
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const clash = await client.query(`SELECT 1 FROM venues WHERE city_slug = $1 AND slug = $2 LIMIT 1`, [citySlug, slug])
      if (clash.rows.length === 0) break
      slug = `${baseSlug}-${suffix++}`
    }

    console.log(`+ ${place.name} — ${place.formatted_address} (${place.rating ?? '?'}★, ${place.user_ratings_total ?? 0} reviews)`)

    if (commit) {
      await client.query(
        `INSERT INTO venues
           (name, slug, city_slug, address, postcode, lat, lng, rating, reviews_count,
            place_id, google_place_id, category, needs_review, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Indoor playground', true, NULL)`,
        [
          place.name,
          slug,
          citySlug,
          place.formatted_address || null,
          postcode,
          place.geometry?.location?.lat ?? null,
          place.geometry?.location?.lng ?? null,
          place.rating ?? null,
          place.user_ratings_total ?? null,
          place.place_id,
          place.place_id,
        ]
      )
      inserted++
    }
  }

  client.release()
  await pool.end()

  if (commit) {
    console.log(`\nInserted ${inserted} new venues into ${citySlug}, all flagged needs_review=true.`)
    console.log('Next: run scripts/fetch-google-ratings.mjs and scripts/enrich-venues.mjs to fill in phone/website/hours, then scripts/rebuild-static-json.mjs.')
  } else {
    console.log('\nDry run — nothing written. Re-run with --commit to insert these.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
