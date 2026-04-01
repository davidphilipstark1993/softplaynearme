#!/usr/bin/env node

/**
 * Multi-city Google Places scraper
 *
 * Queries Google Places API for soft play venues in target cities,
 * converts results to StaticVenue format, and merges directly into
 * the static JSON files used by the site.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=your_key node scripts/scrape-cities.mjs
 *
 * Options:
 *   --cities=manchester,bristol   Only scrape specific cities (comma-separated slugs)
 *   --dry-run                     Print results without writing to disk
 *
 * After running, commit data/generated/ and deploy.
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
  {
    slug: 'manchester',
    name: 'Manchester',
    lat: 53.4808,
    lng: -2.2426,
    radius: 18000,
  },
  {
    slug: 'birmingham',
    name: 'Birmingham',
    lat: 52.4862,
    lng: -1.8904,
    radius: 18000,
  },
  {
    slug: 'liverpool',
    name: 'Liverpool',
    lat: 53.4084,
    lng: -2.9916,
    radius: 16000,
  },
  {
    slug: 'bristol',
    name: 'Bristol',
    lat: 51.4545,
    lng: -2.5879,
    radius: 16000,
  },
]

const QUERIES = [
  'soft play centre',
  'indoor play centre',
  'kids soft play',
  'toddler play centre',
  'children indoor playground',
]

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.regularOpeningHours',
  'places.googleMapsUri',
  'places.types',
  'places.primaryType',
  'places.businessStatus',
].join(',')

// ── Google Places API ─────────────────────────────────────────────────────────

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

if (!API_KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY environment variable is required')
  console.error('Usage: GOOGLE_PLACES_API_KEY=your_key node scripts/scrape-cities.mjs')
  process.exit(1)
}

async function searchPlaces(query, city) {
  const url = 'https://places.googleapis.com/v1/places:searchText'

  const body = {
    textQuery: `${query} ${city.name}`,
    locationBias: {
      circle: {
        center: { latitude: city.lat, longitude: city.lng },
        radius: city.radius,
      },
    },
    regionCode: 'GB',
    languageCode: 'en',
    maxResultCount: 20,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Places API ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.places || []
}

// ── Data conversion ───────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extractPostcode(address) {
  if (!address) return ''
  const match = address.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}/i)
  return match ? match[0].toUpperCase() : ''
}

// Infer soft play relevance from Google Place types
const RELEVANT_TYPES = new Set([
  'amusement_center', 'amusement_park', 'childrens_camp', 'playground',
  'indoor_playground', 'sports_complex', 'sports_activity_location',
  'recreation_center', 'entertainment_and_recreation', 'tourist_attraction',
])

function isRelevant(place) {
  const types = place.types || []
  if (types.some(t => RELEVANT_TYPES.has(t))) return true
  // Name-based check for borderline types
  const name = (place.displayName?.text || '').toLowerCase()
  return (
    name.includes('soft play') ||
    name.includes('indoor play') ||
    name.includes('play centre') ||
    name.includes('play center') ||
    name.includes('play zone') ||
    name.includes('play world') ||
    name.includes('play land') ||
    name.includes('kids kingdom') ||
    name.includes('monkey') ||
    name.includes('jungle') ||
    name.includes('funky') ||
    name.includes('toddler')
  )
}

let globalIdCounter = 90000 // Start above existing DB IDs to avoid collisions

function placeToVenue(place, city, existingSlugs) {
  const name = place.displayName?.text || ''
  const baseSlug = slugify(name) + '-' + city.slug
  let slug = baseSlug
  let n = 1
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${n++}`
  }
  existingSlugs.add(slug)

  const address = place.formattedAddress || ''
  const openingHours = place.regularOpeningHours || {}
  const weekdayDescriptions = openingHours.weekdayDescriptions || []

  const rating = place.rating ? Number(place.rating) : null
  const reviewCount = place.userRatingCount || null

  // Guess facilities from name/type — enrichment scripts can refine later
  const nameLower = name.toLowerCase()
  const hasParties = nameLower.includes('party') || nameLower.includes('parties')
  const isSen = nameLower.includes('sen') || nameLower.includes('sensory') || nameLower.includes('quiet')

  return {
    id: globalIdCounter++,
    town: city.name,
    townSlug: city.slug,
    name,
    slug,
    address,
    postcode: extractPostcode(address),
    lat: place.location?.latitude || null,
    lng: place.location?.longitude || null,
    phone: place.nationalPhoneNumber || '',
    website: place.websiteUri || '',
    mapsUrl: place.googleMapsUri || '',
    googlePlaceId: place.id || '',
    category: 'Indoor playground',
    description: '',
    openingHoursText: weekdayDescriptions.join(' | '),
    rating,
    reviewCount,
    cafe: false,
    parking: false,
    parties: hasParties,
    toddlerArea: false,
    babyArea: false,
    senFriendly: isSen,
    wheelchairAccess: false,
    freeWifi: false,
    hasOutdoorPlay: false,
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
    notes: 'Imported via Google Places API. Facilities pending enrichment.',
  }
}

// ── Static JSON merge ─────────────────────────────────────────────────────────

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJSON(filePath, data) {
  if (dryRun) {
    console.log(`  [dry-run] Would write ${filePath}`)
    return
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const targetCities = cityFilter
    ? CITIES.filter(c => cityFilter.includes(c.slug))
    : CITIES

  if (targetCities.length === 0) {
    console.error(`No matching cities for filter: ${cityFilter}`)
    process.exit(1)
  }

  console.log(`\nScraping ${targetCities.length} cities: ${targetCities.map(c => c.name).join(', ')}`)
  if (dryRun) console.log('[DRY RUN — no files will be written]\n')

  // Load existing static data
  const venuesByTownPath = path.join(OUTPUT_DIR, 'venuesByTown.json')
  const venuesPath = path.join(OUTPUT_DIR, 'venues.json')
  const townsPath = path.join(OUTPUT_DIR, 'towns.json')

  const existingByTown = loadJSON(venuesByTownPath) || {}
  const existingVenues = loadJSON(venuesPath) || []
  const existingTowns = loadJSON(townsPath) || []

  // Track all existing place IDs and slugs across the whole dataset
  const existingPlaceIds = new Set(existingVenues.map(v => v.googlePlaceId).filter(Boolean))
  const existingSlugsByCity = {}

  for (const [citySlug, data] of Object.entries(existingByTown)) {
    existingSlugsByCity[citySlug] = new Set((data.venues || []).map(v => v.slug))
  }

  const newVenuesByCity = {}
  const totalStats = []

  for (const city of targetCities) {
    console.log(`\n${'─'.repeat(50)}`)
    console.log(`${city.name.toUpperCase()} (${city.slug})`)
    console.log(`${'─'.repeat(50)}`)

    if (!existingSlugsByCity[city.slug]) {
      existingSlugsByCity[city.slug] = new Set(
        ((existingByTown[city.slug] || {}).venues || []).map(v => v.slug)
      )
    }

    const cityPlaceIds = new Set(
      ((existingByTown[city.slug] || {}).venues || []).map(v => v.googlePlaceId).filter(Boolean)
    )

    const placesMap = new Map()

    for (const query of QUERIES) {
      process.stdout.write(`  Searching "${query}"... `)
      try {
        const results = await searchPlaces(query, city)
        let newCount = 0
        for (const place of results) {
          if (place.id && !placesMap.has(place.id)) {
            placesMap.set(place.id, place)
            newCount++
          }
        }
        console.log(`${results.length} results, ${newCount} new unique`)
        await new Promise(r => setTimeout(r, 300))
      } catch (err) {
        console.log(`ERROR: ${err.message}`)
      }
    }

    // Filter to relevant places not already in dataset
    const newPlaces = Array.from(placesMap.values()).filter(p =>
      isRelevant(p) &&
      p.businessStatus !== 'CLOSED_PERMANENTLY' &&
      !existingPlaceIds.has(p.id) &&
      !cityPlaceIds.has(p.id)
    )

    console.log(`\n  Total unique found: ${placesMap.size}`)
    console.log(`  Relevant & new: ${newPlaces.length}`)

    if (newPlaces.length === 0) {
      console.log('  Nothing new to add.')
      totalStats.push({ city: city.name, added: 0 })
      continue
    }

    // Convert to venues
    const venues = newPlaces.map(p => placeToVenue(p, city, existingSlugsByCity[city.slug]))

    // Show what we found
    console.log('\n  Venues to add:')
    venues.forEach(v => console.log(`    + ${v.name} (${v.postcode || 'no postcode'})`))

    newVenuesByCity[city.slug] = {
      city,
      venues,
    }

    totalStats.push({ city: city.name, added: venues.length })

    // Track new place IDs to avoid adding them again for other cities
    for (const v of venues) {
      if (v.googlePlaceId) existingPlaceIds.add(v.googlePlaceId)
    }
  }

  // ── Merge and write ─────────────────────────────────────────────────────────

  if (Object.keys(newVenuesByCity).length === 0) {
    console.log('\nNo new venues found. Static JSON unchanged.')
    return
  }

  console.log('\n\nMerging into static JSON files...')

  // Merge venuesByTown
  const updatedByTown = { ...existingByTown }
  for (const [citySlug, { city, venues }] of Object.entries(newVenuesByCity)) {
    const existing = updatedByTown[citySlug] || { town: city.name, townSlug: citySlug, venues: [] }
    const combined = [...existing.venues, ...venues].sort((a, b) => a.name.localeCompare(b.name))
    updatedByTown[citySlug] = { town: city.name, townSlug: citySlug, venues: combined }
  }

  // Merge flat venues list
  const allNewVenues = Object.values(newVenuesByCity).flatMap(({ venues }) => venues)
  const updatedVenues = [...existingVenues, ...allNewVenues].sort((a, b) =>
    a.townSlug.localeCompare(b.townSlug) || a.name.localeCompare(b.name)
  )

  // Rebuild towns list
  const townMap = new Map(existingTowns.map(t => [t.slug, t]))
  for (const [citySlug, { city, venues }] of Object.entries(newVenuesByCity)) {
    const existing = townMap.get(citySlug) || { name: city.name, slug: citySlug, venueCount: 0 }
    townMap.set(citySlug, {
      ...existing,
      venueCount: (updatedByTown[citySlug]?.venues || []).length,
    })
  }
  const updatedTowns = Array.from(townMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  // Write files
  writeJSON(venuesByTownPath, updatedByTown)
  writeJSON(venuesPath, updatedVenues)
  writeJSON(townsPath, updatedTowns)

  if (!dryRun) {
    console.log(`Updated venues.json (${updatedVenues.length} total venues)`)
    console.log(`Updated towns.json (${updatedTowns.length} total towns)`)
    console.log('Updated venuesByTown.json')
  }

  // ── Final summary ───────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(50))
  console.log('SUMMARY')
  console.log('═'.repeat(50))
  for (const { city, added } of totalStats) {
    console.log(`  ${city}: ${added} new venues added`)
  }
  const totalAdded = totalStats.reduce((s, t) => s + t.added, 0)
  console.log(`\n  Total: ${totalAdded} new venues`)

  if (!dryRun && totalAdded > 0) {
    console.log('\nNext steps:')
    console.log('  1. Review data/generated/ for quality')
    console.log('  2. git add data/generated/ && git commit -m "Add venues for new cities"')
    console.log('  3. git push  →  Vercel deploys automatically')
    console.log('\nNote: Facilities (cafe, parking, etc.) default to false.')
    console.log('Run the enrichment scripts to fill these in from venue websites.')
  }
}

main().catch(err => {
  console.error('\nFatal error:', err.message)
  process.exit(1)
})
