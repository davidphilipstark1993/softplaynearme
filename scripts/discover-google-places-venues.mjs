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

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { toSlug, extractLikelyPostcode, normalizeUkPostcode } from './enrichment-utils.mjs'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    else if (arg === '--use-cache') pairs.push(['useCache', true])
    else if (arg.startsWith('--city=')) pairs.push(['city', arg.replace('--city=', '')])
    else if (arg.startsWith('--catchment-miles=')) pairs.push(['catchmentMiles', arg.replace('--catchment-miles=', '')])
    return pairs
  }, [])
)
const commit = !!args.commit
const useCache = !!args.useCache
const citySlug = args.city
const CACHE_PATH = path.join(__dirname, `.discover-cache-${citySlug}.json`)
if (!citySlug) {
  console.error('Usage: node scripts/discover-google-places-venues.mjs --city=<slug> [--commit]')
  process.exit(1)
}

// City search centres. A single wide-radius search badly under-samples a
// city as large as London — Google's Text Search "location"/"radius" is a
// bias, not a hard boundary, so results cluster near the centre point and
// each query caps at 60 results regardless of how many actually exist.
// London gets one centre per sub-area (matching lib/londonAreas.ts's compass
// regions, plus the outer-London boroughs that region covers) with a tighter
// radius each, so outer boroughs actually get searched rather than losing
// out to central London on every query.
const CITY_CENTRES = {
  belfast: [
    { name: 'Belfast', lat: 54.5973, lng: -5.9301, radius: 8000 },
    { name: 'North Belfast & Newtownabbey', lat: 54.6500, lng: -5.9100, radius: 8000 },
    { name: 'East Belfast & Dundonald', lat: 54.5950, lng: -5.8500, radius: 8000 },
    { name: 'South Belfast & Lisburn Road', lat: 54.5450, lng: -5.9500, radius: 8000 },
  ],
  london: [
    { name: 'Central London', lat: 51.5155, lng: -0.0922, radius: 6000 },
    { name: 'North London', lat: 51.5837, lng: -0.1097, radius: 8000 },
    { name: 'North West London', lat: 51.5588, lng: -0.2118, radius: 8000 },
    { name: 'East London', lat: 51.5390, lng: -0.0247, radius: 8000 },
    { name: 'South East London', lat: 51.4624, lng: -0.0146, radius: 8000 },
    { name: 'South West London', lat: 51.4460, lng: -0.2020, radius: 8000 },
    { name: 'West London', lat: 51.4989, lng: -0.2214, radius: 8000 },
    { name: 'Enfield & Barnet', lat: 51.6521, lng: -0.1141, radius: 8000 },
    { name: 'Redbridge & Romford', lat: 51.5779, lng: 0.1450, radius: 8000 },
    { name: 'Croydon & Bromley', lat: 51.3762, lng: -0.0982, radius: 10000 },
    { name: 'Hillingdon & Uxbridge', lat: 51.5322, lng: -0.4790, radius: 8000 },
  ],
  nottingham: [
    { name: 'Nottingham', lat: 52.9548, lng: -1.1581, radius: 14000 },
  ],
  brighton: [
    { name: 'Brighton', lat: 50.8225, lng: -0.1372, radius: 7000 },
  ],
  worthing: [
    { name: 'Worthing', lat: 50.8180, lng: -0.3714, radius: 8000 },
  ],
}

// Catchment guard. Text Search treats location/radius as a *bias*, so a search for
// "soft play Brighton" returns Lewes, Eastbourne, Worthing and Bognor places too. The
// old script stamped every one of them city_slug = <searched city> (the "city-stamping"
// bug that put Peacehaven and Lewes venues under /brighton/). A place whose own
// coordinates are further than this from every search centre of the requested city is
// NOT inserted; it is listed so you can re-run with the right --city (or add a hub).
const CATCHMENT_MILES = Number(args.catchmentMiles ?? 12)
function milesBetween(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(a))
}
function withinCatchment(place) {
  const loc = place.geometry?.location
  if (!loc) return false // no coordinates: cannot show it belongs here, leave it for review
  return centres.some((c) => milesBetween(c.lat, c.lng, loc.lat, loc.lng) <= CATCHMENT_MILES)
}

const centres = CITY_CENTRES[citySlug]
if (!centres) {
  console.error(`No search centres configured for city "${citySlug}" — add some to CITY_CENTRES.`)
  process.exit(1)
}
const cityDisplayName = citySlug.charAt(0).toUpperCase() + citySlug.slice(1)

const QUERY_TEMPLATES = [
  (name) => `soft play ${name}`,
  (name) => `indoor play centre ${name}`,
  (name) => `children's play centre ${name}`,
]

async function textSearch(query, center) {
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
      console.error(`  [warn] "${query}" (${center.name}) page ${page + 1}: ${data.status} ${data.error_message || ''}`)
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

  // Free council/park playgrounds vastly outnumber genuine indoor soft play
  // businesses in Places results for anything containing "play", and share
  // enough vocabulary ("children's play area", "kids playground") that a
  // loose keyword match pulls in dozens of them. `types: ['park', ...]` is
  // Google's own signal that this is an outdoor public space, not a
  // business — trust it over the name, with one narrow exception for a
  // genuine business that's simply mistyped as a park.
  const isParkType = types.includes('park')
  const explicitlySoftPlay = name.includes('soft play')
  if (isParkType && !explicitlySoftPlay) return false

  // Generic outdoor-playground naming patterns ("X Park Children's
  // Playground", "X Children's Play Area") — excluded regardless of type,
  // since these show up untyped as often as typed 'park' in practice.
  const playgroundPatterns = [
    /\bplayground\b/, /\bplay\s*ground\b/, /\bplay\s*area\b/,
    /\bplaying\s*area\b/, /\bplay\s*enclosure\b/,
  ]
  if (!explicitlySoftPlay && playgroundPatterns.some((re) => re.test(name))) return false

  // Equipment-hire/party-hire businesses aren't a venue families visit —
  // no fixed location, opening hours, or "get directions" makes sense for
  // them, which is most of what a listing page shows.
  if (/\bhire\b/.test(name) || /\bbouncy castles?\b/.test(name)) return false

  // Genuine indoor soft play / play centre business naming.
  const keywords = ['soft play', 'play centre', 'play center', 'indoor play', 'play cafe', 'play café']
  return keywords.some((k) => name.includes(k))
}

async function main() {
  console.log(`Discovering new venues for ${cityDisplayName} (${citySlug}) across ${centres.length} sub-areas${commit ? ' — COMMITTING' : ' — DRY RUN'}\n`)

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
  if (useCache && fs.existsSync(CACHE_PATH)) {
    console.log(`Using cached search results from ${CACHE_PATH} (skip with a fresh run if data may be stale)\n`)
    for (const place of JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))) {
      seen.set(place.place_id, place)
    }
  } else {
    for (const center of centres) {
      console.log(`--- ${center.name} ---`)
      for (const template of QUERY_TEMPLATES) {
        const q = template(center.name)
        const results = await textSearch(q, center)
        console.log(`  "${q}" -> ${results.length} results`)
        for (const place of results) {
          if (!place.place_id || seen.has(place.place_id)) continue
          seen.set(place.place_id, place)
        }
      }
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify([...seen.values()]))
  }

  const addressMatches = []
  const outsideCatchment = []
  const candidates = [...seen.values()].filter((p) => {
    if (knownPlaceIds.has(p.place_id)) return false
    if (knownNames.has(normalizeName(p.name))) return false
    if (!looksLikeSoftPlay(p)) return false
    if (p.business_status === 'CLOSED_PERMANENTLY') return false
    if (!withinCatchment(p)) {
      outsideCatchment.push(p)
      return false
    }
    if (knownAddresses.has(normalizeAddress(p.formatted_address))) {
      addressMatches.push(p)
      return false
    }
    return true
  })

  console.log(`\n${seen.size} unique places found across all queries.`)
  console.log(`${candidates.length} are new, look like genuine soft play venues, and aren't permanently closed.`)
  if (outsideCatchment.length > 0) {
    console.log(`${outsideCatchment.length} excluded — further than ${CATCHMENT_MILES} miles from ${cityDisplayName}'s search centre(s), so they belong to another town (not filed under ${citySlug}):`)
    for (const p of outsideCatchment) console.log(`  ~ ${p.name} — ${p.formatted_address}`)
  }
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
