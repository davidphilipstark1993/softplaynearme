import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import {
  normalizeText,
  normalizePhoneUk,
  normalizeUkPostcode,
  normalizeUrl,
  validateUkPostcode,
  extractFacilitiesFromText,
  computePatch,
  diffObject,
  htmlToText,
  extractEmails,
  extractPhones,
  extractLikelyPostcode,
  extractOpeningHoursText,
  buildDescription,
  scoreConfidence,
} from './enrichment-utils.mjs'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

const DEFAULTS = {
  dryRun: true,
  limit: 50,
  concurrency: 2,
  confidenceThreshold: 0.7,
  websitesOnly: true,
  skipNeedsReview: true,
}

function parseArgs(argv) {
  const args = {
    dryRun: DEFAULTS.dryRun,
    commit: false,
    limit: DEFAULTS.limit,
    venueId: null,
    concurrency: DEFAULTS.concurrency,
    confidenceThreshold: DEFAULTS.confidenceThreshold,
    websitesOnly: DEFAULTS.websitesOnly,
    skipNeedsReview: DEFAULTS.skipNeedsReview,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--commit') {
      args.commit = true
      args.dryRun = false
    } else if (arg === '--limit') args.limit = Number(argv[++i] || DEFAULTS.limit)
    else if (arg === '--venue_id') args.venueId = Number(argv[++i])
    else if (arg === '--concurrency') args.concurrency = Math.min(5, Math.max(1, Number(argv[++i] || DEFAULTS.concurrency)))
    else if (arg === '--confidence-threshold') args.confidenceThreshold = Number(argv[++i] || DEFAULTS.confidenceThreshold)
    else if (arg === '--websites-only') args.websitesOnly = true
    else if (arg === '--all-candidates') args.websitesOnly = false
    else if (arg === '--include-needs-review') args.skipNeedsReview = false
  }

  return args
}

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function nowIso() {
  return new Date().toISOString()
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function appendLog(line) {
  const logsDir = path.join(projectRoot, 'logs')
  ensureDir(logsDir)
  fs.appendFileSync(path.join(logsDir, 'enrichment.log'), `${new Date().toISOString()} ${line}\n`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url, options = {}, retries = 2, backoffMs = 800) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (error) {
      if (attempt === retries) throw error
      await sleep(backoffMs * (attempt + 1))
    }
  }
}

function domainFromUrl(input) {
  try {
    return new URL(input).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function buildSourceUrlList(existing, additions) {
  const existingArray = Array.isArray(existing) ? existing : []
  return [...new Set([...existingArray, ...additions.filter(Boolean)])]
}

function parseAddressParts(formattedAddress) {
  const raw = normalizeText(formattedAddress)
  if (!raw) return { address: '', city: '', county: '', postcode: '', country: 'UK' }

  const parts = raw.split(',').map((p) => normalizeText(p)).filter(Boolean)
  const postcode = normalizeUkPostcode(raw) || normalizeUkPostcode(parts.at(-1) || '')
  const countryGuess = /united kingdom|england|scotland|wales|northern ireland|\buk\b/i.test(raw) ? 'UK' : 'UK'

  return {
    address: parts.slice(0, 2).join(', '),
    city: parts.length >= 3 ? parts[parts.length - 3] : '',
    county: parts.length >= 2 ? parts[parts.length - 2] : '',
    postcode,
    country: countryGuess,
  }
}

function deriveTags(category, facilities, websiteText) {
  const tags = new Set()
  const c = normalizeText(category).toLowerCase()
  const t = normalizeText(websiteText).toLowerCase()

  if (c.includes('soft play') || t.includes('soft play')) tags.add('indoor play centre')
  if (c.includes('trampoline') || t.includes('trampoline')) tags.add('trampoline')
  if (t.includes('role play') || facilities.includes('role_play')) tags.add('role play')
  if (t.includes('farm park') || c.includes('farm')) tags.add('farm park')
  if (t.includes('adventure') || c.includes('adventure')) tags.add('adventure play')

  return [...tags]
}

function toJsonSafe(value) {
  try {
    JSON.stringify(value)
    return value
  } catch {
    return null
  }
}

function summarizeDiff(diffRows) {
  if (diffRows.length === 0) return 'no changes'
  return diffRows.map((d) => `${d.field}: ${JSON.stringify(d.from)} -> ${JSON.stringify(d.to)}`).join('; ')
}

function findOfficialSocials(html, venueDomain) {
  const socials = { facebook: '', instagram: '', tiktok: '', youtube: '' }
  const links = [...String(html || '').matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1])

  for (const href of links) {
    const url = normalizeUrl(href)
    if (!url) continue
    const host = domainFromUrl(url)
    if (host.includes('facebook.com')) socials.facebook ||= url
    else if (host.includes('instagram.com')) socials.instagram ||= url
    else if (host.includes('tiktok.com')) socials.tiktok ||= url
    else if (host.includes('youtube.com') || host.includes('youtu.be')) socials.youtube ||= url
    else if (venueDomain && host === venueDomain) {
      // no-op but keeps matcher strict for official-domain links if needed later
    }
  }

  return socials
}

function parseTicketHint(text) {
  const lower = String(text || '').toLowerCase()
  const match = lower.match(/£\s?\d{1,2}(?:\.\d{1,2})?(?:\s?(?:to|-|–)\s?£?\d{1,2}(?:\.\d{1,2})?)?/)
  return match ? match[0].replace(/\s+/g, ' ').trim() : ''
}

function isLikelyOfficialDomain(hostname) {
  if (!hostname) return false
  const blocked = [
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'google.com',
    'mumbler.co.uk',
    'tripadvisor.',
    'yelp.',
    'allinlondon.co.uk',
  ]
  return !blocked.some((token) => hostname.includes(token))
}

function computeMatchingSignals(venue, extracted) {
  const phoneMatch = Boolean(venue.phone && extracted.phone && normalizePhoneUk(venue.phone) === normalizePhoneUk(extracted.phone))
  const postcodeMatch = Boolean(
    venue.postcode && extracted.postcode && normalizeUkPostcode(venue.postcode) === normalizeUkPostcode(extracted.postcode)
  )

  return {
    placeIdMatch: Boolean(venue.google_place_id && extracted.placeId === venue.google_place_id),
    mapsUrlPresent: Boolean(venue.google_maps_url),
    phoneMatch,
    postcodeMatch,
    websiteFetched: Boolean(extracted.websiteFetched),
    validAddressPostcode: Boolean(extracted.address && extracted.postcode && validateUkPostcode(extracted.postcode)),
    geocodeResolved: Boolean(extracted.geocoded),
    officialWebsiteDomain: Boolean(extracted.officialWebsiteDomain),
  }
}

async function ensureEnrichmentColumns(client) {
  const cols = [
    ['source_urls', `JSONB DEFAULT '[]'::jsonb`],
    ['confidence_score', 'NUMERIC(3,2)'],
    ['needs_review', 'BOOLEAN DEFAULT false'],
    ['enrichment_notes', 'TEXT'],
    ['updated_by', 'VARCHAR(64)'],
    ['opening_hours_text', 'TEXT'],
    ['country', 'VARCHAR(64)'],
    ['email', 'VARCHAR(255)'],
    ['socials', `JSONB DEFAULT '{}'::jsonb`],
    ['pricing_hint', 'TEXT'],
    ['source_meta', `JSONB DEFAULT '{}'::jsonb`],
    ['tags', 'TEXT[]'],
    ['party_info', 'TEXT'],
  ]

  for (const [name, type] of cols) {
    await client.query(`ALTER TABLE venues ADD COLUMN IF NOT EXISTS ${name} ${type}`)
  }

  await client.query('CREATE INDEX IF NOT EXISTS idx_venues_google_place_id ON venues(google_place_id)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_venues_postcode ON venues(postcode)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_venues_needs_review ON venues(needs_review)')
}

async function getCandidateVenues(client, args) {
  const where = []
  const params = []

  if (args.venueId) {
    params.push(args.venueId)
    where.push(`id = $${params.length}`)
  } else {
    where.push(`(
      coalesce(website, '') = '' OR
      coalesce(opening_hours_text, '') = '' OR
      coalesce(facilities_list_text, '') = '' OR
      lat IS NULL OR lng IS NULL OR
      coalesce(phone, '') = '' OR
      coalesce(description, '') = ''
    )`)
    if (args.websitesOnly) where.push(`coalesce(website, '') <> ''`)
    if (args.skipNeedsReview) where.push(`coalesce(needs_review, false) = false`)
  }

  const query = `
    SELECT *
    FROM venues
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY
      CASE WHEN coalesce(website, '') <> '' THEN 0 ELSE 1 END,
      CASE WHEN coalesce(google_place_id, '') <> '' THEN 0 ELSE 1 END,
      CASE WHEN coalesce(google_maps_url, '') <> '' THEN 0 ELSE 1 END,
      updated_at NULLS FIRST,
      id ASC
    LIMIT ${Math.max(1, args.limit)}
  `

  const { rows } = await client.query(query, params)
  return rows
}

async function fetchGoogleDetails(placeId) {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY
  if (!key || !placeId) return null

  const fields = [
    'place_id',
    'name',
    'formatted_address',
    'formatted_phone_number',
    'international_phone_number',
    'website',
    'opening_hours',
    'business_status',
    'geometry',
    'types',
  ].join(',')

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(key)}`
  const response = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'softplaynearme-enrichment-bot/1.0' },
  }, 1, 1000)
  const json = await response.json()
  if (json.status !== 'OK' || !json.result) return null
  return json.result
}

async function geocodeWithNominatim(address) {
  const q = normalizeText(address)
  if (!q) return null

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=gb&q=${encodeURIComponent(q)}`
  const res = await fetchWithRetry(url, {
    headers: {
      'User-Agent': 'softplaynearme-enrichment-bot/1.0 (info@softplaynearme.co.uk)',
      Accept: 'application/json',
    },
  }, 1, 1200)

  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null

  const first = data[0]
  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
    displayName: first.display_name,
    sourceUrl: 'https://nominatim.openstreetmap.org/',
  }
}

async function fetchWebsiteFacts(website, venueName, venueAddress) {
  const normalized = normalizeUrl(website)
  if (!normalized) return null

  const res = await fetchWithRetry(normalized, {
    headers: {
      'User-Agent': 'softplaynearme-enrichment-bot/1.0',
      Accept: 'text/html,application/xhtml+xml',
    },
  }, 1, 1200)

  const html = await res.text()
  const text = htmlToText(html)
  const emails = extractEmails(text)
  const phones = extractPhones(text)
  const extractedPostcode = extractLikelyPostcode(text)
  const openingHoursText = extractOpeningHoursText(text)
  const facilities = extractFacilitiesFromText(text)
  const socials = findOfficialSocials(html, domainFromUrl(normalized))
  const ticketHint = parseTicketHint(text)

  const partyInfo = /party|birthday/i.test(text)
    ? 'Party bookings are mentioned on the official website.'
    : ''

  const reviewSnippet = `Information verified from the venue website for ${venueName}${venueAddress ? `, ${venueAddress}` : ''}.`

  return {
    websiteFetched: true,
    website: normalized,
    email: emails[0] || '',
    phone: phones[0] || '',
    postcode: extractedPostcode,
    openingHoursText,
    facilities,
    socials,
    ticketHint,
    partyInfo,
    reviewSnippet,
    sourceUrl: normalized,
    text,
  }
}

function buildOpeningHoursJson(hoursText, googleOpeningHours) {
  if (googleOpeningHours?.weekday_text?.length) {
    return {
      weekday_text: googleOpeningHours.weekday_text,
      open_now: googleOpeningHours.open_now ?? null,
      source: 'google_places',
    }
  }
  if (!hoursText) return null
  return {
    text: hoursText,
    source: 'website_text',
  }
}

async function enrichVenue(venue, confidenceThreshold) {
  const sourceUrls = new Set()
  const notes = []
  const extracted = {
    placeId: venue.google_place_id || '',
    websiteFetched: false,
    phone: '',
    postcode: '',
    officialWebsiteDomain: false,
  }

  let google = null
  if (venue.google_place_id) {
    try {
      google = await fetchGoogleDetails(venue.google_place_id)
      if (google) {
        sourceUrls.add('https://maps.googleapis.com/maps/api/place/details/json')
        extracted.placeId = google.place_id || extracted.placeId
      }
    } catch (error) {
      notes.push(`google_places_failed:${error.message}`)
    }
  }

  let websiteFacts = null
  const websiteCandidate = normalizeUrl(venue.website) || normalizeUrl(google?.website || '')
  if (websiteCandidate) {
    try {
      websiteFacts = await fetchWebsiteFacts(websiteCandidate, venue.name, venue.address)
      if (websiteFacts?.sourceUrl) sourceUrls.add(websiteFacts.sourceUrl)
      extracted.websiteFetched = Boolean(websiteFacts?.websiteFetched)
      extracted.phone = websiteFacts?.phone || ''
      extracted.postcode = websiteFacts?.postcode || ''
      extracted.officialWebsiteDomain = isLikelyOfficialDomain(domainFromUrl(websiteFacts?.website || websiteCandidate))
    } catch (error) {
      notes.push(`website_fetch_failed:${error.message}`)
    }
  }

  let geocode = null
  if ((venue.lat == null || venue.lng == null) && (venue.address || google?.formatted_address)) {
    try {
      geocode = await geocodeWithNominatim(venue.address || google?.formatted_address)
      if (geocode?.sourceUrl) sourceUrls.add(geocode.sourceUrl)
    } catch (error) {
      notes.push(`geocode_failed:${error.message}`)
    }
  }

  const googleAddress = parseAddressParts(google?.formatted_address || '')
  const websiteFacilities = websiteFacts?.facilities || []
  const tags = deriveTags(venue.category || '', websiteFacilities, websiteFacts?.text || '')

  const nextData = {
    address: normalizeText(venue.address) || googleAddress.address,
    city: normalizeText(venue.city) || googleAddress.city,
    county: normalizeText(venue.county) || googleAddress.county,
    postcode: normalizeUkPostcode(venue.postcode) || normalizeUkPostcode(googleAddress.postcode) || normalizeUkPostcode(websiteFacts?.postcode || ''),
    country: normalizeText(venue.country) || googleAddress.country || 'UK',
    lat: venue.lat ?? google?.geometry?.location?.lat ?? geocode?.lat ?? null,
    lng: venue.lng ?? google?.geometry?.location?.lng ?? geocode?.lng ?? null,
    phone: normalizePhoneUk(venue.phone) || normalizePhoneUk(google?.international_phone_number || google?.formatted_phone_number || websiteFacts?.phone || ''),
    email: normalizeText(venue.email) || normalizeText(websiteFacts?.email || ''),
    website: normalizeUrl(venue.website) || normalizeUrl(google?.website || websiteFacts?.website || ''),
    opening_hours_text: normalizeText(venue.opening_hours_text) || normalizeText(google?.opening_hours?.weekday_text?.join('; ') || websiteFacts?.openingHoursText || ''),
    opening_hours: venue.opening_hours || buildOpeningHoursJson(websiteFacts?.openingHoursText || '', google?.opening_hours),
    category: normalizeText(venue.category),
    tags,
    pricing_hint: normalizeText(venue.pricing_hint) || normalizeText(websiteFacts?.ticketHint || ''),
    facilities_list_text: normalizeText(venue.facilities_list_text) || websiteFacilities.join(', '),
    facilities: Array.isArray(venue.facilities)
      ? [...new Set([...venue.facilities, ...websiteFacilities])]
      : websiteFacilities,
    parties: venue.parties ?? websiteFacilities.includes('parties'),
    has_party_rooms: venue.has_party_rooms ?? websiteFacilities.includes('parties'),
    has_outdoor_play: venue.has_outdoor_play ?? websiteFacilities.includes('outdoor_play'),
    has_role_play: venue.has_role_play ?? websiteFacilities.includes('role_play'),
    has_sen_sessions: venue.has_sen_sessions ?? websiteFacilities.includes('sensory_sessions'),
    cafe: venue.cafe ?? websiteFacilities.includes('cafe'),
    parking: venue.parking ?? websiteFacilities.includes('parking'),
    baby_area: venue.baby_area ?? websiteFacilities.includes('toddler_zone'),
    toddler_area: venue.toddler_area ?? websiteFacilities.includes('toddler_zone'),
    wheelchair_access: venue.wheelchair_access ?? websiteFacilities.includes('accessibility'),
    free_wifi: venue.free_wifi ?? websiteFacilities.includes('wifi'),
    socials: venue.socials && Object.keys(venue.socials).length ? venue.socials : (websiteFacts?.socials || {}),
    party_info: normalizeText(venue.party_info) || normalizeText(websiteFacts?.partyInfo || ''),
    review_snippet: normalizeText(venue.review_snippet) || normalizeText(websiteFacts?.reviewSnippet || ''),
  }

  const desc = normalizeText(venue.description) || buildDescription({
    name: venue.name,
    city: nextData.city,
    address: nextData.address,
    facilities: websiteFacilities,
    partyInfo: nextData.party_info,
  })
  nextData.description = desc

  if (!validateUkPostcode(nextData.postcode || '')) nextData.postcode = normalizeUkPostcode(googleAddress.postcode || websiteFacts?.postcode || '')

  const signals = computeMatchingSignals(venue, {
    placeId: extracted.placeId,
    websiteFetched: extracted.websiteFetched,
    phone: nextData.phone,
    postcode: nextData.postcode,
    address: nextData.address,
    geocoded: Boolean(geocode || (google?.geometry?.location?.lat && google?.geometry?.location?.lng)),
    officialWebsiteDomain: extracted.officialWebsiteDomain,
  })

  const confidence = scoreConfidence(signals)
  const sourceUrlArray = buildSourceUrlList(venue.source_urls, [...sourceUrls])

  const candidatePatch = {
    ...nextData,
    source_urls: sourceUrlArray,
    confidence_score: Number(confidence.toFixed(2)),
    last_verified_at: nowIso(),
    updated_by: 'enrichment-bot',
    updated_at: nowIso(),
    source_meta: {
      google_types: google?.types || [],
      business_status: google?.business_status || '',
      venue_domain: domainFromUrl(nextData.website || ''),
    },
    enrichment_notes: notes.join('; '),
    needs_review: false,
  }

  const patch = computePatch(venue, candidatePatch)

  if (confidence < confidenceThreshold) {
    patch.needs_review = true
    patch.enrichment_notes = `${normalizeText(candidatePatch.enrichment_notes)};low_confidence`
  }

  if (google?.business_status === 'CLOSED_PERMANENTLY') {
    patch.status = 'closed_permanently'
    notes.push('marked_closed_from_google')
  }

  return {
    confidence,
    sourceUrls: sourceUrlArray,
    patch,
    diff: diffObject(venue, patch),
    notes,
    ambiguous: confidence < confidenceThreshold,
  }
}

async function applyPatch(client, venueId, patch) {
  const entries = Object.entries(patch)
  if (entries.length === 0) return

  const jsonbFields = new Set(['source_urls', 'source_meta', 'socials', 'opening_hours', 'facilities'])
  const setFragments = []
  const values = []
  let idx = 1

  for (const [field, value] of entries) {
    if (field === 'id') continue
    if (jsonbFields.has(field)) {
      setFragments.push(`${field} = $${idx++}::jsonb`)
      values.push(JSON.stringify(value ?? {}))
    } else {
      setFragments.push(`${field} = $${idx++}`)
      values.push(toJsonSafe(value))
    }
  }
  values.push(venueId)

  const sql = `UPDATE venues SET ${setFragments.join(', ')} WHERE id = $${idx}`
  await client.query(sql, values)
}

function writeNeedsReviewCsv(filePath, list) {
  const header = 'id,name,city,confidence,reason,candidates\n'
  const lines = list.map((item) => {
    const row = [
      item.id,
      `"${String(item.name || '').replace(/"/g, '""')}"`,
      `"${String(item.city || '').replace(/"/g, '""')}"`,
      item.confidence,
      `"${String(item.reason || '').replace(/"/g, '""')}"`,
      `"${String(item.candidates || '').replace(/"/g, '""')}"`,
    ]
    return row.join(',')
  })
  fs.writeFileSync(filePath, header + lines.join('\n'))
}

async function runWithConcurrency(items, concurrency, handler) {
  const out = []
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++
      out[idx] = await handler(items[idx], idx)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  loadEnvLocal()

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing. Configure in .env.local')
    process.exit(1)
  }

  const runStamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runDir = path.join(projectRoot, 'data', 'enrichment_runs', runStamp)
  ensureDir(runDir)

  appendLog(
    `START mode=${args.dryRun ? 'dry-run' : 'commit'} limit=${args.limit} venue_id=${args.venueId || ''} websites_only=${args.websitesOnly} skip_needs_review=${args.skipNeedsReview}`
  )

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: Math.max(2, args.concurrency + 1),
  })

  const client = await pool.connect()
  const summary = {
    processed: 0,
    updated: 0,
    skipped: 0,
    needsReview: 0,
    failed: 0,
  }
  const needsReview = []

  try {
    await ensureEnrichmentColumns(client)
    const venues = await getCandidateVenues(client, args)
    appendLog(`CANDIDATES count=${venues.length}`)

    const results = await runWithConcurrency(venues, args.concurrency, async (venue) => {
      const beforePath = path.join(runDir, `${venue.id}-before.json`)
      fs.writeFileSync(beforePath, JSON.stringify(venue, null, 2))

      try {
        const result = await enrichVenue(venue, args.confidenceThreshold)
        const afterState = { ...venue, ...result.patch }
        const afterPath = path.join(runDir, `${venue.id}-after.json`)
        fs.writeFileSync(afterPath, JSON.stringify(afterState, null, 2))

        summary.processed++

        if (result.diff.length === 0) {
          summary.skipped++
          appendLog(`SKIP id=${venue.id} name="${venue.name}" reason=no_changes`)
          return { venue, result, action: 'skipped' }
        }

        const ambiguous = result.confidence < args.confidenceThreshold
        if (ambiguous) {
          summary.needsReview++
          needsReview.push({
            id: venue.id,
            name: venue.name,
            city: venue.city || venue.city_slug,
            confidence: result.confidence.toFixed(2),
            reason: 'low confidence',
            candidates: result.sourceUrls.join('|'),
          })
          appendLog(`REVIEW id=${venue.id} confidence=${result.confidence.toFixed(2)} diff="${summarizeDiff(result.diff)}"`)
          return { venue, result, action: 'needs_review' }
        }

        if (!args.dryRun) {
          await applyPatch(client, venue.id, result.patch)
          summary.updated++
          appendLog(`UPDATE id=${venue.id} confidence=${result.confidence.toFixed(2)} diff="${summarizeDiff(result.diff)}"`)
        } else {
          summary.updated++
          appendLog(`DRY_UPDATE id=${venue.id} confidence=${result.confidence.toFixed(2)} diff="${summarizeDiff(result.diff)}"`)
        }

        return { venue, result, action: args.dryRun ? 'dry_update' : 'updated' }
      } catch (error) {
        summary.failed++
        appendLog(`ERROR id=${venue.id} name="${venue.name}" error="${error.message}"`)
        return { venue, error, action: 'failed' }
      }
    })

    const needsReviewCsv = path.join(projectRoot, 'data', 'enrichment_needs_review.csv')
    writeNeedsReviewCsv(needsReviewCsv, needsReview)

    console.log('='.repeat(72))
    console.log(`VENUE ENRICHMENT ${args.dryRun ? '(DRY RUN)' : '(COMMIT)'}`)
    console.log('='.repeat(72))
    console.log(`Processed: ${summary.processed}`)
    console.log(`Updated: ${summary.updated}`)
    console.log(`Skipped: ${summary.skipped}`)
    console.log(`Needs review: ${summary.needsReview}`)
    console.log(`Failed: ${summary.failed}`)
    console.log(`Audit dir: ${runDir}`)
    console.log(`Needs review CSV: ${needsReviewCsv}`)
    console.log('\nSample diffs:')

    for (const row of results.filter((r) => r?.result?.diff?.length).slice(0, 10)) {
      console.log(`- [${row.action}] #${row.venue.id} ${row.venue.name} (confidence ${row.result.confidence.toFixed(2)})`)
      row.result.diff.slice(0, 8).forEach((d) => {
        console.log(`    ${d.field}: ${JSON.stringify(d.from)} -> ${JSON.stringify(d.to)}`)
      })
    }
  } finally {
    client.release()
    await pool.end()
    appendLog('END')
  }
}

main().catch((error) => {
  appendLog(`FATAL error="${error.message}"`)
  console.error('Enrichment failed:', error.message)
  process.exit(1)
})
