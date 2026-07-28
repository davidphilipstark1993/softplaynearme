#!/usr/bin/env node
/**
 * Fetch Google ratings for all venues using their Place IDs
 *
 * Requires: GOOGLE_PLACES_API_KEY environment variable
 * Get a free key at: https://console.cloud.google.com/
 * Enable: Places API (New) or Places API
 * Free tier: $200/month credit = ~11,000 Place Details calls free per month
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=AIza... node scripts/fetch-google-ratings.mjs
 *   GOOGLE_PLACES_API_KEY=AIza... node scripts/fetch-google-ratings.mjs --city hull
 *   GOOGLE_PLACES_API_KEY=AIza... node scripts/fetch-google-ratings.mjs --limit 100
 *   GOOGLE_PLACES_API_KEY=AIza... node scripts/fetch-google-ratings.mjs --dry-run
 */

import pg from 'pg'
const { Pool } = pg

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('DATABASE_URL is not set. Export it or run via a tool that loads .env.local.')
  process.exit(1)
}
const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY

if (!API_KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY environment variable is required')
  console.error('\nTo get a free API key:')
  console.error('1. Go to https://console.cloud.google.com/')
  console.error('2. Create a project and enable "Places API"')
  console.error('3. Create an API key under APIs & Services > Credentials')
  console.error('4. You get $200/month free credit (~11,000 requests/month)')
  console.error('\nRun with:')
  console.error('  GOOGLE_PLACES_API_KEY=AIza... node scripts/fetch-google-ratings.mjs')
  process.exit(1)
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, arr) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), arr[i + 1] || 'true'])
    return pairs
  }, [])
)

const CITY_FILTER = args.city || null
const LIMIT = args.limit ? Number(args.limit) : 9999
const DRY_RUN = args['dry-run'] === 'true'
const CONCURRENCY = 5
const DELAY_MS = 200 // 5 req/sec to stay well within rate limits

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchPlaceDetails(placeId) {
  const fields = 'rating,user_ratings_total,business_status,opening_hours,website,formatted_phone_number,formatted_address'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}&key=${API_KEY}&language=en`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'SoftPlayNearMe/1.0 (+https://softplaynearme.co.uk)' }
  })
  const json = await res.json()

  if (json.status === 'OK' && json.result) {
    return json.result
  }

  if (json.status === 'NOT_FOUND') return null
  if (json.status === 'INVALID_REQUEST') return null

  throw new Error(`Google Places API error: ${json.status} - ${json.error_message || ''}`)
}

async function main() {
  console.log('='.repeat(72))
  console.log('SOFT PLAY NEAR ME — GOOGLE RATINGS FETCHER')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`)
  console.log(`City: ${CITY_FILTER || 'all'}`)
  console.log(`Limit: ${LIMIT}`)
  console.log('='.repeat(72))

  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  const conditions = ['google_place_id IS NOT NULL', 'google_place_id != \'\'']
  if (CITY_FILTER) conditions.push(`city_slug = '${CITY_FILTER}'`)

  const { rows: venues } = await client.query(`
    SELECT id, name, city_slug, google_place_id, rating, reviews_count, website, phone, opening_hours_text
    FROM venues
    WHERE ${conditions.join(' AND ')}
    ORDER BY city_slug, name
    LIMIT ${LIMIT}
  `)

  console.log(`\nProcessing ${venues.length} venues with place IDs\n`)

  const stats = { processed: 0, updated: 0, skipped: 0, not_found: 0, errors: 0 }

  for (let i = 0; i < venues.length; i += CONCURRENCY) {
    const batch = venues.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async (venue) => {
      try {
        const details = await fetchPlaceDetails(venue.google_place_id)
        stats.processed++

        if (!details) {
          stats.not_found++
          process.stdout.write('?')
          return
        }

        if (details.business_status === 'CLOSED_PERMANENTLY') {
          if (!DRY_RUN) {
            await client.query('UPDATE venues SET status = $1 WHERE id = $2', ['closed_permanently', venue.id])
          }
          process.stdout.write('X')
          stats.updated++
          return
        }

        const patch = {}

        if (details.rating && details.rating !== venue.rating) {
          patch.rating = details.rating
        }
        if (details.user_ratings_total && details.user_ratings_total !== venue.reviews_count) {
          patch.reviews_count = details.user_ratings_total
        }
        if (details.website && !venue.website) {
          patch.website = details.website
        }
        if (details.formatted_phone_number && !venue.phone) {
          patch.phone = details.formatted_phone_number
        }
        if (details.opening_hours?.weekday_text && !venue.opening_hours_text) {
          patch.opening_hours_text = details.opening_hours.weekday_text.join('; ')
          patch.opening_hours = { weekday_text: details.opening_hours.weekday_text, source: 'google_places' }
        }

        if (Object.keys(patch).length > 0) {
          if (!DRY_RUN) {
            const sets = Object.entries(patch).map(([k, v], idx) => {
              if (k === 'opening_hours') return `${k} = $${idx + 1}::jsonb`
              return `${k} = $${idx + 1}`
            })
            const vals = Object.entries(patch).map(([k, v]) => {
              if (k === 'opening_hours') return JSON.stringify(v)
              return v
            })
            vals.push(venue.id)
            await client.query(`UPDATE venues SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals)
          }
          stats.updated++
          process.stdout.write(details.rating ? `${details.rating.toFixed(1).replace('.', '')}` : '✓')
        } else {
          stats.skipped++
          process.stdout.write('=')
        }

      } catch (e) {
        stats.errors++
        // Check for rate limit
        if (e.message.includes('OVER_QUERY_LIMIT')) {
          console.error('\nRate limit hit! Waiting 60 seconds...')
          await sleep(60000)
        }
        process.stdout.write('E')
      }
    }))

    await sleep(DELAY_MS)

    if ((i + CONCURRENCY) % 50 === 0 || i + CONCURRENCY >= venues.length) {
      console.log(`\n  ${stats.processed}/${venues.length} processed | updated:${stats.updated} skipped:${stats.skipped} not_found:${stats.not_found} errors:${stats.errors}`)
    }
  }

  client.release()
  await pool.end()

  console.log('\n' + '='.repeat(72))
  console.log(`DONE: ${stats.processed} processed | ${stats.updated} updated | ${stats.skipped} already up to date | ${stats.not_found} not found | ${stats.errors} errors`)
  console.log('='.repeat(72))
  console.log('\nNext steps:')
  console.log('  1. node scripts/rebuild-static-json.mjs  (update static JSON files from DB)')
  console.log('  2. Deploy the site to see ratings on all venue cards')
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
