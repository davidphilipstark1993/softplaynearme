#!/usr/bin/env node

/**
 * Import Sheffield soft play data from Google Maps scraped CSV
 * into the master CSV format.
 *
 * Usage: node scripts/importSheffieldData.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

const INPUT_CSV = '/Users/davidstark/Desktop/Stark Business/soft play near me (set up)/google maps scraped /soft play sheffield .csv'
const MASTER_CSV = path.join(ROOT_DIR, 'data', 'softplay_master_populated.csv')

const TODAY = new Date().toISOString().split('T')[0] // e.g. 2026-02-11

/**
 * Parse a CSV line handling quoted fields (with escaped quotes)
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
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

/**
 * Escape a field for CSV output (quote if it contains commas, quotes, or newlines)
 */
function csvEscape(value) {
  if (!value) return ''
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function run() {
  // Read scraped CSV
  const raw = fs.readFileSync(INPUT_CSV, 'utf-8')
  const lines = raw.split('\n')

  // Parse header
  const headers = parseCSVLine(lines[0])
  console.log('Scraped CSV headers:', headers.map((h, i) => `[${i}] ${h}`).join(', '))

  // Map header names to indices
  const colIndex = {}
  headers.forEach((h, i) => { colIndex[h.trim()] = i })

  const iURL = colIndex['hfpxzc href']
  const iName = colIndex['qBF1Pd']
  const iCategory = colIndex['W4Efsd']
  const iDoJOZc = colIndex['doJOZc']
  const iW4Efsd3 = colIndex['W4Efsd 3']
  const iW4Efsd4 = colIndex['W4Efsd 4']

  const venues = []
  const seenNames = new Set()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cols = parseCSVLine(line)

    const name = (cols[iName] || '').trim()
    if (!name) continue

    // Skip duplicates by name
    if (seenNames.has(name.toLowerCase())) {
      console.log(`  Skipping duplicate: ${name}`)
      continue
    }
    seenNames.add(name.toLowerCase())

    const category = (cols[iCategory] || '').trim()
    const mapsUrl = (cols[iURL] || '').trim()

    // Address: prefer W4Efsd 4, fall back to W4Efsd 3 (if not "·"), then doJOZc
    let address = (cols[iW4Efsd4] || '').trim()
    if (!address || address === '·') {
      const w3 = (cols[iW4Efsd3] || '').trim()
      if (w3 && w3 !== '·') {
        address = w3
      } else {
        address = (cols[iDoJOZc] || '').trim()
      }
    }

    venues.push({
      town: 'Sheffield',
      name,
      category,
      address,
      phone: '',
      website: '',
      mapsUrl,
      notes: '',
      lastVerified: TODAY
    })
  }

  console.log(`\nParsed ${venues.length} venues from scraped CSV`)

  // Build CSV lines to append
  const csvLines = venues.map(v =>
    [
      csvEscape(v.town),
      csvEscape(v.name),
      csvEscape(v.category),
      csvEscape(v.address),
      csvEscape(v.phone),
      csvEscape(v.website),
      csvEscape(v.mapsUrl),
      csvEscape(v.notes),
      csvEscape(v.lastVerified)
    ].join(',')
  )

  // Read existing master CSV to check it ends with newline
  const existing = fs.readFileSync(MASTER_CSV, 'utf-8')
  const separator = existing.endsWith('\n') ? '' : '\n'

  // Append
  fs.appendFileSync(MASTER_CSV, separator + csvLines.join('\n') + '\n')

  console.log(`Appended ${venues.length} Sheffield venues to ${MASTER_CSV}`)
}

run()
