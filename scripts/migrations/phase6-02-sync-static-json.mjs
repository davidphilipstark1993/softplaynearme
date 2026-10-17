// Phase 6-02: replay the phase 6-01 DB cleanup onto the static JSON export.
//
// Why: phase6-01-active-flag-and-hull-cleanup.mjs ran against the live DB
// (deleted the "soft ply r us" test venue; reclassified Funstation Hull, Laser
// Station St Stephen's Hull and William's Den from 'indoor' to
// 'family-attraction') but data/generated/*.json was never re-exported. City hubs
// render from the live DB (Hull = 33) while the statically-built homepage read
// the stale JSON (Hull = 37) — the visible symptom of that gap.
//
// This applies exactly those documented changes to the JSON and recomputes
// towns.json from the venues, using the same rules as scripts/rebuild-static-json.mjs.
// It is idempotent. A full `DATABASE_URL=… npm run data:rebuild` supersedes it and
// is the better fix when you have DB access; this exists so the repo stops
// disagreeing with the DB for the four venues phase 6-01 already decided.
//
// Usage: node scripts/migrations/phase6-02-sync-static-json.mjs [--dry-run]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const DRY = process.argv.includes('--dry-run')
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIR = path.join(ROOT, 'data', 'generated')

const RECLASSIFY = [
  { id: 28, name: 'Funstation Hull' },
  { id: 49, name: "Laser Station St Stephen's Hull" },
  { id: 36, name: "William's Den" },
]
const TO_TYPE = 'family-attraction'
const DELETE = { id: 1932, name: 'soft ply r us' }

const VISIBLE = new Set(['indoor', 'pub'])

const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
const write = (f, data) => {
  if (!DRY) fs.writeFileSync(path.join(DIR, f), JSON.stringify(data, null, 2))
}

const venues = read('venues.json')
const byTown = read('venuesByTown.json')
const towns = read('towns.json')

let removed = 0
let reclassified = 0

function patch(list) {
  const out = []
  for (const v of list) {
    if (v.id === DELETE.id && v.name === DELETE.name) {
      removed++
      continue
    }
    const target = RECLASSIFY.find((r) => r.id === v.id && r.name === v.name)
    if (target && v.venueType !== TO_TYPE) {
      v.venueType = TO_TYPE
      reclassified++
    }
    out.push(v)
  }
  return out
}

const newVenues = patch(venues)
const flatReclassified = reclassified
const flatRemoved = removed
removed = 0
reclassified = 0
for (const entry of Object.values(byTown)) entry.venues = patch(entry.venues)
if (removed !== flatRemoved || reclassified !== flatReclassified) {
  console.error('venues.json and venuesByTown.json were out of sync — aborting without writing.')
  process.exit(1)
}

for (const t of towns) {
  const list = byTown[t.slug]?.venues ?? []
  t.venueCount = list.filter((v) => VISIBLE.has(v.venueType)).length
  const rated = list.filter((v) => v.rating)
  t.avgRating = rated.length ? (rated.reduce((s, v) => s + (v.rating || 0), 0) / rated.length).toFixed(1) : null
}

console.log(`${DRY ? '[dry run] ' : ''}removed ${flatRemoved} test venue(s), reclassified ${flatReclassified} venue(s).`)
console.log('hull soft play count now:', towns.find((t) => t.slug === 'hull')?.venueCount)
write('venues.json', newVenues)
write('venuesByTown.json', byTown)
write('towns.json', towns)
