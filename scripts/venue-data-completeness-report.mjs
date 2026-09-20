#!/usr/bin/env node
// Read-only report: how many active venues, per city, are missing phone,
// opening hours, website, or a usable image — so data-completion work can be
// prioritised. Never writes anything back to the DB.
//
// Usage:
//   node scripts/venue-data-completeness-report.mjs                # markdown to stdout
//   node scripts/venue-data-completeness-report.mjs --csv           # CSV to stdout
//   node scripts/venue-data-completeness-report.mjs --csv > reports/venue-data-completeness.csv

import { readFileSync, existsSync } from 'fs'
import pg from 'pg'

const { Pool } = pg

function loadEnvLocal() {
  if (!existsSync('.env.local')) return
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!(key in process.env)) process.env[key] = val
  }
}
loadEnvLocal()

const asCsv = process.argv.includes('--csv')

// Mirrors lib/imageUtils.ts's isUsablePhotoUrl() so this report agrees with
// what the site actually renders (scraped photo URLs are often dead Google
// session links or placeholder assets, not real images).
const UNRENDERABLE_PHOTO_PATTERNS = [
  /googleusercontent\.com\/gps-cs-s\//,
  /streetviewpixels-pa\.googleapis\.com/,
  /maps\.gstatic\.com\/tactile\/pane\/result-no-thumbnail/,
  /ssl\.gstatic\.com\/local\/servicebusiness\/default_user\.png/,
]
const ALLOWED_IMAGE_HOSTS = ['images.unsplash.com', 'ssl.gstatic.com', 'lh3.googleusercontent.com', 'maps.googleapis.com']

function isUsableImageUrl(url) {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed || trimmed.toLowerCase() === 'nan') return false
  if (!/^https?:\/\//i.test(trimmed)) return false
  let hostname
  try {
    hostname = new URL(trimmed).hostname
  } catch {
    return false
  }
  if (!ALLOWED_IMAGE_HOSTS.includes(hostname) && !hostname.endsWith('.googleusercontent.com')) return false
  return !UNRENDERABLE_PHOTO_PATTERNS.some((p) => p.test(trimmed))
}

function hasUsableHours(openingHours) {
  if (!openingHours) return false
  if (typeof openingHours === 'object') return Object.keys(openingHours).length > 0
  return false
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

try {
  const { rows } = await pool.query(
    `SELECT city_slug, phone, website, opening_hours, main_image_url
     FROM venues
     WHERE is_active = true`
  )

  const byCity = {}
  for (const v of rows) {
    const city = v.city_slug || '(unknown)'
    byCity[city] ??= { total: 0, noPhone: 0, noHours: 0, noWebsite: 0, noImage: 0 }
    const c = byCity[city]
    c.total++
    if (!v.phone) c.noPhone++
    if (!hasUsableHours(v.opening_hours)) c.noHours++
    if (!v.website) c.noWebsite++
    if (!isUsableImageUrl(v.main_image_url)) c.noImage++
  }

  const cityRows = Object.entries(byCity).sort((a, b) => b[1].total - a[1].total)

  const totals = cityRows.reduce(
    (acc, [, c]) => ({
      total: acc.total + c.total,
      noPhone: acc.noPhone + c.noPhone,
      noHours: acc.noHours + c.noHours,
      noWebsite: acc.noWebsite + c.noWebsite,
      noImage: acc.noImage + c.noImage,
    }),
    { total: 0, noPhone: 0, noHours: 0, noWebsite: 0, noImage: 0 }
  )

  const pct = (n, total) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '—')

  if (asCsv) {
    const lines = ['city,total_venues,missing_phone,missing_phone_pct,missing_hours,missing_hours_pct,missing_website,missing_website_pct,missing_image,missing_image_pct']
    for (const [city, c] of cityRows) {
      lines.push(
        [
          city,
          c.total,
          c.noPhone, pct(c.noPhone, c.total),
          c.noHours, pct(c.noHours, c.total),
          c.noWebsite, pct(c.noWebsite, c.total),
          c.noImage, pct(c.noImage, c.total),
        ].join(',')
      )
    }
    lines.push(
      [
        'TOTAL',
        totals.total,
        totals.noPhone, pct(totals.noPhone, totals.total),
        totals.noHours, pct(totals.noHours, totals.total),
        totals.noWebsite, pct(totals.noWebsite, totals.total),
        totals.noImage, pct(totals.noImage, totals.total),
      ].join(',')
    )
    console.log(lines.join('\n'))
  } else {
    console.log(`# Venue Data Completeness Report\n`)
    console.log(`Generated ${new Date().toISOString().slice(0, 10)}. Active venues only.\n`)
    console.log('| City | Venues | No Phone | No Hours | No Website | No Image |')
    console.log('|---|---|---|---|---|---|')
    for (const [city, c] of cityRows) {
      console.log(
        `| ${city} | ${c.total} | ${c.noPhone} (${pct(c.noPhone, c.total)}) | ${c.noHours} (${pct(c.noHours, c.total)}) | ${c.noWebsite} (${pct(c.noWebsite, c.total)}) | ${c.noImage} (${pct(c.noImage, c.total)}) |`
      )
    }
    console.log(
      `| **TOTAL** | **${totals.total}** | **${totals.noPhone} (${pct(totals.noPhone, totals.total)})** | **${totals.noHours} (${pct(totals.noHours, totals.total)})** | **${totals.noWebsite} (${pct(totals.noWebsite, totals.total)})** | **${totals.noImage} (${pct(totals.noImage, totals.total)})** |`
    )
  }
} finally {
  await pool.end()
}
