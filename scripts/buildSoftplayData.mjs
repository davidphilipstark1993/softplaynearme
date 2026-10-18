#!/usr/bin/env node

/**
 * Build script to convert CSV soft play data to static JSON files
 *
 * Usage: node scripts/buildSoftplayData.mjs
 *
 * Input:  data/softplay_master_populated.csv
 * Output: data/generated/venues.json
 *         data/generated/towns.json
 *         data/generated/venuesByTown.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { stripTrailingCity } from './lib/venue-slug.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

// Paths
const CSV_PATH = path.join(ROOT_DIR, 'data', 'softplay_master_populated.csv')
const OUTPUT_DIR = path.join(ROOT_DIR, 'data', 'generated')

/**
 * Create URL-safe slug from text
 */
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

/**
 * Ensure slug is unique within a collection
 */
function ensureUniqueSlug(slug, existingSlugs) {
  let uniqueSlug = slug
  let counter = 1
  while (existingSlugs.has(uniqueSlug)) {
    uniqueSlug = `${slug}-${counter}`
    counter++
  }
  existingSlugs.add(uniqueSlug)
  return uniqueSlug
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Parse CSV file to array of objects
 */
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  const headers = parseCSVLine(lines[0])
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row = {}
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] || ''
    })
    data.push(row)
  }

  return data
}

/**
 * Transform CSV row to venue object
 */
function transformVenue(row, townSlug, venueSlugSet) {
  const name = row['Venue Name'] || ''
  if (!name) return null

  // The city is already in the URL path, so it is not repeated in the slug.
  const baseSlug = stripTrailingCity(slugify(name), townSlug)
  const slug = ensureUniqueSlug(baseSlug, venueSlugSet)

  return {
    town: row['Town'] || '',
    townSlug,
    name,
    slug,
    address: row['Full Address'] || '',
    postcode: extractPostcode(row['Full Address'] || ''),
    phone: row['Phone Number'] || '',
    website: row['Website URL'] || '',
    mapsUrl: row['Google Maps URL'] || '',
    category: row['Category'] || 'Soft Play',
    notes: row['Notes'] || '',
    lastVerified: row['Last Verified Date'] || ''
  }
}

/**
 * Extract postcode from address string
 */
function extractPostcode(address) {
  // UK postcode regex
  const postcodeRegex = /([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})/i
  const match = address.match(postcodeRegex)
  return match ? match[1].toUpperCase() : ''
}

/**
 * Main build function
 */
async function build() {
  console.log('Building soft play data from CSV...\n')

  // Check if CSV exists
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: CSV file not found at ${CSV_PATH}`)
    console.log('\nPlease create the CSV file with the following columns:')
    console.log('Town,Venue Name,Full Address,Phone Number,Website URL,Google Maps URL,Category,Notes,Last Verified Date')
    process.exit(1)
  }

  // Read and parse CSV
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8')
  const rawData = parseCSV(csvContent)
  console.log(`Parsed ${rawData.length} rows from CSV`)

  // Group venues by town
  const venuesByTown = {}
  const townSlugs = new Map() // town name -> slug
  const allVenues = []

  for (const row of rawData) {
    const townName = (row['Town'] || '').trim()
    if (!townName) continue

    // Get or create town slug
    if (!townSlugs.has(townName)) {
      townSlugs.set(townName, slugify(townName))
    }
    const townSlug = townSlugs.get(townName)

    // Initialize town venue list and slug set
    if (!venuesByTown[townSlug]) {
      venuesByTown[townSlug] = {
        town: townName,
        townSlug,
        venues: [],
        _slugSet: new Set()
      }
    }

    // Transform venue
    const venue = transformVenue(row, townSlug, venuesByTown[townSlug]._slugSet)
    if (venue) {
      venuesByTown[townSlug].venues.push(venue)
      allVenues.push(venue)
    }
  }

  // Build towns list
  const towns = Object.values(venuesByTown).map(({ town, townSlug, venues }) => ({
    name: town,
    slug: townSlug,
    venueCount: venues.length
  })).sort((a, b) => a.name.localeCompare(b.name))

  // Clean up internal slug sets from venuesByTown
  const cleanVenuesByTown = {}
  for (const [slug, data] of Object.entries(venuesByTown)) {
    cleanVenuesByTown[slug] = {
      town: data.town,
      townSlug: data.townSlug,
      venues: data.venues.sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Write venues.json
  const venuesPath = path.join(OUTPUT_DIR, 'venues.json')
  fs.writeFileSync(venuesPath, JSON.stringify(allVenues, null, 2))
  console.log(`\nWrote ${allVenues.length} venues to ${venuesPath}`)

  // Write towns.json
  const townsPath = path.join(OUTPUT_DIR, 'towns.json')
  fs.writeFileSync(townsPath, JSON.stringify(towns, null, 2))
  console.log(`Wrote ${towns.length} towns to ${townsPath}`)

  // Write venuesByTown.json
  const venuesByTownPath = path.join(OUTPUT_DIR, 'venuesByTown.json')
  fs.writeFileSync(venuesByTownPath, JSON.stringify(cleanVenuesByTown, null, 2))
  console.log(`Wrote venuesByTown data to ${venuesByTownPath}`)

  // Summary
  console.log('\n--- Summary ---')
  towns.forEach(t => {
    console.log(`  ${t.name}: ${t.venueCount} venues`)
  })
  console.log(`\nTotal: ${allVenues.length} venues across ${towns.length} towns`)
  console.log('\nBuild complete!')
}

// Run
build().catch(err => {
  console.error('Build failed:', err)
  process.exit(1)
})
