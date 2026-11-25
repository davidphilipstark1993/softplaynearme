// "More soft play near <town>" on thin hubs (lib/nearestVenues.ts).
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = process.features.typescript !== false && Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

const centre = { lat: 51.08, lng: -4.06 } // Barnstaple-ish
const v = (o) => ({ slug: o.name.toLowerCase().replace(/\W+/g, '-'), city_slug: 'elsewhere', venue_type: 'indoor', completeness_score: 50, ...o })

test('nearest venues: other hubs only, soft play only, indexable only, within 15 miles, nearest first', { skip }, async () => {
  const { rankNearest } = await import('../lib/nearestVenues.ts')
  const venues = [
    v({ name: 'Own hub', city_slug: 'barnstaple', lat: 51.08, lng: -4.06 }),
    v({ name: 'Far', lat: 51.08 + 0.4, lng: -4.06 }), // ~28 miles
    v({ name: 'Second', lat: 51.08 + 0.1, lng: -4.06 }), // ~7 miles
    v({ name: 'First', lat: 51.08 + 0.02, lng: -4.06 }),
    v({ name: 'Trampoline', venue_type: 'trampoline-park', lat: 51.081, lng: -4.06 }),
    v({ name: 'Thin', completeness_score: 5, lat: 51.081, lng: -4.06 }),
    v({ name: 'No coords', lat: null, lng: null }),
    v({ name: 'Static export row', completeness_score: undefined, lat: 51.08 + 0.05, lng: -4.06 }),
  ]
  const got = rankNearest(centre, venues, 'barnstaple').map((r) => r.venue.name)
  assert.deepEqual(got, ['First', 'Static export row', 'Second'])
})

test('nearest venues: limit applies, and every hub centre is a real coordinate', { skip }, async () => {
  const { rankNearest, hubCentre } = await import('../lib/nearestVenues.ts')
  const many = Array.from({ length: 10 }, (_, i) => v({ name: `V${i}`, lat: 51.08 + i * 0.01, lng: -4.06 }))
  assert.equal(rankNearest(centre, many, 'x').length, 6)
  assert.equal(hubCentre('no-such-hub'), null)
  const c = hubCentre('durham')
  assert.ok(c && c.lat > 54 && c.lat < 55 && c.lng < -1, 'durham centre added 25 Nov 2026')
})
