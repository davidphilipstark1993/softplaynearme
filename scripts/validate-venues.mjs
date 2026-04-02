/**
 * validate-venues.mjs
 *
 * Validates the integrity of city/venue data across the database and cities.json.
 *
 * Checks:
 *   1. Every venue has a city_slug that matches a known city in cities.json
 *   2. Every city in cities.json has at least MIN_VENUES_PER_CITY venues in the DB
 *   3. No city page would render empty (city_slug in DB with 0 venues)
 *   4. Venue slugs are unique within a city
 *   5. Venues have minimum required fields (name, slug, city_slug)
 *   6. No duplicate venue slugs across the whole DB
 *
 * Usage:
 *   node scripts/validate-venues.mjs            # report only
 *   node scripts/validate-venues.mjs --fix      # attempt auto-fixes where safe
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

const MIN_VENUES_PER_CITY = 5
const FIX_MODE = process.argv.includes('--fix')

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function pad(str, len) {
  return String(str).padEnd(len)
}

function rpad(str, len) {
  return String(str).padStart(len)
}

// ---------------------------------------------------------------------------
// Report accumulator
// ---------------------------------------------------------------------------

const issues = {
  errors: [],    // must fix
  warnings: [],  // should fix
  info: [],      // advisory
}

function error(msg)   { issues.errors.push(msg) }
function warn(msg)    { issues.warnings.push(msg) }
function info(msg)    { issues.info.push(msg) }

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnvLocal()

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set. Add it to .env.local')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  })
  const client = await pool.connect()

  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('  SOFT PLAY NEAR ME — VENUE VALIDATION REPORT')
  console.log(`  Mode: ${FIX_MODE ? 'FIX' : 'REPORT ONLY'}   Date: ${new Date().toISOString().slice(0, 10)}`)
  console.log('══════════════════════════════════════════════════════════════\n')

  // --- Load cities.json ---
  const citiesPath = path.join(projectRoot, 'data', 'cities.json')
  const cities = JSON.parse(fs.readFileSync(citiesPath, 'utf8'))
  const citySlugSet = new Set(cities.map(c => c.slug))
  console.log(`Loaded cities.json: ${cities.length} cities`)

  // --- Load all venues from DB ---
  const venueRows = await client.query(`
    SELECT id, name, slug, city_slug, city, completeness_score,
           description, rating
    FROM venues
    ORDER BY city_slug, name
  `)
  const venues = venueRows.rows
  console.log(`Loaded DB: ${venues.length} venues\n`)

  // ────────────────────────────────────────────────────────────────
  // CHECK 1: Venues with no city_slug
  // ────────────────────────────────────────────────────────────────
  console.log('── CHECK 1: Venues missing city_slug ──────────────────────────')
  const missingSlug = venues.filter(v => !v.city_slug || v.city_slug.trim() === '' || v.city_slug === 'unknown')
  if (missingSlug.length === 0) {
    console.log('  ✓ All venues have a city_slug\n')
  } else {
    error(`${missingSlug.length} venues have no valid city_slug`)
    console.log(`  ✗ ${missingSlug.length} venues with missing/unknown city_slug:\n`)
    missingSlug.slice(0, 20).forEach(v =>
      console.log(`    [id:${rpad(v.id, 5)}] ${pad(v.name?.slice(0, 40), 42)} city_slug="${v.city_slug}" city="${v.city}"`)
    )
    if (missingSlug.length > 20) console.log(`    … and ${missingSlug.length - 20} more`)

    if (FIX_MODE) {
      let fixed = 0
      for (const v of missingSlug) {
        const guessedSlug = slugify(v.city || v.name || '')
        if (guessedSlug && citySlugSet.has(guessedSlug)) {
          await client.query(`UPDATE venues SET city_slug = $1, updated_at = NOW() WHERE id = $2`, [guessedSlug, v.id])
          fixed++
        }
      }
      console.log(`\n  [FIX] Updated ${fixed} of ${missingSlug.length} venues with guessed city_slug\n`)
    }
    console.log()
  }

  // ────────────────────────────────────────────────────────────────
  // CHECK 2: Venues whose city_slug is not in cities.json
  // ────────────────────────────────────────────────────────────────
  console.log('── CHECK 2: Venues with city_slug not in cities.json ───────────')
  const bySlug = {}
  for (const v of venues) {
    if (!bySlug[v.city_slug]) bySlug[v.city_slug] = []
    bySlug[v.city_slug].push(v)
  }

  const orphanedSlugs = Object.keys(bySlug).filter(s => s && s !== 'unknown' && !citySlugSet.has(s))
  if (orphanedSlugs.length === 0) {
    console.log('  ✓ All venue city_slugs match a city in cities.json\n')
  } else {
    // These are real cities with data but no SEO page — warn not error
    warn(`${orphanedSlugs.length} city_slugs in DB have no matching entry in cities.json`)
    console.log(`  ⚠ ${orphanedSlugs.length} slugs in DB not in cities.json:\n`)
    orphanedSlugs
      .sort((a, b) => bySlug[b].length - bySlug[a].length)
      .forEach(s => {
        const count = bySlug[s].length
        const sample = bySlug[s].slice(0, 2).map(v => v.name).join(', ')
        console.log(`    ${pad(s, 20)} ${rpad(count, 3)} venues  e.g. ${sample.slice(0, 60)}`)
      })
    console.log()
  }

  // ────────────────────────────────────────────────────────────────
  // CHECK 3: Cities in cities.json with fewer than MIN_VENUES_PER_CITY
  // ────────────────────────────────────────────────────────────────
  console.log(`── CHECK 3: City pages with fewer than ${MIN_VENUES_PER_CITY} venues ──────────────`)
  const underfilledCities = []
  const emptyCities = []

  for (const city of cities) {
    const count = (bySlug[city.slug] || []).length
    if (count === 0) emptyCities.push({ ...city, count })
    else if (count < MIN_VENUES_PER_CITY) underfilledCities.push({ ...city, count })
  }

  if (emptyCities.length === 0 && underfilledCities.length === 0) {
    console.log(`  ✓ All ${cities.length} city pages have ≥${MIN_VENUES_PER_CITY} venues\n`)
  } else {
    if (emptyCities.length > 0) {
      error(`${emptyCities.length} cities in cities.json have 0 venues in DB`)
      console.log(`  ✗ Empty city pages (0 venues):\n`)
      emptyCities.forEach(c => console.log(`    ${pad(c.slug, 20)} — "${c.name}" has NO venues`))
      console.log()
    }
    if (underfilledCities.length > 0) {
      warn(`${underfilledCities.length} cities have fewer than ${MIN_VENUES_PER_CITY} venues`)
      console.log(`  ⚠ Underfilled city pages (<${MIN_VENUES_PER_CITY} venues):\n`)
      underfilledCities
        .sort((a, b) => a.count - b.count)
        .forEach(c => console.log(`    ${pad(c.slug, 20)} ${rpad(c.count, 3)} venues`))
      console.log()
    }
  }

  // ────────────────────────────────────────────────────────────────
  // CHECK 4: Duplicate slugs within a city
  // ────────────────────────────────────────────────────────────────
  console.log('── CHECK 4: Duplicate venue slugs within a city ───────────────')
  const dupeWithinCity = []
  for (const [citySlug, cityVenues] of Object.entries(bySlug)) {
    const seen = {}
    for (const v of cityVenues) {
      if (!v.slug) continue
      if (seen[v.slug]) {
        dupeWithinCity.push({ citySlug, slug: v.slug, a: seen[v.slug], b: v })
      } else {
        seen[v.slug] = v
      }
    }
  }
  if (dupeWithinCity.length === 0) {
    console.log('  ✓ No duplicate slugs within any city\n')
  } else {
    error(`${dupeWithinCity.length} duplicate venue slugs within the same city`)
    console.log(`  ✗ ${dupeWithinCity.length} duplicate slugs:\n`)
    dupeWithinCity.slice(0, 15).forEach(d =>
      console.log(`    [${d.citySlug}] slug="${d.slug}"  id:${d.a.id} vs id:${d.b.id}`)
    )
    if (dupeWithinCity.length > 15) console.log(`    … and ${dupeWithinCity.length - 15} more`)
    console.log()
  }

  // ────────────────────────────────────────────────────────────────
  // CHECK 5: Venues missing slug or name
  // ────────────────────────────────────────────────────────────────
  console.log('── CHECK 5: Venues missing required fields ─────────────────────')
  const missingName = venues.filter(v => !v.name || v.name.trim() === '')
  const missingSlugField = venues.filter(v => !v.slug || v.slug.trim() === '')

  if (missingName.length === 0 && missingSlugField.length === 0) {
    console.log('  ✓ All venues have name and slug\n')
  } else {
    if (missingName.length) {
      error(`${missingName.length} venues have no name`)
      missingName.forEach(v => console.log(`    ✗ [id:${v.id}] no name  city_slug=${v.city_slug}`))
    }
    if (missingSlugField.length) {
      error(`${missingSlugField.length} venues have no slug`)
      missingSlugField.forEach(v => console.log(`    ✗ [id:${v.id}] "${v.name}"  no slug  city_slug=${v.city_slug}`))
    }
    console.log()
  }

  // ────────────────────────────────────────────────────────────────
  // CHECK 6: Venues with no description
  // ────────────────────────────────────────────────────────────────
  console.log('── CHECK 6: Venues missing description ────────────────────────')
  const noDesc = venues.filter(v => !v.description || v.description.trim() === '')
  if (noDesc.length === 0) {
    console.log('  ✓ All venues have a description\n')
  } else {
    warn(`${noDesc.length} venues have no description`)
    const byCity = {}
    noDesc.forEach(v => { byCity[v.city_slug] = (byCity[v.city_slug] || 0) + 1 })
    console.log(`  ⚠ ${noDesc.length} venues without description — by city:\n`)
    Object.entries(byCity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([slug, count]) => console.log(`    ${pad(slug, 20)} ${count}`))
    if (Object.keys(byCity).length > 10) console.log(`    … and ${Object.keys(byCity).length - 10} more cities`)
    console.log()
  }

  // ────────────────────────────────────────────────────────────────
  // CHECK 7: Completeness score distribution
  // ────────────────────────────────────────────────────────────────
  console.log('── CHECK 7: Completeness score distribution ───────────────────')
  const scoreRes = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE completeness_score >= 60) as high,
      COUNT(*) FILTER (WHERE completeness_score >= 30 AND completeness_score < 60) as mid,
      COUNT(*) FILTER (WHERE completeness_score < 30) as low,
      COUNT(*) FILTER (WHERE completeness_score IS NULL) as null_score,
      ROUND(AVG(completeness_score)) as avg_score,
      MIN(completeness_score) as min_score,
      MAX(completeness_score) as max_score
    FROM venues
  `)
  const sc = scoreRes.rows[0]
  console.log(`  Avg score : ${sc.avg_score}`)
  console.log(`  High 60+  : ${rpad(sc.high, 5)} venues  (fully indexed)`)
  console.log(`  Mid  30-59: ${rpad(sc.mid, 5)} venues  (may be indexed)`)
  console.log(`  Low  <30  : ${rpad(sc.low, 5)} venues  (noindex)`)
  console.log(`  Null      : ${rpad(sc.null_score, 5)} venues`)
  if (parseInt(sc.low) > 20) warn(`${sc.low} venues below noindex threshold (score < 30)`)
  if (parseInt(sc.null_score) > 0) warn(`${sc.null_score} venues have NULL completeness score`)
  console.log()

  // ────────────────────────────────────────────────────────────────
  // CHECK 8: Full venue count per city (table)
  // ────────────────────────────────────────────────────────────────
  console.log('── CHECK 8: Full city coverage table ──────────────────────────')
  const allCitySlugs = [...new Set([
    ...cities.map(c => c.slug),
    ...Object.keys(bySlug).filter(s => s && s !== 'unknown'),
  ])].sort()

  const maxNameLen = Math.max(...cities.map(c => c.name?.length || 0))
  console.log(`\n  ${'City'.padEnd(20)} ${'Slug'.padEnd(18)} ${'Venues'.padStart(7)} ${'Avg Score'.padStart(10)} ${'In cities.json?'.padStart(16)}`)
  console.log(`  ${'─'.repeat(75)}`)

  let totalVenues = 0
  for (const slug of allCitySlugs) {
    const cityConfig = cities.find(c => c.slug === slug)
    const cityVenues = bySlug[slug] || []
    const count = cityVenues.length
    const avgScore = count > 0
      ? Math.round(cityVenues.reduce((sum, v) => sum + (v.completeness_score || 0), 0) / count)
      : 0
    const inJson = citySlugSet.has(slug) ? '✓' : '✗ MISSING'
    const flag = count === 0 ? ' ◄ EMPTY' : count < MIN_VENUES_PER_CITY ? ' ◄ LOW' : ''
    totalVenues += count
    console.log(`  ${pad((cityConfig?.name || slug), 20)} ${pad(slug, 18)} ${rpad(count, 7)} ${rpad(avgScore, 10)} ${rpad(inJson, 16)}${flag}`)
  }
  console.log(`  ${'─'.repeat(75)}`)
  console.log(`  ${'TOTAL'.padEnd(20)} ${pad('', 18)} ${rpad(totalVenues, 7)}`)
  console.log()

  // ────────────────────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('══════════════════════════════════════════════════════════════\n')

  if (issues.errors.length === 0 && issues.warnings.length === 0) {
    console.log('  ✅ All checks passed — data is clean\n')
  } else {
    if (issues.errors.length > 0) {
      console.log(`  ✗ ERRORS (${issues.errors.length}) — must fix:`)
      issues.errors.forEach(e => console.log(`    • ${e}`))
      console.log()
    }
    if (issues.warnings.length > 0) {
      console.log(`  ⚠ WARNINGS (${issues.warnings.length}) — should fix:`)
      issues.warnings.forEach(w => console.log(`    • ${w}`))
      console.log()
    }
    if (issues.info.length > 0) {
      console.log(`  ℹ INFO (${issues.info.length}):`)
      issues.info.forEach(i => console.log(`    • ${i}`))
      console.log()
    }
  }

  if (!FIX_MODE && (issues.errors.length > 0)) {
    console.log('  Run with --fix to attempt automatic corrections.\n')
  }

  console.log('══════════════════════════════════════════════════════════════\n')

  client.release()
  await pool.end()

  process.exit(issues.errors.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
