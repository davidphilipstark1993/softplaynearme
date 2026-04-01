/**
 * import-raw-city-csvs.mjs
 *
 * Parses raw Google Maps scraped CSVs for 8 major UK cities not covered by the
 * master processed CSVs. Enriches each venue with inferred features, a generated
 * description, SEO summary, and tags before upserting to the database.
 *
 * Cities: Birmingham, Bristol, Hull, Leeds, Liverpool, London, Manchester, Sheffield
 *
 * Usage:
 *   node scripts/import-raw-city-csvs.mjs                         # dry run
 *   node scripts/import-raw-city-csvs.mjs --commit                 # write to DB
 *   node scripts/import-raw-city-csvs.mjs --commit --city Leeds    # single city
 *   node scripts/import-raw-city-csvs.mjs --include-all            # include borderline venues
 *
 * Raw CSV column layout (Google Maps scraper HTML class names):
 *   [0]  hfpxzc href  → google_maps_url
 *   [1]  qBF1Pd       → name
 *   [2]  MW4etd       → rating  (e.g. "4.3")
 *   [3]  UY7F9        → review_count (e.g. "(1,234)")
 *   [4]  W4Efsd       → category
 *   [5]  W4Efsd 2     → separator (·) – skip
 *   [6]  doJOZc       → icon char – skip
 *   [7]  W4Efsd 3     → separator (·) – skip
 *   [8]  W4Efsd 4     → address (partial street)
 *   [9]  W4Efsd 5     → status ("Open" / "Closed")
 *   [10] W4Efsd 6     → next open time ("· Opens 10 am Sun")
 *   [11] FQ2IWe src   → venue photo URL (lh3.googleusercontent.com)
 *   [12] Jn12ke src   → default reviewer avatar – skip
 *   [13] ah5Ghc       → review snippet part 1
 *   [14] ah5Ghc 2     → review snippet part 2
 *   [15] ah5Ghc 3     → review snippet part 3
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CSV_FOLDER =
  '/Users/davidstark/Desktop/Stark Business/soft play near me (set up)/google maps scraped '

const CITY_FILES = [
  // --- Original 8 cities ---
  { file: 'Birmingham .csv',           city: 'Birmingham',      citySlug: 'birmingham',  county: 'West Midlands',        region: 'West Midlands' },
  { file: 'Bristol.csv',               city: 'Bristol',         citySlug: 'bristol',     county: 'Bristol',              region: 'South West' },
  { file: 'Hull .csv',                 city: 'Hull',            citySlug: 'hull',        county: 'East Yorkshire',       region: 'Yorkshire and the Humber' },
  { file: 'Liverpool .csv',            city: 'Liverpool',       citySlug: 'liverpool',   county: 'Merseyside',           region: 'North West' },
  { file: 'leeds.csv',                 city: 'Leeds',           citySlug: 'leeds',       county: 'West Yorkshire',       region: 'Yorkshire and the Humber' },
  { file: 'london.csv',                city: 'London',          citySlug: 'london',      county: 'Greater London',       region: 'London' },
  { file: 'manchester .csv',           city: 'Manchester',      citySlug: 'manchester',  county: 'Greater Manchester',   region: 'North West' },
  { file: 'soft play sheffield .csv',  city: 'Sheffield',       citySlug: 'sheffield',   county: 'South Yorkshire',      region: 'Yorkshire and the Humber' },

  // --- Additional cities from raw CSVs ---
  { file: 'aberdeen .csv',             city: 'Aberdeen',        citySlug: 'aberdeen',    county: 'Aberdeenshire',        region: 'Scotland' },
  { file: 'Barnsley .csv',             city: 'Barnsley',        citySlug: 'barnsley',    county: 'South Yorkshire',      region: 'Yorkshire and the Humber' },
  { file: 'BLACKPOOL.csv',             city: 'Blackpool',       citySlug: 'blackpool',   county: 'Lancashire',           region: 'North West' },
  { file: 'Bolton, Preston.csv',       city: 'Bolton',          citySlug: 'bolton',      county: 'Greater Manchester',   region: 'North West' },
  { file: 'Bournmouth.csv',            city: 'Bournemouth',     citySlug: 'bournemouth', county: 'Dorset',               region: 'South West' },
  { file: 'Bradford.csv',              city: 'Bradford',        citySlug: 'bradford',    county: 'West Yorkshire',       region: 'Yorkshire and the Humber' },
  { file: 'Brighton.csv',              city: 'Brighton',        citySlug: 'brighton',    county: 'East Sussex',          region: 'South East' },
  { file: 'Cardiff.csv',               city: 'Cardiff',         citySlug: 'cardiff',     county: 'Cardiff',              region: 'Wales' },
  { file: 'colchester.csv',            city: 'Colchester',      citySlug: 'colchester',  county: 'Essex',                region: 'East of England' },
  { file: 'doncaster .csv',            city: 'Doncaster',       citySlug: 'doncaster',   county: 'South Yorkshire',      region: 'Yorkshire and the Humber' },
  { file: 'Edinburgh.csv',             city: 'Edinburgh',       citySlug: 'edinburgh',   county: 'City of Edinburgh',    region: 'Scotland' },
  { file: 'glasgow.csv',               city: 'Glasgow',         citySlug: 'glasgow',     county: 'City of Glasgow',      region: 'Scotland' },
  { file: 'Halifax.csv',               city: 'Halifax',         citySlug: 'halifax',     county: 'West Yorkshire',       region: 'Yorkshire and the Humber' },
  { file: 'Hastings .csv',             city: 'Hastings',        citySlug: 'hastings',    county: 'East Sussex',          region: 'South East' },
  { file: 'Huddersfield .csv',         city: 'Huddersfield',    citySlug: 'huddersfield',county: 'West Yorkshire',       region: 'Yorkshire and the Humber' },
  { file: 'Inverness.csv',             city: 'Inverness',       citySlug: 'inverness',   county: 'Highland',             region: 'Scotland' },
  { file: 'Ipswich .csv',              city: 'Ipswich',         citySlug: 'ipswich',     county: 'Suffolk',              region: 'East of England' },
  { file: 'Leicester.csv',             city: 'Leicester',       citySlug: 'leicester',   county: 'Leicestershire',       region: 'East Midlands' },
  { file: 'Lincoln.csv',               city: 'Lincoln',         citySlug: 'lincoln',     county: 'Lincolnshire',         region: 'East Midlands' },
  { file: 'Newcastle .csv',            city: 'Newcastle',       citySlug: 'newcastle',   county: 'Tyne and Wear',        region: 'North East' },
  { file: 'Nottingham .csv',           city: 'Nottingham',      citySlug: 'nottingham',  county: 'Nottinghamshire',      region: 'East Midlands' },
  { file: 'norwich.csv',               city: 'Norwich',         citySlug: 'norwich',     county: 'Norfolk',              region: 'East of England' },
  { file: 'Portsmouth.csv',            city: 'Portsmouth',      citySlug: 'portsmouth',  county: 'Hampshire',            region: 'South East' },
  { file: 'southend .csv',             city: 'Southend-on-Sea', citySlug: 'southend',    county: 'Essex',                region: 'East of England' },
  { file: 'Stoke.csv',                 city: 'Stoke-on-Trent',  citySlug: 'stoke',       county: 'Staffordshire',        region: 'West Midlands' },
  { file: 'Sunderland .csv',           city: 'Sunderland',      citySlug: 'sunderland',  county: 'Tyne and Wear',        region: 'North East' },
  { file: 'swansea.csv',               city: 'Swansea',         citySlug: 'swansea',     county: 'Swansea',              region: 'Wales' },
]

// Minimum data threshold: a venue must have at least this many non-empty key fields
const MIN_FIELDS_REQUIRED = 2 // name + (maps_url OR rating OR address)

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  return {
    commit: argv.includes('--commit'),
    includeAll: argv.includes('--include-all'),
    city: argv.includes('--city') ? argv[argv.indexOf('--city') + 1] || '' : '',
  }
}

// ---------------------------------------------------------------------------
// .env.local loader
// ---------------------------------------------------------------------------

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
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

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

function parseCSVLine(line) {
  const out = []
  let curr = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    const n = line[i + 1]
    if (inQ) {
      if (c === '"' && n === '"') { curr += '"'; i++ }
      else if (c === '"') inQ = false
      else curr += c
    } else if (c === '"') {
      inQ = true
    } else if (c === ',') {
      out.push(curr); curr = ''
    } else {
      curr += c
    }
  }
  out.push(curr)
  return out
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return []
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map((l) => {
    const vals = parseCSVLine(l)
    const row = {}
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] || '').trim() })
    return row
  })
}

// ---------------------------------------------------------------------------
// Field extractors
// ---------------------------------------------------------------------------

function norm(v) {
  return (v || '').trim().replace(/\s+/g, ' ')
}

function extractGoogleMapsUrl(row) {
  return norm(row['hfpxzc href'])
}

function extractName(row) {
  return norm(row['qBF1Pd'])
}

function extractRating(row) {
  const raw = norm(row['MW4etd'])
  const n = parseFloat(raw)
  return isNaN(n) ? null : Math.round(n * 10) / 10
}

function extractReviewCount(row) {
  const raw = norm(row['UY7F9'])
  const digits = raw.replace(/[^\d]/g, '')
  const n = parseInt(digits, 10)
  return isNaN(n) ? null : n
}

function extractCategory(row) {
  return norm(row['W4Efsd'])
}

function extractAddress(row) {
  const raw = norm(row['W4Efsd 4'])
  // Strip Google Maps status/hours noise that bleeds into the address field
  return raw
    .replace(/,?\s*(Closed|Open|Opens?\s[\d:]+\s?(am|pm)\s?\w*|Closes?\s[\d:]+\s?(am|pm))[^,]*/gi, '')
    .replace(/,?\s*·[^,]*/g, '')
    .replace(/,\s*nan\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/,+$/, '')
    .trim()
}

function extractStatus(row) {
  const s = norm(row['W4Efsd 5'])
  if (!s || s === 'nan') return null
  if (/^open$/i.test(s)) return 'Open'
  if (/^closed$/i.test(s)) return 'Closed'
  return null
}

function extractOpeningHoursText(row) {
  const raw = norm(row['W4Efsd 6'])
  if (!raw || raw === 'nan') return null
  return raw.replace(/^·\s*/, '').replace(/\u202f/g, ' ').trim()
}

function extractPhotoUrl(row) {
  const url = norm(row['FQ2IWe src'])
  // Only keep real venue photos (Google's CDN), not the default user avatar
  if (!url || url.includes('ssl.gstatic.com') || url.includes('default_user')) return null
  return url
}

function extractReviewSnippet(row) {
  const parts = [
    norm(row['ah5Ghc']),
    norm(row['ah5Ghc 2']),
    norm(row['ah5Ghc 3']),
  ].filter(Boolean)
  if (!parts.length) return null
  let snippet = parts.join(' ').replace(/^"+|"+$/g, '').trim()
  snippet = snippet.replace(/\s+/g, ' ')
  if (snippet.length < 10) return null
  // Ensure it ends with punctuation
  if (!/[.!?]$/.test(snippet)) snippet += '.'
  return snippet
}

function extractCoordinates(url) {
  if (!url) return { lat: null, lng: null }
  const latM = url.match(/!3d(-?\d+\.?\d*)/)
  const lngM = url.match(/!4d(-?\d+\.?\d*)/)
  if (latM && lngM) return { lat: parseFloat(latM[1]), lng: parseFloat(lngM[1]) }
  const atM = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (atM) return { lat: parseFloat(atM[1]), lng: parseFloat(atM[2]) }
  return { lat: null, lng: null }
}

function extractPostcode(address) {
  if (!address) return null
  const m = address.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i)
  return m ? m[1].toUpperCase().replace(/\s+/, ' ') : null
}

function normalizeMapsKey(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    u.hash = ''; u.search = ''
    return u.toString().replace(/\/+$/, '').toLowerCase()
  } catch {
    return url.toLowerCase().replace(/\/+$/, '')
  }
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 100)
}

// ---------------------------------------------------------------------------
// Feature inference
// ---------------------------------------------------------------------------

const FEATURE_PATTERNS = {
  cafe:          /\b(caf[eé]|coffee|food|eat|lunch|snack|kitchen|refreshment|hot drink|cake|meal)\b/i,
  parking:       /\b(parking|car\s*park|free\s*park|ample\s*park)\b/i,
  parties:       /\b(party|parties|birthday|party\s*room|private\s*hire|celebration|event room)\b/i,
  toddler_area:  /\b(toddler|under\s*[23]|little\s*one|crawl|baby|infant|tots?|under\s*twos?)\b/i,
  baby_area:     /\b(baby|babies|infant|under\s*1|newborn|crawl)\b/i,
  sen_friendly:  /\b(sen|sensory|special\s*needs|disability|autism|autistic|quiet\s*session|ndis)\b/i,
  has_outdoor_play: /\b(outdoor|outside|garden|yard|open\s*air|adventure\s*trail)\b/i,
  has_role_play: /\b(role\s*play|roleplay|dressing\s*up|pretend|imagination|fire\s*station|shop|doctor|vet)\b/i,
  has_multi_level_play: /\b(multi[\s-]level|levels?|floors?|large|massive|huge|giant|enormous|storey|3\s*level|4\s*level)\b/i,
}

function inferFeatures(text) {
  const result = {}
  for (const [feature, pattern] of Object.entries(FEATURE_PATTERNS)) {
    result[feature] = pattern.test(text)
  }
  return result
}

// ---------------------------------------------------------------------------
// Category normalisation
// ---------------------------------------------------------------------------

const CATEGORY_MAP = {
  "indoor playground":              "Indoor Soft Play",
  "children's amusement centre":    "Children's Amusement Centre",
  "children's amusement center":    "Children's Amusement Centre",
  "amusement center":               "Amusement Centre",
  "play centre":                    "Play Centre",
  "indoor play centre":             "Indoor Play Centre",
  "inflatable":                     "Inflatable Play Centre",
  "soft play":                      "Soft Play Centre",
  "play area":                      "Play Area",
  "recreation center":              "Recreation Centre",
  "recreation centre":              "Recreation Centre",
  "sports complex":                 "Sports Complex",
  "gym":                            "Gym / Play Centre",
  "leisure centre":                 "Leisure Centre",
}

function normaliseCategory(raw) {
  if (!raw) return 'Soft Play Centre'
  const lower = raw.toLowerCase()
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val
  }
  return raw
}

// Heuristic: is this likely a genuine soft play / children's play venue?
function looksLikeSoftPlay(name, category) {
  const combined = `${name} ${category}`.toLowerCase()
  // Hard exclude: clearly not a play venue
  const EXCLUDE_PATTERNS = [
    /\b(pub|bar|restaurant|hotel|gym|spa|hairdress|salon|clinic|dentist|optician|chemist|pharmacy)\b/,
    /\b(supermarket|tesco|asda|morrisons|sainsbury|lidl|aldi)\b/,
    /\b(estate agent|letting|solicitor|accountant|insurance)\b/,
  ]
  for (const p of EXCLUDE_PATTERNS) if (p.test(combined)) return false

  // Positive signals
  const INCLUDE_PATTERNS = [
    /\b(soft\s*play|play\s*cent|playground|play\s*area|play\s*world|play\s*zone|play\s*land|play\s*barn|play\s*hub|playbarn)\b/,
    /\b(bounce|inflat|trampoline|adventure|leisure|activity)\b/,
    /\b(children|child|kids?|toddler|baby|junior|family)\b/,
    /\b(amusement|entertainment|fun)\b/,
    /indoor\s*play/,
    /\b(play\s*cafe|play\s*café|playgroup)\b/,
  ]
  for (const p of INCLUDE_PATTERNS) if (p.test(combined)) return true

  // If category says indoor playground / amusement centre, likely fine
  if (/(playground|amusement|play centre|play center)/i.test(category)) return true

  return false // Default: flag as uncertain
}

// ---------------------------------------------------------------------------
// Description generator
// ---------------------------------------------------------------------------

const CATEGORY_OPENER = {
  'Indoor Soft Play':               'An indoor soft play centre',
  "Children's Amusement Centre":    'A family-friendly amusement centre',
  'Amusement Centre':               'A family-friendly amusement centre',
  'Play Centre':                    'A popular play centre',
  'Indoor Play Centre':             'An indoor play centre',
  'Inflatable Play Centre':         'An inflatable play and amusement centre',
  'Soft Play Centre':               'A soft play centre',
  'Play Area':                      'A children\'s play area',
  'Recreation Centre':              'A recreation and play centre',
  'Leisure Centre':                 'A leisure centre with play facilities',
  'Sports Complex':                 'A sports and play complex',
}

function generateDescription(venue) {
  const { name, city, normCategory, features, reviewSnippet, rating, reviewCount } = venue

  const opener = CATEGORY_OPENER[normCategory] || 'A children\'s play venue'

  // Sentence 1: what it is + where
  let s1 = `${opener} located in ${city}`
  if (rating && reviewCount && reviewCount >= 20) {
    const ratingDesc = rating >= 4.5 ? 'highly rated' : rating >= 4.0 ? 'well reviewed' : 'reviewed'
    s1 += `, ${ratingDesc} by local families`
  }
  s1 += '.'

  // Sentence 2: review snippet (cleaned) or feature summary
  let s2 = ''
  if (reviewSnippet) {
    // Use the review snippet directly — it's authentic user voice
    s2 = reviewSnippet
  } else {
    // Build from inferred features
    const featureList = []
    if (features.toddler_area) featureList.push('dedicated toddler areas')
    if (features.baby_area) featureList.push('baby-friendly zones')
    if (features.cafe) featureList.push('an on-site café')
    if (features.parking) featureList.push('convenient parking')
    if (features.parties) featureList.push('party room hire')
    if (features.has_outdoor_play) featureList.push('outdoor play areas')
    if (features.sen_friendly) featureList.push('SEN-friendly sessions')

    if (featureList.length >= 2) {
      s2 = `Facilities include ${featureList.slice(0, 3).join(', ')}.`
    }
  }

  // Sentence 3: call-to-action / features highlight (if room)
  let s3 = ''
  const featureHighlights = []
  if (features.parties) featureHighlights.push('birthday parties')
  if (features.toddler_area) featureHighlights.push('toddler sessions')
  if (features.sen_friendly) featureHighlights.push('SEN sessions')
  if (features.has_outdoor_play) featureHighlights.push('outdoor play')

  if (featureHighlights.length > 0) {
    s3 = `Popular for ${featureHighlights.join(' and ')}.`
  }

  return [s1, s2, s3].filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// SEO summary generator
// ---------------------------------------------------------------------------

function generateSeoSummary(venue) {
  const { name, city, normCategory, features, rating, reviewCount } = venue
  const typeName = normCategory.toLowerCase().replace(/^(a|an)\s+/i, '')
  const article = /^[aeiou]/i.test(typeName) ? 'an' : 'a'
  const parts = [`${name} is ${article} ${typeName} in ${city}`]

  const perks = []
  if (features.toddler_area) perks.push('great for toddlers')
  if (features.parties) perks.push('available for birthday parties')
  if (features.cafe) perks.push('with a café on site')
  if (features.parking) perks.push('with free parking')

  if (perks.length) {
    parts.push(perks.slice(0, 2).join(' and '))
  } else if (rating && rating >= 4.0) {
    parts.push('with excellent family reviews')
  }

  if (reviewCount && reviewCount >= 100) {
    parts.push(`rated ${rating?.toFixed(1)} by ${reviewCount.toLocaleString()} visitors`)
  }

  return parts.join(', ') + '.'
}

// ---------------------------------------------------------------------------
// Tag generator
// ---------------------------------------------------------------------------

function generateTags(venue) {
  const { city, citySlug, normCategory, features, rating, reviewCount } = venue
  const tags = new Set([`soft-play-${citySlug}`, 'soft-play', 'indoor-play', 'kids-activities'])

  // Category tags
  if (/inflatable/i.test(normCategory)) tags.add('inflatable-park')
  if (/role.?play/i.test(normCategory)) tags.add('role-play-centre')
  if (/trampoline/i.test(normCategory)) tags.add('trampoline-park')

  // Feature tags
  if (features.toddler_area) tags.add('toddler-friendly')
  if (features.baby_area) tags.add('baby-friendly')
  if (features.cafe) tags.add('cafe-on-site')
  if (features.parking) tags.add('parking-available')
  if (features.parties) tags.add('party-venue')
  if (features.sen_friendly) tags.add('sen-friendly')
  if (features.has_outdoor_play) tags.add('outdoor-play')
  if (features.has_role_play) tags.add('role-play')
  if (features.has_multi_level_play) tags.add('large-play-frame')

  // Rating tags
  if (rating && rating >= 4.5) tags.add('top-rated')
  else if (rating && rating >= 4.0) tags.add('highly-rated')

  // Popularity tags
  if (reviewCount && reviewCount >= 500) tags.add('popular')
  else if (reviewCount && reviewCount >= 200) tags.add('well-established')

  // City tag
  tags.add(citySlug)

  return [...tags]
}

// ---------------------------------------------------------------------------
// Minimum threshold check
// ---------------------------------------------------------------------------

function meetsThreshold(venue, includeAll) {
  // Hard requirements
  if (!venue.name) return { ok: false, reason: 'missing_name' }

  // Soft play relevance check
  if (!includeAll && !looksLikeSoftPlay(venue.name, venue.rawCategory)) {
    return { ok: false, reason: 'not_a_play_venue' }
  }

  // Need at least one of: maps_url, rating, address
  const hasIdentifier = venue.googleMapsUrl || venue.rating || venue.address
  if (!hasIdentifier) return { ok: false, reason: 'no_identifying_data' }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// Build venue payload
// ---------------------------------------------------------------------------

function buildVenue(row, cityMeta) {
  const googleMapsUrl = extractGoogleMapsUrl(row)
  const name = extractName(row)
  const rating = extractRating(row)
  const reviewCount = extractReviewCount(row)
  const rawCategory = extractCategory(row)
  const address = extractAddress(row)
  const status = extractStatus(row)
  const openingHoursText = extractOpeningHoursText(row)
  const photoUrl = extractPhotoUrl(row)
  const reviewSnippet = extractReviewSnippet(row)
  const { lat, lng } = extractCoordinates(googleMapsUrl)
  const postcode = extractPostcode(address)

  const normCategory = normaliseCategory(rawCategory)
  const { city, citySlug, county, region } = cityMeta

  // Combine all text for feature inference
  const inferText = [name, rawCategory, reviewSnippet, address].filter(Boolean).join(' ')
  const features = inferFeatures(inferText)

  const description = generateDescription({ name, city, normCategory, features, reviewSnippet, rating, reviewCount })
  const seoSummary = generateSeoSummary({ name, city, citySlug, normCategory, features, rating, reviewCount })
  const tags = generateTags({ city, citySlug, normCategory, features, rating, reviewCount })

  const slug = slugify(`${name}-${city}`)
  const mapsUrlKey = normalizeMapsKey(googleMapsUrl)
  const dedupeKey = `${name.toLowerCase()}|${address.toLowerCase()}|${city.toLowerCase()}`

  return {
    name,
    slug,
    citySlug,
    city,
    county,
    region,
    address: address || null,
    postcode,
    lat,
    lng,
    rawCategory,
    normCategory,
    status,
    openingHoursText,
    googleMapsUrl: googleMapsUrl || null,
    mapsUrlKey,
    dedupeKey,
    photoUrl,
    rating,
    reviewCount,
    reviewSnippet,
    description,
    seoSummary,
    tags,
    features,
  }
}

// ---------------------------------------------------------------------------
// Database schema
// ---------------------------------------------------------------------------

async function ensureColumns(client) {
  const cols = [
    ['google_maps_url', 'TEXT'],
    ['maps_url_key', 'TEXT'],
    ['dedupe_key', 'TEXT'],
    ['city', 'VARCHAR(150)'],
    ['town', 'VARCHAR(150)'],
    ['county', 'VARCHAR(150)'],
    ['region', 'VARCHAR(150)'],
    ['category', 'VARCHAR(255)'],
    ['status', 'VARCHAR(80)'],
    ['main_image_url', 'TEXT'],
    ['review_snippet', 'TEXT'],
    ['facilities_list_text', 'TEXT'],
    ['description', 'TEXT'],
    ['seo_summary', 'TEXT'],
    ['tags', 'TEXT[]'],
    ['rating', 'DECIMAL(3,1)'],
    ['reviews_count', 'INTEGER'],
    ['has_under_1s', 'BOOLEAN DEFAULT false'],
    ['has_party_rooms', 'BOOLEAN DEFAULT false'],
    ['has_multi_level_play', 'BOOLEAN DEFAULT false'],
    ['has_role_play', 'BOOLEAN DEFAULT false'],
    ['has_outdoor_play', 'BOOLEAN DEFAULT false'],
    ['has_sen_sessions', 'BOOLEAN DEFAULT false'],
  ]

  for (const [name, type] of cols) {
    await client.query(`ALTER TABLE venues ADD COLUMN IF NOT EXISTS ${name} ${type}`)
  }

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_venues_maps_url_key ON venues(maps_url_key)',
    'CREATE INDEX IF NOT EXISTS idx_venues_dedupe_key ON venues(dedupe_key)',
    'CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city)',
    'CREATE INDEX IF NOT EXISTS idx_venues_rating ON venues(rating)',
  ]
  for (const idx of indexes) await client.query(idx)
}

async function getColumns(client) {
  const r = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'venues'`)
  return new Set(r.rows.map((x) => x.column_name))
}

// ---------------------------------------------------------------------------
// Dedup lookup
// ---------------------------------------------------------------------------

async function findExisting(client, venue) {
  // 1. Match on normalised maps URL key (most reliable)
  if (venue.mapsUrlKey) {
    const r = await client.query('SELECT id FROM venues WHERE maps_url_key = $1 LIMIT 1', [venue.mapsUrlKey])
    if (r.rows.length) return r.rows[0].id
  }

  // 2. Match on dedupe key (name + address + city)
  if (venue.dedupeKey) {
    const r = await client.query('SELECT id FROM venues WHERE dedupe_key = $1 LIMIT 1', [venue.dedupeKey])
    if (r.rows.length) return r.rows[0].id
  }

  // 3. Fuzzy: same name + same city slug
  const r = await client.query(
    `SELECT id FROM venues WHERE lower(trim(name)) = lower(trim($1)) AND city_slug = $2 LIMIT 1`,
    [venue.name, venue.citySlug]
  )
  if (r.rows.length) return r.rows[0].id

  return null
}

// ---------------------------------------------------------------------------
// Insert / Update
// ---------------------------------------------------------------------------

function facilitiesJson(v) {
  return JSON.stringify({
    toddler_area: v.features.toddler_area,
    baby_area: v.features.baby_area,
    cafe: v.features.cafe,
    parking: v.features.parking,
    party_rooms: v.features.parties,
    has_party_rooms: v.features.parties,
    has_multi_level_play: v.features.has_multi_level_play,
    has_role_play: v.features.has_role_play,
    has_outdoor_play: v.features.has_outdoor_play,
    sen_sessions: v.features.sen_friendly,
    tags: v.tags,
    seo_summary: v.seoSummary,
  })
}

async function insertVenue(client, v) {
  await client.query(
    `INSERT INTO venues (
      name, slug, city_slug, city, town, county, region,
      address, postcode, lat, lng,
      category, status, google_maps_url, maps_url_key, dedupe_key,
      main_image_url, review_snippet, description, seo_summary, tags, rating, reviews_count,
      toddler_area, baby_area, cafe, parking, parties, sen_friendly,
      has_under_1s, has_party_rooms, has_multi_level_play, has_role_play, has_outdoor_play, has_sen_sessions,
      facilities,
      created_at, updated_at, last_verified_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,
      $8,$9,$10,$11,
      $12,$13,$14,$15,$16,
      $17,$18,$19,$20,$21,$22,$23,
      $24,$25,$26,$27,$28,$29,
      $30,$31,$32,$33,$34,$35,
      $36,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (city_slug, slug) DO UPDATE SET
      city         = COALESCE(NULLIF(EXCLUDED.city,''), venues.city),
      county       = COALESCE(NULLIF(EXCLUDED.county,''), venues.county),
      region       = COALESCE(NULLIF(EXCLUDED.region,''), venues.region),
      address      = COALESCE(NULLIF(EXCLUDED.address,''), venues.address),
      postcode     = COALESCE(NULLIF(EXCLUDED.postcode,''), venues.postcode),
      lat          = COALESCE(EXCLUDED.lat, venues.lat),
      lng          = COALESCE(EXCLUDED.lng, venues.lng),
      category     = COALESCE(NULLIF(EXCLUDED.category,''), venues.category),
      status       = COALESCE(NULLIF(EXCLUDED.status,''), venues.status),
      google_maps_url = COALESCE(NULLIF(EXCLUDED.google_maps_url,''), venues.google_maps_url),
      maps_url_key = COALESCE(NULLIF(EXCLUDED.maps_url_key,''), venues.maps_url_key),
      dedupe_key   = COALESCE(NULLIF(EXCLUDED.dedupe_key,''), venues.dedupe_key),
      main_image_url = COALESCE(NULLIF(EXCLUDED.main_image_url,''), venues.main_image_url),
      review_snippet = COALESCE(NULLIF(EXCLUDED.review_snippet,''), venues.review_snippet),
      description  = COALESCE(NULLIF(EXCLUDED.description,''), venues.description),
      seo_summary  = COALESCE(NULLIF(EXCLUDED.seo_summary,''), venues.seo_summary),
      tags         = COALESCE(EXCLUDED.tags, venues.tags),
      rating       = COALESCE(EXCLUDED.rating, venues.rating),
      reviews_count = COALESCE(EXCLUDED.reviews_count, venues.reviews_count),
      toddler_area = COALESCE(EXCLUDED.toddler_area, venues.toddler_area),
      baby_area    = COALESCE(EXCLUDED.baby_area, venues.baby_area),
      cafe         = COALESCE(EXCLUDED.cafe, venues.cafe),
      parking      = COALESCE(EXCLUDED.parking, venues.parking),
      parties      = COALESCE(EXCLUDED.parties, venues.parties),
      sen_friendly = COALESCE(EXCLUDED.sen_friendly, venues.sen_friendly),
      has_party_rooms = COALESCE(EXCLUDED.has_party_rooms, venues.has_party_rooms),
      has_multi_level_play = COALESCE(EXCLUDED.has_multi_level_play, venues.has_multi_level_play),
      has_role_play = COALESCE(EXCLUDED.has_role_play, venues.has_role_play),
      has_outdoor_play = COALESCE(EXCLUDED.has_outdoor_play, venues.has_outdoor_play),
      has_sen_sessions = COALESCE(EXCLUDED.has_sen_sessions, venues.has_sen_sessions),
      facilities   = COALESCE(EXCLUDED.facilities::jsonb, venues.facilities),
      updated_at   = CURRENT_TIMESTAMP,
      last_verified_at = CURRENT_TIMESTAMP`,
    [
      v.name, v.slug, v.citySlug, v.city, null, v.county, v.region,
      v.address, v.postcode, v.lat, v.lng,
      v.normCategory, v.status, v.googleMapsUrl, v.mapsUrlKey, v.dedupeKey,
      v.photoUrl, v.reviewSnippet, v.description, v.seoSummary, v.tags, v.rating, v.reviewCount,
      v.features.toddler_area, v.features.baby_area, v.features.cafe, v.features.parking,
      v.features.parties, v.features.sen_friendly,
      v.features.baby_area, // has_under_1s ≈ baby_area
      v.features.parties, v.features.has_multi_level_play, v.features.has_role_play,
      v.features.has_outdoor_play, v.features.sen_friendly,
      facilitiesJson(v),
    ]
  )
}

async function updateVenue(client, id, v) {
  await client.query(
    `UPDATE venues SET
      city         = COALESCE(NULLIF($2,''), city),
      county       = COALESCE(NULLIF($3,''), county),
      region       = COALESCE(NULLIF($4,''), region),
      address      = COALESCE(NULLIF($5,''), address),
      postcode     = COALESCE(NULLIF($6,''), postcode),
      lat          = COALESCE($7, lat),
      lng          = COALESCE($8, lng),
      category     = COALESCE(NULLIF($9,''), category),
      status       = COALESCE(NULLIF($10,''), status),
      google_maps_url = COALESCE(NULLIF($11,''), google_maps_url),
      maps_url_key = COALESCE(NULLIF($12,''), maps_url_key),
      dedupe_key   = COALESCE(NULLIF($13,''), dedupe_key),
      main_image_url = COALESCE(NULLIF($14,''), main_image_url),
      review_snippet = COALESCE(NULLIF($15,''), review_snippet),
      description  = COALESCE(NULLIF($16,''), description),
      seo_summary  = COALESCE(NULLIF($17,''), seo_summary),
      tags         = COALESCE($18, tags),
      rating       = COALESCE($19, rating),
      reviews_count = COALESCE($20, reviews_count),
      toddler_area = COALESCE($21, toddler_area),
      baby_area    = COALESCE($22, baby_area),
      cafe         = COALESCE($23, cafe),
      parking      = COALESCE($24, parking),
      parties      = COALESCE($25, parties),
      sen_friendly = COALESCE($26, sen_friendly),
      has_party_rooms = COALESCE($27, has_party_rooms),
      has_multi_level_play = COALESCE($28, has_multi_level_play),
      has_role_play = COALESCE($29, has_role_play),
      has_outdoor_play = COALESCE($30, has_outdoor_play),
      has_sen_sessions = COALESCE($31, has_sen_sessions),
      facilities   = COALESCE($32::jsonb, facilities),
      updated_at   = CURRENT_TIMESTAMP,
      last_verified_at = CURRENT_TIMESTAMP
    WHERE id = $1`,
    [
      id,
      v.city, v.county, v.region,
      v.address, v.postcode, v.lat, v.lng,
      v.normCategory, v.status, v.googleMapsUrl, v.mapsUrlKey, v.dedupeKey,
      v.photoUrl, v.reviewSnippet, v.description, v.seoSummary, v.tags, v.rating, v.reviewCount,
      v.features.toddler_area, v.features.baby_area, v.features.cafe, v.features.parking,
      v.features.parties, v.features.sen_friendly,
      v.features.parties, v.features.has_multi_level_play, v.features.has_role_play,
      v.features.has_outdoor_play, v.features.sen_friendly,
      facilitiesJson(v),
    ]
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  loadEnvLocal()

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required (.env.local is loaded automatically)')
    process.exit(1)
  }

  const citiesToProcess = args.city
    ? CITY_FILES.filter((c) => c.city.toLowerCase() === args.city.toLowerCase())
    : CITY_FILES

  if (!citiesToProcess.length) {
    console.error(`No matching city found for: ${args.city}`)
    process.exit(1)
  }

  // -------------------------------------------------------------------------
  // Parse all CSVs
  // -------------------------------------------------------------------------
  console.log('='.repeat(70))
  console.log('RAW CITY CSV IMPORT — PHASE 1: PARSE & ENRICH')
  console.log('='.repeat(70))
  console.log(args.commit ? 'MODE: COMMIT' : 'MODE: DRY RUN (add --commit to write to DB)')
  console.log()

  const allVenues = []
  const skipLog = []
  const seenMapsKeys = new Set()
  const seenDedupeKeys = new Set()

  for (const cityMeta of citiesToProcess) {
    const csvPath = path.join(CSV_FOLDER, cityMeta.file)
    if (!fs.existsSync(csvPath)) {
      console.warn(`  WARNING: file not found: ${csvPath}`)
      continue
    }

    const content = fs.readFileSync(csvPath, 'utf8')
    const rows = parseCSV(content)

    let cityInserts = 0, citySkips = 0

    for (const row of rows) {
      if (!extractName(row)) continue // blank row

      const venue = buildVenue(row, cityMeta)

      // Minimum threshold check
      const check = meetsThreshold(venue, args.includeAll)
      if (!check.ok) {
        skipLog.push({ city: cityMeta.city, name: venue.name, reason: check.reason })
        citySkips++
        continue
      }

      // Cross-CSV deduplication (within this parse run)
      const dupeByMaps = venue.mapsUrlKey && seenMapsKeys.has(venue.mapsUrlKey)
      const dupeByKey = seenDedupeKeys.has(venue.dedupeKey)
      if (dupeByMaps || dupeByKey) {
        skipLog.push({ city: cityMeta.city, name: venue.name, reason: 'duplicate_in_csv_set' })
        citySkips++
        continue
      }

      if (venue.mapsUrlKey) seenMapsKeys.add(venue.mapsUrlKey)
      seenDedupeKeys.add(venue.dedupeKey)

      allVenues.push(venue)
      cityInserts++
    }

    console.log(
      `  ${cityMeta.city.padEnd(12)} — ${cityInserts} venues queued, ${citySkips} skipped`
    )
  }

  console.log()
  console.log(`Total venues queued for import: ${allVenues.length}`)
  console.log(`Total skipped: ${skipLog.length}`)

  // Breakdown of skip reasons
  const skipReasons = {}
  for (const s of skipLog) {
    skipReasons[s.reason] = (skipReasons[s.reason] || 0) + 1
  }
  if (Object.keys(skipReasons).length) {
    console.log('Skip reasons:')
    for (const [r, c] of Object.entries(skipReasons)) console.log(`  ${r}: ${c}`)
  }

  // -------------------------------------------------------------------------
  // Feature summary
  // -------------------------------------------------------------------------
  const featureCounts = {}
  for (const v of allVenues) {
    for (const [f, val] of Object.entries(v.features)) {
      if (val) featureCounts[f] = (featureCounts[f] || 0) + 1
    }
  }
  console.log()
  console.log('Inferred features across all venues:')
  for (const [f, c] of Object.entries(featureCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${f.padEnd(22)} ${c}`)
  }

  const withPhotos = allVenues.filter((v) => v.photoUrl).length
  const withRatings = allVenues.filter((v) => v.rating).length
  const withDescriptions = allVenues.filter((v) => v.description).length
  console.log()
  console.log(`Venues with photo:        ${withPhotos} / ${allVenues.length}`)
  console.log(`Venues with rating:       ${withRatings} / ${allVenues.length}`)
  console.log(`Venues with description:  ${withDescriptions} / ${allVenues.length}`)

  if (!args.commit) {
    console.log()
    console.log('DRY RUN complete. Run with --commit to write to database.')
    console.log()
    // Print sample venue
    if (allVenues.length) {
      const sample = allVenues.find((v) => v.photoUrl && v.rating) || allVenues[0]
      console.log('Sample enriched venue:')
      console.log(`  Name:        ${sample.name}`)
      console.log(`  City:        ${sample.city}`)
      console.log(`  Category:    ${sample.normCategory}`)
      console.log(`  Rating:      ${sample.rating} (${sample.reviewCount} reviews)`)
      console.log(`  Address:     ${sample.address}`)
      console.log(`  Photo:       ${sample.photoUrl ? 'yes' : 'no'}`)
      console.log(`  Features:    ${Object.entries(sample.features).filter(([,v])=>v).map(([k])=>k).join(', ')}`)
      console.log(`  Tags:        ${sample.tags.join(', ')}`)
      console.log(`  Description: ${sample.description}`)
      console.log(`  SEO summary: ${sample.seoSummary}`)
    }
    return
  }

  // -------------------------------------------------------------------------
  // Database import
  // -------------------------------------------------------------------------
  console.log()
  console.log('='.repeat(70))
  console.log('PHASE 2: DATABASE IMPORT')
  console.log('='.repeat(70))

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  const client = await pool.connect()

  try {
    console.log('Ensuring schema columns exist...')
    await ensureColumns(client)
    console.log('Schema ready.')
    console.log()

    const dbColumns = await getColumns(client)

    let inserted = 0, updated = 0, errors = 0
    const citySummary = {}

    for (const venue of allVenues) {
      try {
        const existingId = await findExisting(client, venue)

        if (existingId) {
          await updateVenue(client, existingId, venue)
          updated++
          process.stdout.write('u')
        } else {
          await insertVenue(client, venue)
          inserted++
          process.stdout.write('+')
        }

        citySummary[venue.city] = citySummary[venue.city] || { inserted: 0, updated: 0 }
        if (existingId) citySummary[venue.city].updated++
        else citySummary[venue.city].inserted++
      } catch (err) {
        errors++
        process.stdout.write('!')
        console.error(`\n  ERROR [${venue.name} / ${venue.city}]: ${err.message}`)
      }
    }

    console.log()
    console.log()
    console.log('='.repeat(70))
    console.log('IMPORT SUMMARY')
    console.log('='.repeat(70))
    console.log(`  Inserted: ${inserted}`)
    console.log(`  Updated:  ${updated}`)
    console.log(`  Errors:   ${errors}`)
    console.log()
    console.log('By city:')
    for (const [city, counts] of Object.entries(citySummary)) {
      console.log(`  ${city.padEnd(14)} +${counts.inserted} new, ~${counts.updated} updated`)
    }

    // Total DB count
    const total = await client.query('SELECT COUNT(*) FROM venues')
    console.log()
    console.log(`Total venues in database: ${total.rows[0].count}`)

    // Write skip log to file
    if (skipLog.length) {
      const logPath = path.join(projectRoot, 'data', 'import-raw-skipped.json')
      fs.writeFileSync(logPath, JSON.stringify(skipLog, null, 2))
      console.log(`\nSkip log written to: data/import-raw-skipped.json`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Fatal:', err?.message || err)
  process.exit(1)
})
