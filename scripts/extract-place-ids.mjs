#!/usr/bin/env node
/**
 * Extract Google Place IDs from google_maps_url column and store in google_place_id
 * Also extracts lat/lng from the embedded coordinates in the Maps URL
 *
 * Place IDs are the !19sChIJ... part of the Maps URL
 * Coordinates are the !8m2!3d{lat}!4d{lng} part
 */

import pg from 'pg'
const { Pool } = pg

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('DATABASE_URL is not set. Export it or run via a tool that loads .env.local.')
  process.exit(1)
}

function extractFromMapsUrl(mapsUrl) {
  if (!mapsUrl) return {}

  const result = {}

  // Extract ChIJ place ID from !19s parameter
  const placeIdMatch = mapsUrl.match(/!19s(Ch[A-Za-z0-9_%-]+)/)
  if (placeIdMatch) {
    // URL-decode and clean the place ID
    try {
      result.place_id = decodeURIComponent(placeIdMatch[1]).replace(/[^A-Za-z0-9_-]/g, '')
    } catch {
      result.place_id = placeIdMatch[1].replace(/[^A-Za-z0-9_-]/g, '')
    }
  }

  // Extract lat/lng from !8m2!3d{lat}!4d{lng}
  const coordMatch = mapsUrl.match(/!8m2!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (coordMatch) {
    result.lat = parseFloat(coordMatch[1])
    result.lng = parseFloat(coordMatch[2])
  }

  return result
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  const { rows: venues } = await client.query(`
    SELECT id, name, city_slug, google_maps_url, google_place_id, lat, lng
    FROM venues
    WHERE google_maps_url IS NOT NULL
      AND google_maps_url != ''
  `)

  console.log(`Processing ${venues.length} venues with Maps URLs`)

  let updated = 0
  let placeIdCount = 0
  let coordCount = 0

  for (const venue of venues) {
    const extracted = extractFromMapsUrl(venue.google_maps_url)
    const updates = {}

    if (extracted.place_id && !venue.google_place_id) {
      updates.google_place_id = extracted.place_id
      placeIdCount++
    }

    if (extracted.lat && extracted.lng && !venue.lat) {
      updates.lat = extracted.lat
      updates.lng = extracted.lng
      coordCount++
    }

    if (Object.keys(updates).length > 0) {
      const sets = Object.entries(updates).map(([k, v], i) => `${k} = $${i + 1}`)
      const vals = [...Object.values(updates), venue.id]
      await client.query(
        `UPDATE venues SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`,
        vals
      )
      updated++
    }
  }

  client.release()
  await pool.end()

  console.log(`Updated ${updated} venues`)
  console.log(`  - Place IDs extracted: ${placeIdCount}`)
  console.log(`  - Coordinates extracted: ${coordCount}`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
