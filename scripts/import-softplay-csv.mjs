import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

const DEFAULT_CSV = '/mnt/data/Master_Soft_Play_Directory_FuzzyDedup_FacilitiesBooleans_v2.csv'
const FALLBACK_CSV = path.join(
  '/Users/davidstark/Desktop/Stark Business/soft play near me (set up)/google maps scraped ',
  'Master_Soft_Play_Directory_FuzzyDedup_FacilitiesBooleans_v2.csv'
)

function parseArgs(argv) {
  const args = {
    commit: false,
    includeAuditFails: false,
    file: '',
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--commit') args.commit = true
    else if (arg === '--include-audit-fails') args.includeAuditFails = true
    else if (arg === '--file') args.file = argv[i + 1] || ''
  }

  return args
}

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

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim()
    })
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line) {
  const out = []
  let curr = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    const n = line[i + 1]

    if (inQuotes) {
      if (c === '"' && n === '"') {
        curr += '"'
        i++
      } else if (c === '"') {
        inQuotes = false
      } else {
        curr += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(curr)
      curr = ''
    } else {
      curr += c
    }
  }

  out.push(curr)
  return out
}

function normalizeText(input) {
  if (input == null) return ''
  let v = String(input).trim()
  v = v.replace(/^"+|"+$/g, '')
  v = v.replace(/\s+/g, ' ')
  return v
}

function parseBool(input) {
  const v = normalizeText(input).toLowerCase()
  if (!v) return null
  if (['true', '1', 'yes', 'y'].includes(v)) return true
  if (['false', '0', 'no', 'n'].includes(v)) return false
  return null
}

function normalizePhone(input) {
  const v = normalizeText(input)
  if (!v) return ''
  if (v.startsWith('+')) {
    return `+${v.slice(1).replace(/[^\d]/g, '')}`
  }
  return v.replace(/[^\d]/g, '')
}

function normalizeUrl(input) {
  const raw = normalizeText(input)
  if (!raw) return ''

  let candidate = raw
  if (!/^https?:\/\//i.test(candidate)) {
    if (candidate.startsWith('www.')) candidate = `https://${candidate}`
  }

  try {
    const u = new URL(candidate)
    u.hash = ''
    return u.toString()
  } catch {
    return raw
  }
}

function normalizeMapsKey(input) {
  const raw = normalizeUrl(input)
  if (!raw) return ''

  try {
    const u = new URL(raw)
    u.hash = ''
    u.search = ''
    return u.toString().replace(/\/+$/, '').toLowerCase()
  } catch {
    return raw.toLowerCase().replace(/\/+$/, '')
  }
}

function slugify(input) {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100)
}

function titleCase(input) {
  return normalizeText(input)
    .toLowerCase()
    .replace(/\b[a-z]/g, (m) => m.toUpperCase())
}

function extractPostcode(address) {
  if (!address) return ''
  const m = address.match(/([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i)
  return m ? m[1].toUpperCase().replace(/\s+/, ' ') : ''
}

function normalizePostcode(postcode, address) {
  const raw = normalizeText(postcode).toUpperCase()
  const fromAddress = extractPostcode(address)
  const candidate = raw || fromAddress
  if (!candidate) return ''
  const match = candidate.match(/([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})/i)
  if (!match) return ''
  const cleaned = match[1].toUpperCase().replace(/\s+/, ' ')
  return cleaned.length <= 10 ? cleaned : ''
}

function loadCityLookup() {
  const cityPath = path.join(projectRoot, 'data', 'cities.json')
  if (!fs.existsSync(cityPath)) return { byName: new Map(), names: [] }
  const cities = JSON.parse(fs.readFileSync(cityPath, 'utf8'))
  const byName = new Map()
  for (const city of cities) {
    byName.set(String(city.name).toLowerCase(), city)
  }
  const names = [...byName.keys()].sort((a, b) => b.length - a.length)
  return { byName, names }
}

function inferCity(rawCity, address, cityLookup) {
  const cleaned = normalizeText(rawCity)
  const normalized = titleCase(cleaned)
  const looksMalformed =
    !cleaned ||
    /,/.test(cleaned) ||
    /\.csv|\.json|\/|\\/.test(cleaned) ||
    cleaned.length > 40 ||
    /\b(and|&)\b/i.test(cleaned)

  if (!looksMalformed) return normalized

  const addressNorm = ` ${normalizeText(address).toLowerCase()} `
  for (const cityName of cityLookup.names) {
    const pattern = new RegExp(`\\b${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (pattern.test(addressNorm)) {
      return cityLookup.byName.get(cityName)?.name || titleCase(cityName)
    }
  }

  return normalized
}

function dedupeKey(name, address, city) {
  return `${normalizeText(name).toLowerCase()}|${normalizeText(address).toLowerCase()}|${normalizeText(city).toLowerCase()}`
}

async function ensureColumns(client) {
  const columnDefs = [
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
    ['has_under_1s', 'BOOLEAN DEFAULT false'],
    ['has_party_rooms', 'BOOLEAN DEFAULT false'],
    ['has_multi_level_play', 'BOOLEAN DEFAULT false'],
    ['has_role_play', 'BOOLEAN DEFAULT false'],
    ['has_outdoor_play', 'BOOLEAN DEFAULT false'],
    ['has_sen_sessions', 'BOOLEAN DEFAULT false'],
  ]

  for (const [name, type] of columnDefs) {
    await client.query(`ALTER TABLE venues ADD COLUMN IF NOT EXISTS ${name} ${type}`)
  }

  await client.query('CREATE INDEX IF NOT EXISTS idx_venues_maps_url_key ON venues(maps_url_key)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_venues_dedupe_key ON venues(dedupe_key)')
  await client.query('CREATE INDEX IF NOT EXISTS idx_venues_city ON venues(city)')
}

async function getVenueColumns(client) {
  const result = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'venues'
  `)
  return new Set(result.rows.map((r) => r.column_name))
}

async function findExistingVenue(client, payload, columns) {
  if (payload.mapsUrlKey && columns.has('maps_url_key')) {
    let result = await client.query('SELECT id FROM venues WHERE maps_url_key = $1 LIMIT 1', [payload.mapsUrlKey])
    if (result.rows.length) return result.rows[0].id

    if (columns.has('google_maps_url')) {
      result = await client.query(
        "SELECT id FROM venues WHERE lower(trim(coalesce(google_maps_url, ''))) = lower(trim($1)) LIMIT 1",
        [payload.googleMapsUrl]
      )
      if (result.rows.length) return result.rows[0].id
    }
  }

  if (payload.dedupeKey && columns.has('dedupe_key')) {
    let result = await client.query('SELECT id FROM venues WHERE dedupe_key = $1 LIMIT 1', [payload.dedupeKey])
    if (result.rows.length) return result.rows[0].id
  }

  const cityExpr = columns.has('city') ? "coalesce(city, city_slug, '')" : "coalesce(city_slug, '')"
  const fallback = await client.query(
    `SELECT id FROM venues
     WHERE lower(trim(name)) = lower(trim($1))
       AND lower(trim(coalesce(address, ''))) = lower(trim($2))
       AND lower(trim(${cityExpr})) = lower(trim($3))
     LIMIT 1`,
    [payload.name, payload.address, payload.city]
  )
  if (fallback.rows.length) return fallback.rows[0].id

  return null
}

function buildPayload(row, cityLookup) {
  const name = normalizeText(row.name)
  const address = normalizeText(row.address)
  const csvCity = normalizeText(row.City_or_Town)
  const inferredCity = inferCity(csvCity, address, cityLookup)
  const city = inferredCity || titleCase(csvCity)
  const citySlug = slugify(city) || slugify(csvCity) || 'unknown'
  const website = normalizeUrl(row.website)
  const googleMapsUrl = normalizeUrl(row.google_maps_url)

  const cityMeta = cityLookup.byName.get(city.toLowerCase())
  const county = cityMeta?.county || ''
  const region = cityMeta?.region || ''

  return {
    name,
    slug: slugify(`${name}-${city}`),
    citySlug,
    city,
    town: '',
    county,
    region,
    address,
    postcode: normalizePostcode(row.postcode, address),
    category: normalizeText(row.category),
    status: normalizeText(row.status),
    googleMapsUrl,
    mapsUrlKey: normalizeMapsKey(googleMapsUrl),
    phone: normalizePhone(row.phone),
    website,
    mainImageUrl: normalizeUrl(row.main_image_url),
    reviewSnippet: normalizeText(row.review_snippet),
    facilitiesListText: normalizeText(row.Facilities_List),
    dedupeKey: dedupeKey(name, address, city),
    booleans: {
      toddler_area: parseBool(row.has_toddler_area),
      baby_area: parseBool(row.has_baby_area),
      has_under_1s: parseBool(row.has_under_1s),
      cafe: parseBool(row.has_cafe),
      parking: parseBool(row.has_parking),
      parties: parseBool(row.has_party_rooms),
      has_party_rooms: parseBool(row.has_party_rooms),
      has_multi_level_play: parseBool(row.has_multi_level_play),
      has_role_play: parseBool(row.has_role_play),
      has_outdoor_play: parseBool(row.has_outdoor_play),
      sen_friendly: parseBool(row.has_sen_sessions),
      has_sen_sessions: parseBool(row.has_sen_sessions),
    },
  }
}

async function insertVenue(client, p) {
  await client.query(
    `INSERT INTO venues (
      name, slug, city_slug, city, town, county, region, address, postcode, phone, website,
      category, status, google_maps_url, maps_url_key, dedupe_key, main_image_url, review_snippet,
      facilities_list_text, toddler_area, baby_area, has_under_1s, cafe, parking, parties,
      has_party_rooms, has_multi_level_play, has_role_play, has_outdoor_play, sen_friendly, has_sen_sessions,
      facilities, created_at, updated_at, last_verified_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24, $25,
      $26, $27, $28, $29, $30, $31,
      $32, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )`,
    [
      p.name,
      p.slug,
      p.citySlug,
      p.city || null,
      p.town || null,
      p.county || null,
      p.region || null,
      p.address || null,
      p.postcode || null,
      p.phone || null,
      p.website || null,
      p.category || null,
      p.status || null,
      p.googleMapsUrl || null,
      p.mapsUrlKey || null,
      p.dedupeKey || null,
      p.mainImageUrl || null,
      p.reviewSnippet || null,
      p.facilitiesListText || null,
      p.booleans.toddler_area,
      p.booleans.baby_area,
      p.booleans.has_under_1s,
      p.booleans.cafe,
      p.booleans.parking,
      p.booleans.parties,
      p.booleans.has_party_rooms,
      p.booleans.has_multi_level_play,
      p.booleans.has_role_play,
      p.booleans.has_outdoor_play,
      p.booleans.sen_friendly,
      p.booleans.has_sen_sessions,
      JSON.stringify({
        toddler_area: p.booleans.toddler_area,
        baby_area: p.booleans.baby_area,
        under_1s: p.booleans.has_under_1s,
        cafe: p.booleans.cafe,
        parking: p.booleans.parking,
        party_rooms: p.booleans.has_party_rooms,
        multi_level_play: p.booleans.has_multi_level_play,
        role_play: p.booleans.has_role_play,
        outdoor_play: p.booleans.has_outdoor_play,
        sen_sessions: p.booleans.has_sen_sessions,
        facilities_list: p.facilitiesListText || '',
      }),
    ]
  )
}

async function updateVenue(client, id, p) {
  await client.query(
    `UPDATE venues SET
      name = COALESCE(NULLIF(name, ''), NULLIF($2, ''), name),
      city_slug = COALESCE(NULLIF(city_slug, ''), NULLIF($3, ''), city_slug),
      city = COALESCE(NULLIF(city, ''), NULLIF($4, ''), city),
      town = COALESCE(NULLIF(town, ''), NULLIF($5, ''), town),
      county = COALESCE(NULLIF(county, ''), NULLIF($6, ''), county),
      region = COALESCE(NULLIF(region, ''), NULLIF($7, ''), region),
      address = COALESCE(NULLIF(address, ''), NULLIF($8, ''), address),
      postcode = COALESCE(NULLIF(postcode, ''), NULLIF($9, ''), postcode),
      phone = COALESCE(NULLIF(phone, ''), NULLIF($10, ''), phone),
      website = COALESCE(NULLIF(website, ''), NULLIF($11, ''), website),
      category = COALESCE(NULLIF($12, ''), category),
      status = COALESCE(NULLIF($13, ''), status),
      google_maps_url = COALESCE(NULLIF($14, ''), google_maps_url),
      maps_url_key = COALESCE(NULLIF($15, ''), maps_url_key),
      dedupe_key = COALESCE(NULLIF($16, ''), dedupe_key),
      main_image_url = COALESCE(NULLIF($17, ''), main_image_url),
      review_snippet = COALESCE(NULLIF($18, ''), review_snippet),
      facilities_list_text = COALESCE(NULLIF($19, ''), facilities_list_text),
      toddler_area = COALESCE($20, toddler_area),
      baby_area = COALESCE($21, baby_area),
      has_under_1s = COALESCE($22, has_under_1s),
      cafe = COALESCE($23, cafe),
      parking = COALESCE($24, parking),
      parties = COALESCE($25, parties),
      has_party_rooms = COALESCE($26, has_party_rooms),
      has_multi_level_play = COALESCE($27, has_multi_level_play),
      has_role_play = COALESCE($28, has_role_play),
      has_outdoor_play = COALESCE($29, has_outdoor_play),
      sen_friendly = COALESCE($30, sen_friendly),
      has_sen_sessions = COALESCE($31, has_sen_sessions),
      facilities = COALESCE($32::jsonb, facilities),
      updated_at = CURRENT_TIMESTAMP,
      last_verified_at = CURRENT_TIMESTAMP
    WHERE id = $1`,
    [
      id,
      p.name,
      p.citySlug,
      p.city,
      p.town,
      p.county,
      p.region,
      p.address,
      p.postcode,
      p.phone,
      p.website,
      p.category,
      p.status,
      p.googleMapsUrl,
      p.mapsUrlKey,
      p.dedupeKey,
      p.mainImageUrl,
      p.reviewSnippet,
      p.facilitiesListText,
      p.booleans.toddler_area,
      p.booleans.baby_area,
      p.booleans.has_under_1s,
      p.booleans.cafe,
      p.booleans.parking,
      p.booleans.parties,
      p.booleans.has_party_rooms,
      p.booleans.has_multi_level_play,
      p.booleans.has_role_play,
      p.booleans.has_outdoor_play,
      p.booleans.sen_friendly,
      p.booleans.has_sen_sessions,
      JSON.stringify({
        toddler_area: p.booleans.toddler_area,
        baby_area: p.booleans.baby_area,
        under_1s: p.booleans.has_under_1s,
        cafe: p.booleans.cafe,
        parking: p.booleans.parking,
        party_rooms: p.booleans.has_party_rooms,
        multi_level_play: p.booleans.has_multi_level_play,
        role_play: p.booleans.has_role_play,
        outdoor_play: p.booleans.has_outdoor_play,
        sen_sessions: p.booleans.has_sen_sessions,
        facilities_list: p.facilitiesListText || '',
      }),
    ]
  )
}

function resolveCsvPath(providedPath) {
  const candidate = providedPath || DEFAULT_CSV
  if (fs.existsSync(candidate)) return candidate
  if (!providedPath && fs.existsSync(FALLBACK_CSV)) return FALLBACK_CSV
  return candidate
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  loadEnvLocal()

  const csvPath = resolveCsvPath(args.file)
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`)
    console.error('Provide a path with --file /path/to/file.csv')
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required (.env.local is loaded automatically if present).')
    process.exit(1)
  }

  const csv = fs.readFileSync(csvPath, 'utf8')
  const rows = parseCSV(csv)
  const cityLookup = loadCityLookup()

  const summary = {
    total: rows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    skippedReasons: {},
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  const client = await pool.connect()

  try {
    if (args.commit) {
      await ensureColumns(client)
    }
    const columns = await getVenueColumns(client)

    for (const row of rows) {
      const suspicious = parseBool(row.audit_suspicious_word) === true
      const notPlay = parseBool(row.audit_category_not_play) === true
      const name = normalizeText(row.name)
      const googleMaps = normalizeText(row.google_maps_url)

      let skipReason = ''
      if (!name && !googleMaps) skipReason = 'missing_name_and_maps_url'
      else if (!args.includeAuditFails && suspicious) skipReason = 'audit_suspicious_word'
      else if (!args.includeAuditFails && notPlay) skipReason = 'audit_category_not_play'

      if (skipReason) {
        summary.skipped++
        summary.skippedReasons[skipReason] = (summary.skippedReasons[skipReason] || 0) + 1
        continue
      }

      const payload = buildPayload(row, cityLookup)
      const existingId = await findExistingVenue(client, payload, columns)

      if (!args.commit) {
        if (existingId) summary.updated++
        else summary.inserted++
        continue
      }

      if (existingId) {
        await updateVenue(client, existingId, payload)
        summary.updated++
      } else {
        await insertVenue(client, payload)
        summary.inserted++
      }
    }
  } finally {
    client.release()
    await pool.end()
  }

  console.log('='.repeat(60))
  console.log(args.commit ? 'CSV IMPORT (COMMIT)' : 'CSV IMPORT (DRY RUN)')
  console.log('='.repeat(60))
  console.log(`File: ${csvPath}`)
  console.log(`Rows read: ${summary.total}`)
  console.log(`Inserted: ${summary.inserted}`)
  console.log(`Updated: ${summary.updated}`)
  console.log(`Skipped: ${summary.skipped}`)
  console.log('Skipped reasons:')
  for (const [reason, count] of Object.entries(summary.skippedReasons)) {
    console.log(`  - ${reason}: ${count}`)
  }
}

main().catch((err) => {
  console.error('Import failed:', err?.message || err)
  process.exit(1)
})
