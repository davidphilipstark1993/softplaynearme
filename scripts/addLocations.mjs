#!/usr/bin/env node
/**
 * Bulk-add location pages to Soft Play Near Me
 *
 * Usage:
 *   node scripts/addLocations.mjs --csv data/new-locations.csv
 *   node scripts/addLocations.mjs --csv data/new-locations.csv --dry-run
 *
 * CSV format (header row required):
 *   name,county,nearbyAreas
 *   Manchester,Greater Manchester,"Salford,Stockport,Oldham"
 *
 * - slug is auto-generated from name (lowercase, spaces → hyphens)
 * - region is auto-resolved from county via REGIONS lookup
 * - SEO content (intro, FAQs, meta) is generated at render time by lib/locationContent.ts
 * - Duplicates (matching slug) are skipped
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CITIES_PATH = resolve(__dirname, '..', 'data', 'cities.json')

// Inline region lookup (mirrors lib/venues.ts REGIONS)
const REGIONS = [
  { region: 'Yorkshire', counties: ['East Yorkshire', 'North Yorkshire', 'West Yorkshire', 'South Yorkshire'] },
  { region: 'North East', counties: ['County Durham', 'Northumberland', 'Tyne and Wear'] },
  { region: 'North West', counties: ['Greater Manchester', 'Merseyside', 'Lancashire', 'Cheshire', 'Cumbria'] },
  { region: 'East Midlands', counties: ['Derbyshire', 'Nottinghamshire', 'Leicestershire', 'Lincolnshire', 'Northamptonshire'] },
  { region: 'West Midlands', counties: ['West Midlands', 'Staffordshire', 'Warwickshire', 'Worcestershire', 'Shropshire'] },
  { region: 'South East', counties: ['Kent', 'Surrey', 'Sussex', 'Hampshire', 'Berkshire', 'Oxfordshire', 'Buckinghamshire'] },
  { region: 'South West', counties: ['Devon', 'Cornwall', 'Somerset', 'Dorset', 'Gloucestershire', 'Wiltshire', 'Bristol'] },
  { region: 'East of England', counties: ['Norfolk', 'Suffolk', 'Essex', 'Cambridgeshire', 'Hertfordshire', 'Bedfordshire'] },
  { region: 'London', counties: ['Greater London'] },
]

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getRegion(county) {
  return REGIONS.find(r => r.counties.includes(county))?.region || undefined
}

function parseCSV(text) {
  const lines = text.trim().split('\n')
  const header = lines[0].split(',').map(h => h.trim().toLowerCase())

  const nameIdx = header.indexOf('name')
  const countyIdx = header.indexOf('county')
  const nearbyIdx = header.indexOf('nearbyareas')

  if (nameIdx === -1 || countyIdx === -1) {
    console.error('CSV must have "name" and "county" columns')
    process.exit(1)
  }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Simple CSV parse handling quoted fields
    const fields = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue }
      current += char
    }
    fields.push(current.trim())

    const name = fields[nameIdx]
    const county = fields[countyIdx]
    const nearbyAreas = nearbyIdx !== -1 && fields[nearbyIdx]
      ? fields[nearbyIdx].split(',').map(a => a.trim()).filter(Boolean)
      : []

    if (!name || !county) continue
    rows.push({ name, county, nearbyAreas })
  }

  return rows
}

// --- Main ---
const args = process.argv.slice(2)
const csvFlagIdx = args.indexOf('--csv')
const dryRun = args.includes('--dry-run')

if (csvFlagIdx === -1 || !args[csvFlagIdx + 1]) {
  console.log('Usage: node scripts/addLocations.mjs --csv <path> [--dry-run]')
  process.exit(1)
}

const csvPath = resolve(args[csvFlagIdx + 1])
const csvText = readFileSync(csvPath, 'utf-8')
const rows = parseCSV(csvText)

if (rows.length === 0) {
  console.log('No valid rows found in CSV.')
  process.exit(0)
}

const existing = JSON.parse(readFileSync(CITIES_PATH, 'utf-8'))
const existingSlugs = new Set(existing.map(c => c.slug))

let added = 0
let skipped = 0

for (const row of rows) {
  const slug = slugify(row.name)

  if (existingSlugs.has(slug)) {
    console.log(`  SKIP  ${row.name} (${slug}) — already exists`)
    skipped++
    continue
  }

  const region = getRegion(row.county)

  const entry = {
    slug,
    name: row.name,
    county: row.county,
    ...(region && { region }),
    metaTitle: `Soft Play in ${row.name}`,
    metaDescription: `Find soft play centres in ${row.name}, ${row.county}. Compare indoor play venues, check opening times, and find activities for kids of all ages.`,
    h1: `Soft Play Centres in ${row.name}`,
    intro: `Looking for indoor play in ${row.name}? Browse our guide to soft play centres in the area.`,
    nearbyAreas: row.nearbyAreas,
    faqs: [],
  }

  if (dryRun) {
    console.log(`  ADD   ${row.name} (${slug}) — ${row.county}${region ? `, ${region}` : ''}`)
    console.log(`        nearby: ${row.nearbyAreas.join(', ') || '(none)'}`)
  } else {
    existing.push(entry)
    existingSlugs.add(slug)
  }

  added++
}

if (!dryRun && added > 0) {
  writeFileSync(CITIES_PATH, JSON.stringify(existing, null, 2) + '\n')
}

console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done: ${added} added, ${skipped} skipped`)
if (dryRun && added > 0) {
  console.log('Run again without --dry-run to apply changes.')
}
