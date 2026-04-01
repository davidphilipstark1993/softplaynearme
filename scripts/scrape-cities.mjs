#!/usr/bin/env node

/**
 * Multi-city soft play venue scraper — Overpass API (OpenStreetMap)
 *
 * No API key required. Queries the free Overpass API for soft play and
 * indoor play venues in target cities, then merges into the static JSON files.
 *
 * Usage:
 *   node scripts/scrape-cities.mjs
 *   node scripts/scrape-cities.mjs --cities=manchester,bristol
 *   node scripts/scrape-cities.mjs --dry-run
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUTPUT_DIR = path.join(ROOT, 'data', 'generated')

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const citiesFlag = args.find(a => a.startsWith('--cities='))
const cityFilter = citiesFlag ? citiesFlag.replace('--cities=', '').split(',') : null

// ── Target cities ────────────────────────────────────────────────────────────

const CITIES = [
  { slug: 'manchester', name: 'Manchester', lat: 53.4808, lng: -2.2426, radius: 15000 },
  { slug: 'birmingham', name: 'Birmingham', lat: 52.4862, lng: -1.8904, radius: 15000 },
  { slug: 'liverpool',  name: 'Liverpool',  lat: 53.4084, lng: -2.9916, radius: 14000 },
  { slug: 'bristol',    name: 'Bristol',    lat: 51.4545, lng: -2.5879, radius: 14000 },
]

// ── Overpass API ─────────────────────────────────────────────────────────────

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

function buildQuery(city) {
  const { lat, lng, radius } = city
  // Cast a wide net across all tags that can indicate a soft play / indoor play venue
  return `
[out:json][timeout:60];
(
  node["leisure"="indoor_play"](around:${radius},${lat},${lng});
  node["leisure"="playground"]["indoor"="yes"](around:${radius},${lat},${lng});
  node["amenity"="indoor_play_area"](around:${radius},${lat},${lng});
  node["amenity"="playground"]["indoor"="yes"](around:${radius},${lat},${lng});
  node["name"~"[Ss]oft [Pp]lay"](around:${radius},${lat},${lng});
  node["name"~"[Ii]ndoor [Pp]lay"](around:${radius},${lat},${lng});
  node["name"~"[Pp]lay [Cc]entre"](around:${radius},${lat},${lng});
  node["name"~"[Pp]lay [Cc]enter"](around:${radius},${lat},${lng});
  node["name"~"[Pp]lay [Ww]orld"](around:${radius},${lat},${lng});
  node["name"~"[Pp]lay [Zz]one"](around:${radius},${lat},${lng});
  node["name"~"[Pp]lay [Ll]and"](around:${radius},${lat},${lng});
  node["name"~"[Kk]ids [Kk]ingdom"](around:${radius},${lat},${lng});
  node["name"~"[Ff]unky [Mm]onkeys"](around:${radius},${lat},${lng});
  node["name"~"[Mm]onkey [Bb]izness"](around:${radius},${lat},${lng});
  node["name"~"[Ww]acky [Ww]arehouse"](around:${radius},${lat},${lng});
  node["name"~"[Ii]nflata [Nn]ation"](around:${radius},${lat},${lng});
  node["name"~"[Gg]ambado"](around:${radius},${lat},${lng});
  node["name"~"[Gg]ravity [Aa]ctive"](around:${radius},${lat},${lng});
  node["name"~"[Jj]ump [Ii]nc"](around:${radius},${lat},${lng});
  node["name"~"[Jj]ump [Nn]ation"](around:${radius},${lat},${lng});
  node["name"~"[Kk]ids [Pp]lanet"](around:${radius},${lat},${lng});
  node["name"~"[Kk]idspace"](around:${radius},${lat},${lng});
  way["leisure"="indoor_play"](around:${radius},${lat},${lng});
  way["leisure"="playground"]["indoor"="yes"](around:${radius},${lat},${lng});
  way["amenity"="indoor_play_area"](around:${radius},${lat},${lng});
  way["name"~"[Ss]oft [Pp]lay"](around:${radius},${lat},${lng});
  way["name"~"[Ii]ndoor [Pp]lay"](around:${radius},${lat},${lng});
  way["name"~"[Pp]lay [Cc]entre"](around:${radius},${lat},${lng});
  way["name"~"[Ww]acky [Ww]arehouse"](around:${radius},${lat},${lng});
  way["name"~"[Ii]nflata [Nn]ation"](around:${radius},${lat},${lng});
  way["name"~"[Gg]ambado"](around:${radius},${lat},${lng});
);
out body center;
`
}

async function queryOverpass(query) {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  })

  if (!response.ok) {
    throw new Error(`Overpass API ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  return data.elements || []
}

// ── Nominatim reverse geocode for postcode ──────────────────────────────────

async function getPostcode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'softplaynearme.co.uk/1.0' } })
    if (!res.ok) return ''
    const data = await res.json()
    return data.address?.postcode || ''
  } catch {
    return ''
  }
}

// ── Data conversion ───────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toString().toLowerCase().trim()
    .replace(/&/g, 'and').replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

let idCounter = 90000

function elementToVenue(el, city, existingSlugs) {
  const tags = el.tags || {}
  const name = tags.name || tags['name:en'] || ''
  if (!name) return null

  const baseSlug = slugify(name) + '-' + city.slug
  let slug = baseSlug
  let n = 1
  while (existingSlugs.has(slug)) slug = `${baseSlug}-${n++}`
  existingSlugs.add(slug)

  // Coordinates: nodes have lat/lng directly; ways have center
  const lat = el.lat ?? el.center?.lat ?? null
  const lng = el.lon ?? el.center?.lon ?? null

  const address = [
    tags['addr:housenumber'] && tags['addr:street']
      ? `${tags['addr:housenumber']} ${tags['addr:street']}`
      : tags['addr:street'] || '',
    tags['addr:city'] || city.name,
  ].filter(Boolean).join(', ')

  const nameLower = name.toLowerCase()
  const hasParties = nameLower.includes('party') || nameLower.includes('parties') || tags.party_room === 'yes'
  const isSen = nameLower.includes('sen') || nameLower.includes('sensory')

  return {
    id: idCounter++,
    town: city.name,
    townSlug: city.slug,
    name,
    slug,
    address,
    postcode: tags['addr:postcode'] || '',
    lat: lat ? Number(lat) : null,
    lng: lng ? Number(lng) : null,
    phone: tags.phone || tags['contact:phone'] || '',
    website: tags.website || tags['contact:website'] || '',
    mapsUrl: lat && lng
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : '',
    googlePlaceId: '',
    osmId: `${el.type}/${el.id}`,
    category: 'Indoor playground',
    description: '',
    openingHoursText: tags.opening_hours || '',
    rating: null,
    reviewCount: null,
    cafe: tags.cafe === 'yes' || tags.amenity === 'cafe' || false,
    parking: tags.parking !== undefined || false,
    parties: hasParties,
    toddlerArea: false,
    babyArea: false,
    senFriendly: isSen,
    wheelchairAccess: tags.wheelchair === 'yes' || false,
    freeWifi: tags.internet_access === 'wlan' || false,
    hasOutdoorPlay: tags.outdoor_seating === 'yes' || false,
    hasPartyRooms: hasParties,
    hasSenSessions: isSen,
    hasRolePlay: false,
    hasMultiLevelPlay: false,
    priceFrom: null,
    priceTo: null,
    pricingHint: '',
    mainImageUrl: null,
    featured: false,
    lastVerified: new Date().toISOString().split('T')[0],
    notes: `Imported from OpenStreetMap (${el.type}/${el.id}). Facilities pending verification.`,
  }
}

// ── Static JSON helpers ───────────────────────────────────────────────────────

function loadJSON(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null
}

function writeJSON(p, data) {
  if (dryRun) { console.log(`  [dry-run] Would write ${path.basename(p)}`); return }
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const targets = cityFilter
    ? CITIES.filter(c => cityFilter.includes(c.slug))
    : CITIES

  if (!targets.length) {
    console.error(`No matching cities for: ${cityFilter}`)
    process.exit(1)
  }

  console.log(`\nScraping ${targets.length} cities via OpenStreetMap Overpass API`)
  console.log(`Cities: ${targets.map(c => c.name).join(', ')}`)
  if (dryRun) console.log('[DRY RUN]\n')

  // Load existing data
  const vbtPath  = path.join(OUTPUT_DIR, 'venuesByTown.json')
  const vPath    = path.join(OUTPUT_DIR, 'venues.json')
  const tPath    = path.join(OUTPUT_DIR, 'towns.json')

  const existingByTown = loadJSON(vbtPath) || {}
  const existingVenues = loadJSON(vPath)   || []
  const existingTowns  = loadJSON(tPath)   || []

  // Build set of existing OSM IDs + slugs to skip duplicates
  const existingOsmIds = new Set(existingVenues.map(v => v.osmId).filter(Boolean))
  const existingSlugsByCity = {}
  for (const [slug, data] of Object.entries(existingByTown)) {
    existingSlugsByCity[slug] = new Set((data.venues || []).map(v => v.slug))
  }

  const addedByCity = {}
  const statsByCity = []

  for (const city of targets) {
    console.log(`\n${'─'.repeat(50)}`)
    console.log(`${city.name.toUpperCase()}`)
    console.log(`${'─'.repeat(50)}`)

    if (!existingSlugsByCity[city.slug]) {
      existingSlugsByCity[city.slug] = new Set(
        ((existingByTown[city.slug] || {}).venues || []).map(v => v.slug)
      )
    }

    process.stdout.write('  Querying Overpass API... ')
    let elements
    try {
      elements = await queryOverpass(buildQuery(city))
      console.log(`${elements.length} elements returned`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      statsByCity.push({ city: city.name, added: 0, error: err.message })
      continue
    }

    // Deduplicate by OSM ID, skip already imported
    const seen = new Set()
    const newElements = elements.filter(el => {
      const key = `${el.type}/${el.id}`
      if (seen.has(key) || existingOsmIds.has(key)) return false
      if (!el.tags?.name) return false
      seen.add(key)
      return true
    })

    console.log(`  New elements to process: ${newElements.length}`)

    const venues = []
    for (const el of newElements) {
      const venue = elementToVenue(el, city, existingSlugsByCity[city.slug])
      if (!venue) continue

      // Fetch postcode via Nominatim if missing and we have coords
      if (!venue.postcode && venue.lat && venue.lng) {
        process.stdout.write(`  Geocoding ${venue.name}... `)
        venue.postcode = await getPostcode(venue.lat, venue.lng)
        console.log(venue.postcode || 'no postcode found')
        await new Promise(r => setTimeout(r, 1100)) // Nominatim rate limit: 1 req/sec
      }

      venues.push(venue)
      existingOsmIds.add(venue.osmId)
    }

    console.log(`\n  Venues added for ${city.name}: ${venues.length}`)
    venues.forEach(v => console.log(`    + ${v.name} ${v.postcode ? `(${v.postcode})` : ''}`))

    addedByCity[city.slug] = { city, venues }
    statsByCity.push({ city: city.name, added: venues.length })
  }

  // ── Merge and write ─────────────────────────────────────────────────────────

  const totalAdded = statsByCity.reduce((s, t) => s + t.added, 0)

  if (totalAdded === 0) {
    console.log('\nNo new venues found. Static JSON unchanged.')
    printSummary(statsByCity)
    return
  }

  console.log('\nMerging into static JSON files...')

  const updatedByTown = { ...existingByTown }
  for (const [citySlug, { city, venues }] of Object.entries(addedByCity)) {
    if (!venues.length) continue
    const existing = updatedByTown[citySlug] || { town: city.name, townSlug: citySlug, venues: [] }
    const combined = [...existing.venues, ...venues].sort((a, b) => a.name.localeCompare(b.name))
    updatedByTown[citySlug] = { town: city.name, townSlug: citySlug, venues: combined }
  }

  const allNewVenues = Object.values(addedByCity).flatMap(({ venues }) => venues)
  const updatedVenues = [...existingVenues, ...allNewVenues].sort(
    (a, b) => a.townSlug.localeCompare(b.townSlug) || a.name.localeCompare(b.name)
  )

  const townMap = new Map(existingTowns.map(t => [t.slug, t]))
  for (const [slug, { city }] of Object.entries(addedByCity)) {
    const ex = townMap.get(slug) || { name: city.name, slug, venueCount: 0 }
    townMap.set(slug, { ...ex, venueCount: (updatedByTown[slug]?.venues || []).length })
  }
  const updatedTowns = Array.from(townMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  writeJSON(vbtPath, updatedByTown)
  writeJSON(vPath, updatedVenues)
  writeJSON(tPath, updatedTowns)

  if (!dryRun) {
    console.log(`  venues.json      → ${updatedVenues.length} total venues`)
    console.log(`  towns.json       → ${updatedTowns.length} total towns`)
    console.log('  venuesByTown.json updated')
  }

  printSummary(statsByCity, totalAdded)
}

function printSummary(stats, total) {
  console.log('\n' + '═'.repeat(50))
  console.log('SUMMARY')
  console.log('═'.repeat(50))
  for (const { city, added, error } of stats) {
    console.log(`  ${city}: ${error ? `ERROR — ${error}` : `${added} venues added`}`)
  }
  if (total > 0) {
    console.log(`\n  Total new venues: ${total}`)
    if (!dryRun) {
      console.log('\nNext steps:')
      console.log('  git add data/generated/')
      console.log('  git commit -m "Add venue data for new cities"')
      console.log('  git push')
    }
  }
}

main().catch(err => {
  console.error('\nFatal:', err.message)
  process.exit(1)
})
