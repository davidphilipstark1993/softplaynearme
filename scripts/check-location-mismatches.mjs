#!/usr/bin/env node
// Flags venues whose postcode says they are somewhere other than the hub
// (city page) they are filed under, and writes a CSV to review. Read-only: it
// never changes data.
//
// Issues reported (one row per venue per issue):
//   area_mismatch    postcode area/district maps to a different hub than city_slug
//                    (reuses the mapping in scripts/migrations/_geo.mjs)
//   nearby_town      the venue is in a surrounding town of a hub with a "Nearby"
//                    section (data/postcode-localities.json -> hubs): it is listed
//                    under Nearby, not in the hub's main list
//   different_county the venue's home town is in a different county from the hub
//                    it is filed under (e.g. a Grimsby venue under Doncaster)
//   no_postcode      nothing to check the placement against
//
// Source: the static export (data/generated/venuesByTown.json) by default — it
// needs no database. Pass --db to read the live venues table instead
// (DATABASE_URL, or .env.local).
//
// Usage:
//   node scripts/check-location-mismatches.mjs [--db] [--out=reports/location-mismatches.csv] [--all-types]
//
// By default only venues counted as genuine soft play are checked (same rule as
// lib/venueTypes.ts); --all-types includes trampoline parks, playgrounds, etc.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expectedCitiesForPostcode, postcodeDistrict } from './migrations/_geo.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const useDb = args.includes('--db')
const allTypes = args.includes('--all-types')
const outPath = path.resolve(ROOT, args.find((a) => a.startsWith('--out='))?.slice(6) ?? 'reports/location-mismatches.csv')

const VISIBLE = new Set(['indoor', 'pub'])
const isVisible = (t) => !t || VISIBLE.has(t)

const localities = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/postcode-localities.json'), 'utf8'))
const cities = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cities.json'), 'utf8'))
const cityBySlug = new Map(cities.map((c) => [c.slug, c]))

function localityOf(v) {
  const override = localities.venueOverrides[String(v.id)]
  if (override) return override
  const d = postcodeDistrict(v.postcode)
  return d ? localities.districts[d] ?? null : null
}

async function loadVenues() {
  if (!useDb) {
    const byTown = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/generated/venuesByTown.json'), 'utf8'))
    return Object.values(byTown).flatMap((t) =>
      t.venues.map((v) => ({ id: v.id, name: v.name, slug: v.slug, city_slug: t.townSlug, postcode: v.postcode, venue_type: v.venueType }))
    )
  }
  if (fs.existsSync(path.join(ROOT, '.env.local'))) {
    for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
      const i = line.indexOf('=')
      if (i > 0 && !line.trim().startsWith('#')) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, city_slug, postcode, venue_type FROM venues WHERE is_active = true ORDER BY city_slug, name`
    )
    return rows
  } finally {
    await pool.end()
  }
}

// Postcode areas where scripts/migrations/_geo.mjs's area-level mapping is known
// to be wrong or too coarse to act on without a human look.
const KNOWN_COLLISIONS = {
  SO: 'SO is Southampton, not Southend: _geo.mjs maps SO to the southend hub by mistake (see reports/phase4-geo-followup.md). There is no Southampton hub — review, do not reassign to southend.',
}

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const venues = (await loadVenues()).filter((v) => allTypes || isVisible(v.venue_type))
const rows = []

for (const v of venues) {
  const hub = cityBySlug.get(v.city_slug)
  const hubName = hub?.name ?? v.city_slug
  const hubCounty = hub?.county ?? ''
  const district = postcodeDistrict(v.postcode)
  const locality = localityOf(v)
  const localityCounty = locality ? localities.counties[locality] ?? '' : ''
  const resolved = v.postcode ? expectedCitiesForPostcode(v.postcode) : null
  const base = {
    id: v.id,
    name: v.name,
    hub: v.city_slug,
    url: `/soft-play/${v.city_slug}/${v.slug}`,
    postcode: v.postcode ?? '',
    district: district ?? '',
    home_town: locality ?? '',
    venue_type: v.venue_type ?? '',
  }
  const push = (issue, severity, expected, action) => rows.push({ issue, severity, ...base, expected_hub_from_postcode: expected ?? '', suggested_action: action })

  if (!v.postcode || !String(v.postcode).trim()) {
    push('no_postcode', 'info', '', 'Add a postcode so placement can be checked.')
    continue
  }

  if (resolved && !resolved.expected.includes(v.city_slug)) {
    const area = (district ?? '').match(/^[A-Z]+/)?.[0] ?? ''
    const districtLevel = resolved.detail.startsWith('postcode district')
    if (KNOWN_COLLISIONS[area]) {
      push('area_mismatch', 'medium', `none (${KNOWN_COLLISIONS[area].split(':')[0]})`, KNOWN_COLLISIONS[area])
    } else {
      // A district-level match (e.g. HU17 = Beverley) is precise; an area-level
      // one (e.g. NG = Nottingham) is a hint — Newark and Sleaford are NG but not Nottingham.
      push(
        'area_mismatch',
        districtLevel ? 'high' : 'medium',
        resolved.expected.join(' / '),
        resolved.expected.length === 1
          ? `Postcode (${resolved.detail}) maps to ${resolved.expected[0]}. ${districtLevel ? 'Likely misfiled' : 'Review'} — if right, reassign city_slug (scripts/migrations/phase4-03-reassign-city.mjs adds the 301).`
          : `Postcode (${resolved.detail}) could be ${resolved.expected.join(' or ')} — review manually.`
      )
    }
  }

  const hubCfg = localities.hubs[v.city_slug]
  if (hubCfg && locality && !hubCfg.core.includes(locality) && hubCfg.nearby.includes(locality)) {
    push('nearby_town', 'info', '', `In ${locality}, not ${hubName}. Listed under "Nearby" on the ${hubName} page (URL unchanged). A hub for ${locality} needs 3+ venues.`)
  }

  if (locality && localityCounty && hubCounty && localityCounty !== hubCounty) {
    push(
      'different_county',
      'high',
      '',
      `${locality} is in ${localityCounty}; the ${hubName} hub covers ${hubCounty}. No hub covers ${locality} yet — candidate for a new hub (3+ venues) or removal from ${hubName}.`
    )
  }
}

const columns = ['issue', 'severity', 'id', 'name', 'hub', 'url', 'postcode', 'district', 'home_town', 'expected_hub_from_postcode', 'venue_type', 'suggested_action']
const order = { high: 0, medium: 1, info: 2 }
rows.sort((a, b) => order[a.severity] - order[b.severity] || a.issue.localeCompare(b.issue) || a.hub.localeCompare(b.hub) || a.name.localeCompare(b.name))

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n')

const tally = rows.reduce((m, r) => ((m[r.issue] = (m[r.issue] ?? 0) + 1), m), {})
console.log(`Checked ${venues.length} venues from ${useDb ? 'the database' : 'the static export'}${allTypes ? '' : ' (soft play types only)'}.`)
console.log(`Wrote ${rows.length} rows to ${path.relative(ROOT, outPath)}:`, tally)
