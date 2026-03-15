#!/usr/bin/env node
/**
 * Comprehensive website enrichment script
 *
 * For each venue with a website:
 * 1. Fetches the website HTML
 * 2. Extracts: facilities, description, opening hours, prices, age ranges
 * 3. Looks for Google rating displayed on the venue's own site
 * 4. Updates the database
 *
 * Usage:
 *   node scripts/enrich-all-websites.mjs
 *   node scripts/enrich-all-websites.mjs --city hull
 *   node scripts/enrich-all-websites.mjs --limit 50
 *   node scripts/enrich-all-websites.mjs --id 123
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// --- Config ---
const DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Xci4hHOpqG1f@ep-noisy-silence-abqebbn6.eu-west-2.aws.neon.tech/neondb?sslmode=require'
const CONCURRENCY = 3
const TIMEOUT_MS = 12000
const DELAY_MS = 600

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, arr) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), arr[i + 1] || 'true'])
    return pairs
  }, [])
)
const CITY_FILTER = args.city || null
const LIMIT = args.limit ? Number(args.limit) : 9999
const VENUE_ID = args.id ? Number(args.id) : null
const DRY_RUN = args['dry-run'] === 'true'

// --- Keyword lists ---
const KEYWORDS = {
  cafe: ['cafe', 'café', 'coffee', 'food', 'restaurant', 'snacks', 'refreshments', 'kitchen', 'menu', 'hot food', 'meals', 'sandwiches', 'lunch', 'breakfast', 'eat in', 'dining'],
  parking: ['parking', 'car park', 'free parking', 'on-site parking', 'car park', 'parking available', 'ample parking', 'free car park'],
  parties: ['party', 'parties', 'birthday', 'celebration', 'party package', 'party room', 'private hire', 'exclusive hire', 'book a party', 'party booking', 'host a party', 'party hall'],
  toddler_area: ['toddler', 'under 3', 'under 4', 'under-3', 'under-4', 'tots area', 'toddler zone', 'toddler area', 'little ones area', 'under fours', 'baby and toddler'],
  baby_area: ['baby area', 'baby play', 'under 1', 'under 2', 'crawlers', 'babies area', 'baby zone', 'infant area'],
  sen_friendly: ['sen', 'special educational needs', 'additional needs', 'sensory session', 'autism', 'autistic', 'adhd', 'sen session', 'quiet session', 'inclusive session', 'sen friendly', 'send', 'sensory friendly'],
  wheelchair_access: ['wheelchair', 'disabled access', 'disability access', 'accessible', 'step-free', 'mobility access', 'disabled facilities', 'wheelchair friendly'],
  free_wifi: ['free wifi', 'free wi-fi', 'wifi available', 'wi-fi', 'wireless internet', 'complimentary wifi'],
  has_outdoor_play: ['outdoor play', 'outdoor area', 'outside area', 'garden', 'outdoor soft play', 'adventure playground outside', 'outdoor playground'],
  has_party_rooms: ['party room', 'party rooms', 'private party room', 'party suite', 'party hall', 'exclusive party', 'party area'],
  has_sen_sessions: ['sen session', 'sensory session', 'quiet session', 'sen morning', 'sen hour', 'autism session', 'ndis session', 'sen friendly session', 'send session'],
  has_role_play: ['role play', 'roleplay', 'role-play', 'role play town', 'pretend play', 'imaginative play', 'role playing areas'],
  has_multi_level_play: ['multi-level', 'multi level', 'three level', 'two level', '3 level', '2 level', '3-level', 'multiple levels'],
}

// Patterns for description building
const PRICE_RE = /(?:£\s*\d+(?:\.\d{1,2})?(?:\s*(?:–|-|to)\s*£?\d+(?:\.\d{1,2})?)?)/g
const HOURS_RE = /(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Weekday|Weekend|Daily|Every day)[^.]{0,60}(?:\d{1,2}(?::\d{2})?(?:am|pm)|\d{1,2}(?::\d{2})?\s*[-–]\s*\d{1,2}(?::\d{2})?(?:am|pm)?)[^.]{0,40})/gi
const RATING_RE = /(\d(?:\.\d)?)(?:\s*(?:out of|\/)\s*5|\s*stars?|\s*star\s*rating|\s*on\s*google)/i
const GOOGLE_RATING_RE = /(\d\.\d)\s*(?:Google\s*rating|on\s*Google|Google\s*reviews?|Google\s*stars?)/i
const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g
const PHONE_RE = /(?:\+44\s?|0)(?:\d\s?){9,10}/g
const POSTCODE_RE = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/gi

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractFacilities(text) {
  const lower = text.toLowerCase()
  const result = {}
  for (const [key, words] of Object.entries(KEYWORDS)) {
    result[key] = words.some(w => lower.includes(w))
  }
  return result
}

function extractGoogleRating(text) {
  // Try direct Google rating mention
  const m1 = text.match(GOOGLE_RATING_RE)
  if (m1) return parseFloat(m1[1])
  // Try generic "4.5 out of 5" or "4.5 stars"
  const m2 = text.match(RATING_RE)
  if (m2) {
    const r = parseFloat(m2[1])
    if (r >= 1 && r <= 5) return r
  }
  return null
}

function extractPrices(text) {
  const prices = [...text.matchAll(PRICE_RE)].map(m => m[0])
  return prices.slice(0, 5).join(', ')
}

function extractPostcode(text) {
  const matches = [...text.matchAll(POSTCODE_RE)]
  return matches.length > 0 ? matches[0][0].toUpperCase() : null
}

function extractEmails(text) {
  return [...new Set(text.match(EMAIL_RE) || [])].filter(e => !e.includes('example.com'))
}

function extractPhones(text) {
  return [...new Set(text.match(PHONE_RE) || [])]
}

function buildDescription(name, city, facilities, pricingHint, website) {
  const parts = [`${name} is a soft play venue in ${city}.`]
  const feats = []
  if (facilities.cafe) feats.push('cafe')
  if (facilities.parking) feats.push('on-site parking')
  if (facilities.parties) feats.push('birthday parties')
  if (facilities.toddler_area) feats.push('toddler area')
  if (facilities.baby_area) feats.push('baby area')
  if (facilities.has_outdoor_play) feats.push('outdoor play')
  if (facilities.sen_friendly) feats.push('SEN-friendly sessions')
  if (facilities.has_role_play) feats.push('role-play areas')
  if (feats.length > 0) parts.push(`Features include ${feats.join(', ')}.`)
  if (pricingHint) parts.push(`Prices from ${pricingHint}.`)
  return parts.join(' ')
}

function extractOpeningHours(text) {
  const matches = [...text.matchAll(HOURS_RE)]
  if (matches.length === 0) return null
  return matches.slice(0, 7).map(m => m[0].trim()).join('; ')
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoftPlayNearMeBot/1.0; +https://softplaynearme.co.uk/)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)
    return res
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

async function enrichVenue(venue) {
  let url = venue.website
  if (!url || url === 'https://nan' || url.includes('example.com')) {
    return { skipped: true, reason: 'bad_url' }
  }
  if (!url.startsWith('http')) url = 'https://' + url

  let html, text
  try {
    const res = await fetchWithTimeout(url, TIMEOUT_MS)
    if (!res.ok) return { skipped: true, reason: `http_${res.status}` }
    html = await res.text()
    text = htmlToText(html)
  } catch (e) {
    return { skipped: true, reason: e.message?.slice(0, 60) }
  }

  const facilities = extractFacilities(text)
  const googleRating = extractGoogleRating(text)
  const pricingHint = extractPrices(text)
  const openingHoursText = extractOpeningHours(text) || null
  const postcode = extractPostcode(text) || venue.postcode || null
  const emails = extractEmails(text)
  const phones = extractPhones(text)

  // Build description if missing
  const description = venue.description && venue.description.length > 30
    ? venue.description
    : buildDescription(venue.name, venue.town || venue.city_slug, facilities, pricingHint, url)

  const patch = {
    // Facilities
    cafe: venue.cafe || facilities.cafe,
    parking: venue.parking || facilities.parking,
    parties: venue.parties || facilities.parties,
    toddler_area: venue.toddler_area || facilities.toddler_area,
    baby_area: venue.baby_area || facilities.baby_area,
    sen_friendly: venue.sen_friendly || facilities.sen_friendly,
    wheelchair_access: venue.wheelchair_access || facilities.wheelchair_access,
    free_wifi: venue.free_wifi || facilities.free_wifi,
    has_outdoor_play: venue.has_outdoor_play || facilities.has_outdoor_play,
    has_party_rooms: venue.has_party_rooms || facilities.has_party_rooms,
    has_sen_sessions: venue.has_sen_sessions || facilities.has_sen_sessions,
    has_role_play: Boolean(facilities.has_role_play),
    has_multi_level_play: Boolean(facilities.has_multi_level_play),
    description,
  }

  // Only update rating if we found one on their site and don't already have a better one
  if (googleRating && !venue.rating) {
    patch.rating = googleRating
  }

  if (openingHoursText && !venue.opening_hours_text) {
    patch.opening_hours_text = openingHoursText
  }

  if (pricingHint && !venue.pricing_hint) {
    patch.pricing_hint = pricingHint.slice(0, 200)
  }

  if (postcode && !venue.postcode) {
    patch.postcode = postcode
  }

  if (emails[0] && !venue.email) {
    patch.email = emails[0]
  }

  if (phones[0] && !venue.phone) {
    patch.phone = phones[0].replace(/\s+/g, ' ').trim()
  }

  patch.last_verified_at = new Date().toISOString()
  patch.updated_by = 'enrich-all-websites'

  return { patch, facilities, googleRating, pricingHint }
}

async function applyPatch(client, id, patch) {
  const entries = Object.entries(patch)
  if (entries.length === 0) return
  const sets = []
  const vals = []
  let i = 1
  for (const [k, v] of entries) {
    sets.push(`${k} = $${i++}`)
    vals.push(v)
  }
  vals.push(id)
  await client.query(`UPDATE venues SET ${sets.join(', ')} WHERE id = $${i}`, vals)
}

async function runWithConcurrency(items, n, fn) {
  const results = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('='.repeat(72))
  console.log('SOFT PLAY NEAR ME — WEBSITE ENRICHMENT')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`)
  console.log(`City filter: ${CITY_FILTER || 'all'}`)
  console.log(`Limit: ${LIMIT}`)
  console.log('='.repeat(72))

  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  const conditions = [
    `website IS NOT NULL`,
    `website != ''`,
    `website NOT LIKE '%example.com%'`,
    `website != 'https://nan'`,
    `website != 'nan'`,
    `status IS DISTINCT FROM 'closed_permanently'`,
  ]
  if (CITY_FILTER) conditions.push(`city_slug = '${CITY_FILTER}'`)
  if (VENUE_ID) conditions.push(`id = ${VENUE_ID}`)

  const { rows: venues } = await client.query(`
    SELECT id, name, city_slug, town, website, rating, reviews_count, postcode, phone, email,
           cafe, parking, parties, toddler_area, baby_area, sen_friendly, wheelchair_access,
           free_wifi, has_outdoor_play, has_party_rooms, has_sen_sessions, description,
           opening_hours_text, pricing_hint
    FROM venues
    WHERE ${conditions.join(' AND ')}
    ORDER BY city_slug, name
    LIMIT ${LIMIT}
  `)

  console.log(`Found ${venues.length} venues to process\n`)

  const stats = { processed: 0, updated: 0, skipped: 0, errors: 0 }
  const logLines = []

  const batchSize = CONCURRENCY
  for (let i = 0; i < venues.length; i += batchSize) {
    const batch = venues.slice(i, i + batchSize)
    await Promise.all(batch.map(async (venue) => {
      try {
        const result = await enrichVenue(venue)
        stats.processed++

        if (result.skipped) {
          stats.skipped++
          const line = `SKIP  ${venue.id.toString().padStart(4)} ${venue.name.slice(0, 40).padEnd(40)} ${result.reason}`
          logLines.push(line)
          process.stdout.write('.')
          return
        }

        const facStr = Object.entries(result.facilities)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(',')
        const line = `OK    ${venue.id.toString().padStart(4)} ${venue.name.slice(0, 40).padEnd(40)} rating:${result.googleRating || venue.rating || '-'} fac:[${facStr}]`
        logLines.push(line)

        if (!DRY_RUN) {
          await applyPatch(client, venue.id, result.patch)
          stats.updated++
        } else {
          stats.updated++
        }

        process.stdout.write(result.googleRating ? 'R' : '✓')
      } catch (e) {
        stats.errors++
        logLines.push(`ERR   ${venue.id.toString().padStart(4)} ${venue.name.slice(0, 40).padEnd(40)} ${e.message?.slice(0, 60)}`)
        process.stdout.write('E')
      }
    }))
    await sleep(DELAY_MS)

    // Progress every 30
    if ((i + batchSize) % 30 === 0 || i + batchSize >= venues.length) {
      console.log(`\n  ${stats.processed}/${venues.length} processed (${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors)`)
    }
  }

  client.release()
  await pool.end()

  // Write log
  const logPath = path.join(ROOT, 'logs', `enrich-websites-${Date.now()}.log`)
  fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true })
  fs.writeFileSync(logPath, logLines.join('\n'))

  console.log('\n' + '='.repeat(72))
  console.log(`DONE. Processed: ${stats.processed} | Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`)
  console.log(`Log: ${logPath}`)
  console.log('='.repeat(72))
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
