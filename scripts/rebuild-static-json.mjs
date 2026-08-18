#!/usr/bin/env node
/**
 * Rebuild static JSON files from the database
 *
 * Updates data/generated/venues.json, towns.json, venuesByTown.json
 * with the latest enriched data from the database including:
 * - Google ratings and review counts
 * - Facilities (cafe, parking, parties, etc.)
 * - Descriptions
 * - Opening hours
 * - Postcodes and coordinates
 *
 * Usage:
 *   node scripts/rebuild-static-json.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUTPUT_DIR = path.join(ROOT, 'data', 'generated')

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('DATABASE_URL is not set. Export it or run via a tool that loads .env.local.')
  process.exit(1)
}

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/&/g, 'and').replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

async function main() {
  console.log('Rebuilding static JSON from database...')

  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  // Fetch all non-closed venues
  const { rows: dbVenues } = await client.query(`
    SELECT
      id, name, slug, city_slug, town, address, postcode, lat, lng,
      phone, website, description, opening_hours_text,
      rating, reviews_count,
      cafe, parking, parties, toddler_area, baby_area, sen_friendly,
      wheelchair_access, free_wifi, has_outdoor_play, has_party_rooms,
      has_sen_sessions, has_role_play, has_multi_level_play,
      google_maps_url, google_place_id, category, notes,
      last_verified_at, price_from, price_to, pricing_hint,
      main_image_url, featured, venue_type
    FROM venues
    WHERE status IS DISTINCT FROM 'closed_permanently'
    ORDER BY city_slug, name
  `)

  client.release()
  await pool.end()

  console.log(`Found ${dbVenues.length} venues in database`)

  // Build a map of all existing static venues to preserve data not in DB
  let existingStatic = []
  try {
    const existingPath = path.join(OUTPUT_DIR, 'venues.json')
    if (fs.existsSync(existingPath)) {
      existingStatic = JSON.parse(fs.readFileSync(existingPath, 'utf8'))
    }
  } catch {}
  const existingByKey = new Map(existingStatic.map(v => [`${v.townSlug}/${v.slug}`, v]))

  // Transform DB venues to static format
  const allVenues = dbVenues.map(v => {
    const townSlug = v.city_slug || slugify(v.town || '')
    const existingKey = `${townSlug}/${v.slug}`
    const existing = existingByKey.get(existingKey) || {}

    return {
      id: v.id,
      town: v.town || titleCase(townSlug),
      townSlug,
      name: v.name,
      slug: v.slug,
      // Trust the DB's address directly — no fallback to the previous
      // static export. That fallback used to silently resurrect stale
      // corrupted values (literal "nan", leaked Google status text) after
      // scripts/migrations/phase2-06-clean-corrupted-addresses.mjs had
      // explicitly nulled them in the DB, defeating the cleanup on every
      // subsequent rebuild.
      address: v.address || '',
      postcode: v.postcode || existing.postcode || '',
      lat: v.lat || null,
      lng: v.lng || null,
      phone: v.phone || existing.phone || '',
      website: v.website || existing.website || '',
      mapsUrl: existing.mapsUrl || v.google_maps_url || '',
      googlePlaceId: v.google_place_id || '',
      category: v.category || existing.category || 'Indoor playground',
      description: v.description || '',
      openingHoursText: v.opening_hours_text || '',
      rating: v.rating ? Number(v.rating) : null,
      reviewCount: v.reviews_count || null,
      // Facilities
      cafe: Boolean(v.cafe),
      parking: Boolean(v.parking),
      parties: Boolean(v.parties),
      toddlerArea: Boolean(v.toddler_area),
      babyArea: Boolean(v.baby_area),
      senFriendly: Boolean(v.sen_friendly),
      wheelchairAccess: Boolean(v.wheelchair_access),
      freeWifi: Boolean(v.free_wifi),
      hasOutdoorPlay: Boolean(v.has_outdoor_play),
      hasPartyRooms: Boolean(v.has_party_rooms),
      hasSenSessions: Boolean(v.has_sen_sessions),
      hasRolePlay: Boolean(v.has_role_play),
      hasMultiLevelPlay: Boolean(v.has_multi_level_play),
      // Pricing
      priceFrom: v.price_from || null,
      priceTo: v.price_to || null,
      pricingHint: v.pricing_hint || '',
      // Images
      mainImageUrl: v.main_image_url || null,
      featured: Boolean(v.featured),
      // See lib/venueTypes.ts — null/'indoor' means genuine soft play.
      venueType: v.venue_type || 'indoor',
      lastVerified: v.last_verified_at
        ? new Date(v.last_verified_at).toISOString().split('T')[0]
        : (existing.lastVerified || ''),
      notes: v.notes || existing.notes || '',
    }
  })

  // Group by town
  const venuesByTown = {}
  const townNames = {}

  for (const venue of allVenues) {
    const { townSlug, town } = venue
    if (!venuesByTown[townSlug]) {
      venuesByTown[townSlug] = []
      townNames[townSlug] = town
    }
    venuesByTown[townSlug].push(venue)
  }

  // Sort each town's venues by name
  for (const slug of Object.keys(venuesByTown)) {
    venuesByTown[slug].sort((a, b) => a.name.localeCompare(b.name))
  }

  // Build towns list
  const towns = Object.entries(venuesByTown)
    .map(([slug, venues]) => ({
      name: townNames[slug] || titleCase(slug),
      slug,
      // Genuine soft play only — matches the live DB query's venue_type
      // filter (app/page.tsx, lib/venueStats.ts) so the count doesn't
      // flip-flop between what a fresh SOFTPLAY_STATIC_BUILD=1 deploy bakes
      // in and what ISR revalidation later computes from the live DB.
      venueCount: venues.filter(v => v.venueType === 'indoor' || v.venueType === 'pub').length,
      avgRating: venues.filter(v => v.rating).length > 0
        ? (venues.reduce((s, v) => s + (v.rating || 0), 0) / venues.filter(v => v.rating).length).toFixed(1)
        : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Write files
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const venuesPath = path.join(OUTPUT_DIR, 'venues.json')
  fs.writeFileSync(venuesPath, JSON.stringify(allVenues, null, 2))
  console.log(`Wrote ${allVenues.length} venues to venues.json`)

  const townsPath = path.join(OUTPUT_DIR, 'towns.json')
  fs.writeFileSync(townsPath, JSON.stringify(towns, null, 2))
  console.log(`Wrote ${towns.length} towns to towns.json`)

  const venuesByTownPath = path.join(OUTPUT_DIR, 'venuesByTown.json')
  fs.writeFileSync(venuesByTownPath, JSON.stringify(
    Object.fromEntries(Object.entries(venuesByTown).map(([slug, venues]) => [
      slug,
      { town: townNames[slug] || titleCase(slug), townSlug: slug, venues }
    ])),
    null, 2
  ))
  console.log('Wrote venuesByTown.json')

  // Stats
  const withRating = allVenues.filter(v => v.rating).length
  const withCafe = allVenues.filter(v => v.cafe).length
  const withParties = allVenues.filter(v => v.parties).length
  const withDesc = allVenues.filter(v => v.description).length

  console.log('\n--- Summary ---')
  console.log(`Total venues: ${allVenues.length}`)
  console.log(`With ratings: ${withRating} (${Math.round(withRating/allVenues.length*100)}%)`)
  console.log(`With descriptions: ${withDesc} (${Math.round(withDesc/allVenues.length*100)}%)`)
  console.log(`With cafe: ${withCafe}`)
  console.log(`With parties: ${withParties}`)
  console.log('\nDone! Static JSON files updated.')
}

function titleCase(str) {
  return str.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
