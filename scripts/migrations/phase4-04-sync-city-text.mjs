// Syncs the venues.city / county text columns to match city_slug, using
// data/cities.json as the single source of truth.
//
// Discovered while regenerating descriptions after phase4-02/03: those
// migrations (and, it turns out, every prior city_slug correction going
// back to the original Aug 6 geo fix) only ever updated city_slug — the
// separate city/county *text* columns were never kept in sync. Since
// enrich-seo-all.mjs's description templates interpolate v.city and
// v.countyStr (not city_slug), any venue whose city_slug was ever corrected
// kept generating descriptions asserting its OLD or blank city. 319 venues
// currently have city_slug correct but city/county stale; 45 have a null
// city.
//
// Deliberately excludes `region` — data/cities.json uses a shorthand
// ("Yorkshire") while the DB itself inconsistently mixes that with the full
// ONS name ("Yorkshire and the Humber") independent of any city_slug bug,
// and region isn't interpolated into any description template, so it's out
// of scope for this fix.
//
// This is a pure text sync against a static, authoritative source
// (data/cities.json) — no judgment calls, safe to run broadly.
//
//   node scripts/migrations/phase4-04-sync-city-text.mjs [--execute]

import { readFileSync, writeFileSync } from 'fs'
import { EXECUTE, getPool, runBatched } from './_lib.mjs'

const cities = JSON.parse(readFileSync('data/cities.json', 'utf-8'))
const bySlug = Object.fromEntries(cities.map((c) => [c.slug, c]))

const pool = await getPool()
const needsRegen = []

try {
  const { rows } = await pool.query('SELECT id, name, slug, city, city_slug, county FROM venues ORDER BY id')

  const mismatched = rows.filter((v) => {
    const c = bySlug[v.city_slug]
    if (!c) return false
    return v.city !== c.name || (c.county && v.county !== c.county)
  })

  console.log(`${mismatched.length} venues have city/county text out of sync with city_slug.\n`)
  console.log(EXECUTE ? 'EXECUTING — this will UPDATE city/county text columns.' : 'DRY RUN — no changes will be made.')

  await runBatched(mismatched, async (v) => {
    const client = await pool.connect()
    try {
      const c = bySlug[v.city_slug]
      const check = await client.query('SELECT id, city_slug FROM venues WHERE id = $1', [v.id])
      if (check.rows.length === 0 || check.rows[0].city_slug !== v.city_slug) {
        console.log(`  SKIP id=${v.id} "${v.name}" — city_slug changed since scan`)
        return 'skipped'
      }
      console.log(`  ${EXECUTE ? 'SYNC' : 'would SYNC'} id=${v.id} "${v.name}": city "${v.city}" -> "${c.name}"${c.county ? `, county "${v.county}" -> "${c.county}"` : ''}`)
      if (EXECUTE) {
        await client.query('UPDATE venues SET city = $1, county = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [c.name, c.county || null, v.id])
      }
      needsRegen.push(v.id)
      return 'ok'
    } finally {
      client.release()
    }
  })
} finally {
  await pool.end()
}

if (needsRegen.length) {
  writeFileSync('data/_phase4_city_text_sync_ids.json', JSON.stringify(needsRegen, null, 2))
  console.log(`\n${needsRegen.length} venue id(s) written to data/_phase4_city_text_sync_ids.json (descriptions need regeneration)`)
}
