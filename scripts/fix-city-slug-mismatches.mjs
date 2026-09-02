#!/usr/bin/env node
/**
 * Find venues whose `slug` still names a different city than their current
 * `townSlug` (leftover from before a geo dedup/reassignment corrected the
 * town but never regenerated the slug), and regenerate a correct slug.
 *
 * Detection is data-driven: it checks whether a venue's slug ends with
 * "-<T>" for some OTHER townSlug T that actually exists in the dataset,
 * and that stripping that suffix reproduces slugify(name).
 *
 * Usage:
 *   node scripts/fix-city-slug-mismatches.mjs            # dry run, writes report only
 *   node scripts/fix-city-slug-mismatches.mjs --apply    # also rewrites venues.json,
 *                                                          venuesByTown.json, and appends
 *                                                          redirect entries to redirects.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const VENUES_PATH = path.join(ROOT, 'data', 'generated', 'venues.json')
const BY_TOWN_PATH = path.join(ROOT, 'data', 'generated', 'venuesByTown.json')
const REDIRECTS_PATH = path.join(ROOT, 'data', 'redirects.json')
const REPORT_PATH = path.join(ROOT, 'scripts', 'output', 'city-slug-mismatches.json')

const APPLY = process.argv.includes('--apply')

// Verified by hand (postcode areas): these venues carry Southampton (SO)
// postcodes but are bucketed under the "southend" town — Southend-on-Sea
// (Essex, SS postcodes) and Southampton (Hampshire, SO postcodes) are
// ~150 miles apart. That's a wrong TOWN assignment, not a stale slug, so
// regenerating the slug would just cement bad data into the URL. Exclude
// from auto-apply and flag separately instead.
function looksLikeWrongTown(venue) {
  const postcode = (venue.postcode || '').toUpperCase()
  if (venue.townSlug === 'southend' && /^SO\d/.test(postcode)) return 'likely Southampton, not Southend (SO postcode)'
  return null
}

// Matches generateSlug(name, city) in scripts/import-master-csv.mjs
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 100)
}

function generateSlug(name, city) {
  return slugify(`${name} ${city}`)
}

function ensureUniqueSlug(slug, existingSlugs) {
  let unique = slug
  let counter = 2
  while (existingSlugs.has(unique)) {
    unique = `${slug}-${counter}`
    counter++
  }
  existingSlugs.add(unique)
  return unique
}

function main() {
  const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf8'))
  const townSlugs = new Set(venues.map(v => v.townSlug))

  // Per-town slug registries, seeded with every slug currently in use,
  // so regenerated slugs can't collide with an existing venue.
  const slugsByTown = new Map()
  for (const v of venues) {
    if (!slugsByTown.has(v.townSlug)) slugsByTown.set(v.townSlug, new Set())
    slugsByTown.get(v.townSlug).add(v.slug)
  }

  const mismatches = []

  for (const v of venues) {
    const baseSlug = slugify(v.name)
    for (const otherTown of townSlugs) {
      if (otherTown === v.townSlug) continue
      const suffix = `-${otherTown}`
      if (!v.slug.endsWith(suffix)) continue
      const stripped = v.slug.slice(0, -suffix.length)
      // Only flag when stripping the foreign city leaves (approximately)
      // the plain name slug — avoids false positives from venue names
      // that legitimately contain another city's name as a word.
      if (stripped !== baseSlug) continue

      const oldSlug = v.slug
      const newSlug = ensureUniqueSlug(generateSlug(v.name, v.townSlug), slugsByTown.get(v.townSlug))
      const wrongTownReason = looksLikeWrongTown(v)

      mismatches.push({
        id: v.id,
        name: v.name,
        town: v.town,
        townSlug: v.townSlug,
        staleCityInSlug: otherTown,
        oldSlug,
        newSlug,
        oldUrl: `/soft-play/${v.townSlug}/${oldSlug}`,
        newUrl: `/soft-play/${v.townSlug}/${newSlug}`,
        needsManualReview: wrongTownReason,
      })
      break
    }
  }

  const flagged = mismatches.filter(m => m.needsManualReview)
  const safe = mismatches.filter(m => !m.needsManualReview)

  console.log(`Found ${mismatches.length} venues with a stale city name baked into their slug.`)
  console.log(`  ${safe.length} look like a simple stale-slug fix (town assignment already correct).`)
  console.log(`  ${flagged.length} are flagged for manual review (town assignment itself looks wrong).\n`)

  for (const m of safe) {
    console.log(`  [${m.town}] ${m.name}`)
    console.log(`    ${m.oldUrl}`)
    console.log(`    -> ${m.newUrl}`)
  }

  if (flagged.length) {
    console.log(`\n--- NEEDS MANUAL REVIEW (not auto-fixed) ---`)
    for (const m of flagged) {
      console.log(`  [${m.town}] ${m.name} — ${m.needsManualReview}`)
      console.log(`    ${m.oldUrl}`)
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, JSON.stringify(mismatches, null, 2))
  console.log(`\nReport written to ${path.relative(ROOT, REPORT_PATH)}`)

  if (!APPLY) {
    console.log('\nDry run only — re-run with --apply to update venues.json, venuesByTown.json, and redirects.json.')
    console.log('(Only the safe entries are applied; flagged entries are left untouched.)')
    return
  }

  if (safe.length === 0) return

  const byId = new Map(safe.map(m => [m.id, m.newSlug]))

  // Update venues.json in place
  for (const v of venues) {
    if (byId.has(v.id)) v.slug = byId.get(v.id)
  }
  fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2) + '\n')

  // Update venuesByTown.json in place (same venue shape, nested under { town, townSlug, venues })
  const byTown = JSON.parse(fs.readFileSync(BY_TOWN_PATH, 'utf8'))
  for (const townSlug of Object.keys(byTown)) {
    const entry = byTown[townSlug]
    if (!entry?.venues) continue
    for (const v of entry.venues) {
      if (byId.has(v.id)) v.slug = byId.get(v.id)
    }
  }
  fs.writeFileSync(BY_TOWN_PATH, JSON.stringify(byTown, null, 2) + '\n')

  // Append redirect entries so already-indexed old URLs route to the fixed page
  const redirects = JSON.parse(fs.readFileSync(REDIRECTS_PATH, 'utf8'))
  const existingSources = new Set(redirects.map(r => r.source))
  let added = 0
  for (const m of safe) {
    if (existingSources.has(m.oldUrl)) continue
    redirects.push({ source: m.oldUrl, destination: m.newUrl, permanent: true })
    existingSources.add(m.oldUrl)
    added++
  }
  fs.writeFileSync(REDIRECTS_PATH, JSON.stringify(redirects, null, 2) + '\n')

  console.log(`\nApplied: updated ${safe.length} venue slugs and added ${added} redirect entries.`)
  if (flagged.length) {
    console.log(`Left ${flagged.length} flagged venues untouched — see the report for manual review.`)
  }
  console.log('Note: this only updates the static JSON. If venues.json is regenerated from the')
  console.log('database (scripts/rebuild-static-json.mjs), the `slug` column in the DB should also')
  console.log('be updated, or the next rebuild will reintroduce the stale slugs.')
}

main()
