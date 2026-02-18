#!/usr/bin/env node

/**
 * Import soft play venues from the South Batch CSV into PostgreSQL + static data
 *
 * Usage:
 *   node scripts/import-softplay-csv.mjs                          # dry run
 *   node scripts/import-softplay-csv.mjs --commit                 # write to DB
 *   node scripts/import-softplay-csv.mjs --commit --include-suspect  # include audit-flagged rows
 *
 * Input: CSV with columns: name, address, postcode, City_or_Town, category,
 *        google_maps_url, phone, email, website, main_image_url, review_snippet,
 *        status, Facilities_List, has_toddler_area, has_baby_area, has_under_1s,
 *        has_cafe, has_parking, has_party_rooms, has_multi_level_play, has_role_play,
 *        has_outdoor_play, has_sen_sessions, audit_suspicious_word,
 *        audit_category_not_play, ...
 *
 * Upsert key:
 *   Primary:  google_maps_url (if present)
 *   Fallback: normalized(name + address + city)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Configuration ──────────────────────────────────────────────────────
const CSV_PATH = path.join(
  '/Users/davidstark/Desktop/Stark Business/soft play near me (set up)/google maps scraped ',
  'Master_Soft_Play_Directory_FuzzyDedup_FacilitiesBooleans_SouthBatch.csv'
)

const MASTER_CSV_PATH = path.join(__dirname, '..', 'data', 'softplay_master_populated.csv')

const COMMIT = process.argv.includes('--commit')
const INCLUDE_SUSPECT = process.argv.includes('--include-suspect')

// ── City name normalisation ────────────────────────────────────────────
const CITY_CORRECTIONS = {
  bournmouth: 'Bournemouth',
  colchester: 'Colchester',
  norwich: 'Norwich',
  southend: 'Southend',
  swansea: 'Swansea',
}

function normaliseCity(raw) {
  const trimmed = (raw || '').trim()
  const lower = trimmed.toLowerCase()
  if (CITY_CORRECTIONS[lower]) return CITY_CORRECTIONS[lower]
  // Title-case if all-lowercase
  if (trimmed === lower) {
    return trimmed.replace(/\b\w/g, c => c.toUpperCase())
  }
  return trimmed
}

// ── Slug helpers ───────────────────────────────────────────────────────
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
    .substring(0, 100)
}

function generateSlug(name) {
  return slugify(name)
}

function citySlug(city) {
  return slugify(city)
}

// ── CSV parsing (handles quoted fields) ────────────────────────────────
function parseCSVLine(line) {
  const values = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    const next = line[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') { current += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { current += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { values.push(current); current = '' }
      else { current += ch }
    }
  }
  values.push(current)
  return values
}

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length === 0) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i])
    if (vals.length !== headers.length) continue
    const row = {}
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim() })
    rows.push(row)
  }
  return rows
}

// ── Extract lat/lng from Google Maps URL ───────────────────────────────
function extractLatLng(url) {
  if (!url) return { lat: null, lng: null }
  const m = url.match(/!3d([\d.-]+)!4d([\d.-]+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return { lat: null, lng: null }
}

// ── Extract postcode from address ──────────────────────────────────────
function extractPostcode(address) {
  const m = (address || '').match(/([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i)
  return m ? m[1].toUpperCase() : ''
}

// ── Normalise URL ──────────────────────────────────────────────────────
function normaliseUrl(url) {
  if (!url) return ''
  let u = url.trim()
  if (u && !u.startsWith('http')) u = 'https://' + u
  return u
}

// ── Boolean from CSV string ────────────────────────────────────────────
function csvBool(val) {
  return (val || '').toLowerCase() === 'true'
}

// ── Normalise key for fallback dedup ───────────────────────────────────
function dedupeKey(name, address, city) {
  return `${(name || '').toLowerCase().trim()}|${(address || '').toLowerCase().trim()}|${(city || '').toLowerCase().trim()}`
}

// ── Clean address (remove "Closed, · Opens ..." suffixes) ──────────────
function cleanAddress(raw) {
  if (!raw) return ''
  return raw
    .replace(/,?\s*(Closed|Open|Closes soon|Opens? \d.*)$/i, '')
    .replace(/,?\s*· .*$/i, '')
    .trim()
    .replace(/,\s*$/, '')
}

// ── Ensure DB columns exist ────────────────────────────────────────────
async function ensureColumns(client) {
  const columnsToAdd = [
    { name: 'place_id', type: 'VARCHAR(255) UNIQUE' },
    { name: 'google_maps_url', type: 'VARCHAR(500)' },
    { name: 'opening_hours_text', type: 'TEXT' },
    { name: 'open_now', type: 'BOOLEAN' },
    { name: 'types', type: 'TEXT' },
    { name: 'reviews_count', type: 'INTEGER' },
    { name: 'review_snippet', type: 'TEXT' },
    { name: 'main_image_url', type: 'VARCHAR(500)' },
    { name: 'facilities_list', type: 'TEXT' },
    { name: 'multi_level_play', type: 'BOOLEAN DEFAULT false' },
    { name: 'role_play', type: 'BOOLEAN DEFAULT false' },
    { name: 'outdoor_play', type: 'BOOLEAN DEFAULT false' },
    { name: 'under_1s', type: 'BOOLEAN DEFAULT false' },
    { name: 'rating', type: 'DECIMAL(3,2)' },
  ]

  for (const col of columnsToAdd) {
    const exists = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'venues' AND column_name = $1`,
      [col.name]
    )
    if (exists.rows.length === 0) {
      console.log(`  Adding column: ${col.name}`)
      await client.query(`ALTER TABLE venues ADD COLUMN ${col.name} ${col.type}`)
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  SOFT PLAY CSV IMPORT — ${COMMIT ? 'COMMIT MODE' : 'DRY RUN'}`)
  console.log(`${'='.repeat(60)}\n`)

  // 1. Read CSV
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`)
    process.exit(1)
  }
  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'))
  console.log(`Read ${rows.length} rows from CSV\n`)

  // 2. Filter
  const skipped = { suspicious: 0, notPlay: 0, noName: 0 }
  const valid = []

  for (const row of rows) {
    if (!row.name) { skipped.noName++; continue }
    if (!INCLUDE_SUSPECT) {
      if (csvBool(row.audit_suspicious_word)) { skipped.suspicious++; continue }
      if (csvBool(row.audit_category_not_play)) { skipped.notPlay++; continue }
    }
    valid.push(row)
  }

  console.log(`Rows after filtering: ${valid.length}`)
  if (skipped.noName) console.log(`  Skipped (no name): ${skipped.noName}`)
  if (skipped.suspicious) console.log(`  Skipped (suspicious): ${skipped.suspicious}`)
  if (skipped.notPlay) console.log(`  Skipped (not play): ${skipped.notPlay}`)
  console.log()

  // 3. Transform rows
  const venues = valid.map(row => {
    const city = normaliseCity(row.City_or_Town)
    const cs = citySlug(city)
    const address = cleanAddress(row.address)
    const postcode = row.postcode || extractPostcode(address)
    const { lat, lng } = extractLatLng(row.google_maps_url)
    const slug = generateSlug(row.name)

    return {
      name: row.name.trim(),
      slug,
      city_slug: cs,
      city_name: city,
      address,
      postcode,
      lat,
      lng,
      phone: (row.phone || '').trim(),
      website: normaliseUrl(row.website),
      google_maps_url: (row.google_maps_url || '').trim(),
      category: (row.category || '').trim(),
      main_image_url: (row.main_image_url || '').trim(),
      review_snippet: (row.review_snippet || '').trim(),
      facilities_list: (row.Facilities_List || '').trim(),
      // Facility booleans
      toddler_area: csvBool(row.has_toddler_area),
      baby_area: csvBool(row.has_baby_area),
      under_1s: csvBool(row.has_under_1s),
      cafe: csvBool(row.has_cafe),
      parking: csvBool(row.has_parking),
      parties: csvBool(row.has_party_rooms),
      multi_level_play: csvBool(row.has_multi_level_play),
      role_play: csvBool(row.has_role_play),
      outdoor_play: csvBool(row.has_outdoor_play),
      sen_friendly: csvBool(row.has_sen_sessions),
      // Dedup key
      _dedupeKey: dedupeKey(row.name, address, city),
    }
  })

  // 4. Deduplicate within the CSV itself (by google_maps_url then fallback key)
  const seenUrls = new Map()
  const seenKeys = new Map()
  const deduped = []
  let csvDupes = 0

  for (const v of venues) {
    if (v.google_maps_url) {
      if (seenUrls.has(v.google_maps_url)) { csvDupes++; continue }
      seenUrls.set(v.google_maps_url, true)
    } else {
      if (seenKeys.has(v._dedupeKey)) { csvDupes++; continue }
      seenKeys.set(v._dedupeKey, true)
    }
    deduped.push(v)
  }

  if (csvDupes) console.log(`Removed ${csvDupes} duplicates within CSV`)
  console.log(`Venues to process: ${deduped.length}\n`)

  // 5. Ensure unique slugs per city
  const slugsByCity = {}
  for (const v of deduped) {
    if (!slugsByCity[v.city_slug]) slugsByCity[v.city_slug] = new Set()
    let s = v.slug
    let counter = 1
    while (slugsByCity[v.city_slug].has(s)) {
      s = `${v.slug}-${counter}`
      counter++
    }
    slugsByCity[v.city_slug].add(s)
    v.slug = s
  }

  // 6. Connect to DB (if committing)
  let pool, client
  if (COMMIT) {
    if (!process.env.DATABASE_URL) {
      console.error('ERROR: DATABASE_URL required for --commit mode')
      process.exit(1)
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    client = await pool.connect()
    console.log('Connected to database')
    await ensureColumns(client)
    console.log()
  }

  // 7. Upsert
  let inserted = 0, updated = 0, errors = 0
  const byCity = {}

  for (const v of deduped) {
    byCity[v.city_name] = (byCity[v.city_name] || 0) + 1

    if (!COMMIT) {
      // Dry run — just log
      console.log(`  [DRY] ${v.city_name} / ${v.name} (${v.slug})`)
      inserted++
      continue
    }

    try {
      // Check if venue already exists by google_maps_url
      let existing = null
      if (v.google_maps_url) {
        const res = await client.query(
          'SELECT id FROM venues WHERE google_maps_url = $1', [v.google_maps_url]
        )
        if (res.rows.length > 0) existing = res.rows[0]
      }

      // Fallback: check by city_slug + slug
      if (!existing) {
        const res = await client.query(
          'SELECT id FROM venues WHERE city_slug = $1 AND slug = $2', [v.city_slug, v.slug]
        )
        if (res.rows.length > 0) existing = res.rows[0]
      }

      if (existing) {
        // Update existing venue — refresh facilities + fill missing fields
        await client.query(`
          UPDATE venues SET
            address = COALESCE(NULLIF($2, ''), address),
            postcode = COALESCE(NULLIF($3, ''), postcode),
            lat = COALESCE($4, lat),
            lng = COALESCE($5, lng),
            phone = COALESCE(NULLIF($6, ''), phone),
            website = COALESCE(NULLIF($7, ''), website),
            google_maps_url = COALESCE(NULLIF($8, ''), google_maps_url),
            main_image_url = COALESCE(NULLIF($9, ''), main_image_url),
            review_snippet = COALESCE(NULLIF($10, ''), review_snippet),
            facilities_list = COALESCE(NULLIF($11, ''), facilities_list),
            toddler_area = $12,
            baby_area = $13,
            under_1s = $14,
            cafe = $15,
            parking = $16,
            parties = $17,
            multi_level_play = $18,
            role_play = $19,
            outdoor_play = $20,
            sen_friendly = $21,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [
          existing.id,
          v.address, v.postcode, v.lat, v.lng,
          v.phone, v.website, v.google_maps_url,
          v.main_image_url, v.review_snippet, v.facilities_list,
          v.toddler_area, v.baby_area, v.under_1s,
          v.cafe, v.parking, v.parties,
          v.multi_level_play, v.role_play, v.outdoor_play, v.sen_friendly,
        ])
        console.log(`  [UPD] ${v.city_name} / ${v.name}`)
        updated++
      } else {
        // Insert new venue
        await client.query(`
          INSERT INTO venues (
            name, slug, city_slug, address, postcode, lat, lng,
            phone, website, google_maps_url,
            main_image_url, review_snippet, facilities_list,
            toddler_area, baby_area, under_1s, cafe, parking, parties,
            multi_level_play, role_play, outdoor_play, sen_friendly,
            created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
            $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `, [
          v.name, v.slug, v.city_slug, v.address, v.postcode, v.lat, v.lng,
          v.phone, v.website, v.google_maps_url,
          v.main_image_url, v.review_snippet, v.facilities_list,
          v.toddler_area, v.baby_area, v.under_1s,
          v.cafe, v.parking, v.parties,
          v.multi_level_play, v.role_play, v.outdoor_play, v.sen_friendly,
        ])
        console.log(`  [NEW] ${v.city_name} / ${v.name}`)
        inserted++
      }
    } catch (err) {
      console.error(`  [ERR] ${v.city_name} / ${v.name}: ${err.message}`)
      errors++
    }
  }

  // 8. Also append to master CSV for static data pipeline
  if (COMMIT) {
    console.log('\nAppending to master CSV for static data...')
    const masterLines = []
    for (const v of deduped) {
      // Escape fields for CSV
      const esc = s => `"${(s || '').replace(/"/g, '""')}"`
      masterLines.push([
        esc(v.city_name),       // Town
        esc(v.name),            // Venue Name
        esc(v.category),        // Category
        esc(v.address),         // Full Address
        esc(v.phone),           // Phone Number
        esc(v.website),         // Website URL
        esc(v.google_maps_url), // Google Maps URL
        esc(v.facilities_list), // Notes
        esc(new Date().toISOString().split('T')[0]), // Last Verified Date
      ].join(','))
    }

    // Append (skip header if file already exists)
    if (fs.existsSync(MASTER_CSV_PATH)) {
      fs.appendFileSync(MASTER_CSV_PATH, '\n' + masterLines.join('\n'))
    } else {
      const header = 'Town,Venue Name,Category,Full Address,Phone Number,Website URL,Google Maps URL,Notes,Last Verified Date'
      fs.writeFileSync(MASTER_CSV_PATH, header + '\n' + masterLines.join('\n'))
    }
    console.log(`  Appended ${masterLines.length} rows to ${MASTER_CSV_PATH}`)
  }

  // 9. Summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('  IMPORT SUMMARY')
  console.log(`${'='.repeat(60)}`)
  console.log(`  Total CSV rows:    ${rows.length}`)
  console.log(`  Skipped (audit):   ${skipped.suspicious + skipped.notPlay}`)
  console.log(`  Skipped (no name): ${skipped.noName}`)
  console.log(`  CSV duplicates:    ${csvDupes}`)
  console.log(`  Processed:         ${deduped.length}`)
  console.log()
  if (COMMIT) {
    console.log(`  Inserted: ${inserted}`)
    console.log(`  Updated:  ${updated}`)
    if (errors) console.log(`  Errors:   ${errors}`)
  } else {
    console.log(`  Would insert/update: ${inserted}`)
    console.log(`\n  (DRY RUN — use --commit to write changes)`)
  }
  console.log()
  console.log('  By city:')
  for (const [city, count] of Object.entries(byCity).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${city}: ${count}`)
  }
  console.log()

  // 10. Show next steps
  if (COMMIT) {
    console.log('  Next: rebuild static data with:')
    console.log('    npm run data:build\n')

    // DB venue count
    const countRes = await client.query('SELECT city_slug, COUNT(*) as c FROM venues GROUP BY city_slug ORDER BY c DESC')
    console.log('  DB venue counts by city:')
    for (const r of countRes.rows) {
      console.log(`    ${r.city_slug}: ${r.c}`)
    }
    console.log()
  }

  // Cleanup
  if (client) client.release()
  if (pool) await pool.end()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
