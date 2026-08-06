#!/usr/bin/env node
// Read-only spot-check: prints every venue whose postcode area or slug suffix
// disagrees with its current city_slug, grouped by city. Uses the same
// detection as scripts/migrations/phase2-04-move-wrong-city.mjs (see
// scripts/migrations/_geo.mjs) but makes no changes — safe to run anytime,
// against any/all cities, to confirm a city page is (still) clean or to spot
// new problems after a fresh data import.
//
// Usage:
//   node scripts/check-city-mismatch.mjs                # all cities
//   node scripts/check-city-mismatch.mjs --city=hull     # one city only

import { readFileSync, existsSync } from 'fs'
import pg from 'pg'
import { detectCityMismatch } from './migrations/_geo.mjs'

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

const cityFilter = process.argv.find((a) => a.startsWith('--city='))?.replace('--city=', '') || null

const cities = JSON.parse(readFileSync('data/cities.json', 'utf-8')).map((c) => ({ slug: c.slug, name: c.name }))

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })

try {
  const query = cityFilter
    ? 'SELECT id, name, slug, city_slug, postcode FROM venues WHERE city_slug = $1 ORDER BY name'
    : 'SELECT id, name, slug, city_slug, postcode FROM venues ORDER BY city_slug, name'
  const { rows } = await pool.query(query, cityFilter ? [cityFilter] : [])

  const findings = rows.map((v) => ({ v, result: detectCityMismatch(v, cities) })).filter((f) => f.result)

  if (!findings.length) {
    console.log(cityFilter ? `No city-mismatch signals found for "${cityFilter}". Looks clean.` : 'No city-mismatch signals found anywhere. Looks clean.')
  } else {
    const byCity = {}
    for (const f of findings) (byCity[f.v.city_slug] ??= []).push(f)
    for (const [city, list] of Object.entries(byCity).sort()) {
      console.log(`\n${city.toUpperCase()} (${list.length} flagged)`)
      for (const { v, result } of list) {
        const sigList = result.signals.map((s) => s.detail).join('; ')
        console.log(`  [${result.confidence}] "${v.name}" (${v.slug}) — candidates: ${result.candidates.join(' or ')} — ${sigList}`)
      }
    }
    console.log(`\nTotal flagged: ${findings.length} (${findings.filter((f) => f.result.confidence === 'HIGH').length} HIGH, ${findings.filter((f) => f.result.confidence === 'MEDIUM').length} MEDIUM)`)
  }
} finally {
  await pool.end()
}
