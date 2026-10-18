// Guards the static JSON export against drifting from itself — the bug behind
// "homepage says Hull has 37 venues, Hull page says 33". Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'generated')
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

// Keep in step with VISIBLE_VENUE_TYPES in lib/venueTypes.ts.
const VISIBLE = new Set(['indoor', 'pub'])
const isVisible = (v) => !v.venueType || VISIBLE.has(v.venueType)

const venues = read('venues.json')
const byTown = read('venuesByTown.json')
const towns = read('towns.json')

test('venues.json and venuesByTown.json hold the same venues', () => {
  const flat = new Set(venues.map((v) => v.id))
  const grouped = new Set(Object.values(byTown).flatMap((t) => t.venues.map((v) => v.id)))
  assert.equal(flat.size, venues.length, 'duplicate venue ids in venues.json')
  assert.deepEqual([...flat].sort((a, b) => a - b), [...grouped].sort((a, b) => a - b))
})

test('towns.json venueCount equals the number of visible venues per town', () => {
  for (const t of towns) {
    const expected = (byTown[t.slug]?.venues ?? []).filter(isVisible).length
    assert.equal(t.venueCount, expected, `${t.slug}: towns.json says ${t.venueCount}, venues say ${expected}`)
  }
})

test('every town with venues has an entry in towns.json', () => {
  const slugs = new Set(towns.map((t) => t.slug))
  for (const slug of Object.keys(byTown)) assert.ok(slugs.has(slug), `${slug} missing from towns.json`)
})
