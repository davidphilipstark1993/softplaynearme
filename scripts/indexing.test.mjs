// lib/indexing.ts: the one rule set behind robots tags, hub merges and the sitemap.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerTsResolver } from './ts-resolve-hook.mjs'

registerTsResolver()
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const venues = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/generated/venues.json'), 'utf8'))

test('venue: indexable only with a verified fact beyond Google Places data', async () => {
  const { isVenueIndexable, verifiedFacts } = await import('../lib/indexing.ts')
  assert.equal(isVenueIndexable({ name: 'Bare', venue_type: 'indoor' }), false, 'name/address/rating alone')
  assert.equal(isVenueIndexable({ name: 'Cafe', cafe: true }), true)
  assert.equal(isVenueIndexable({ name: 'Priced', pricing_hint: '£6 per child' }), true)
  assert.equal(isVenueIndexable({ name: 'Owner prices', price_rows: 2 }), true)
  assert.equal(isVenueIndexable({ name: 'Park', venue_type: 'park-playground', cafe: true }), false, 'never-index types')
  assert.equal(isVenueIndexable({ name: 'Bounce', venue_type: 'trampoline-park', parties: true }), true, 'adjacent types: same fact rule')
  assert.equal(isVenueIndexable({ name: 'Town Leisure Centre', venue_type: 'leisure-centre', cafe: true }), false, 'leisure centre needs soft play evidence')
  assert.equal(isVenueIndexable({ name: 'Town Leisure Centre', venue_type: 'leisure-centre', cafe: true, has_soft_play: true }), true)
  assert.equal(isVenueIndexable({ name: 'Leisure Centre Soft Play', venue_type: 'leisure-centre', cafe: true }), true)
  assert.deepEqual(verifiedFacts({ cafe: false, parking: false }), [], 'a false flag is "not confirmed", not a fact')
})

test('hubs: >= 3 venues indexable; thin hubs merge into the nearest indexable hub within 25 km, else noindex', async () => {
  const { computeHubStates } = await import('../lib/indexing.ts')
  const centres = {
    big: { lat: 53.0, lng: -1.0 },
    near: { lat: 53.1, lng: -1.0 }, // ~11 km from big
    far: { lat: 54.0, lng: -1.0 }, // ~111 km
    nocentre: undefined,
  }
  const s = computeHubStates({ big: 5, near: 2, far: 1, nocentre: 1, empty: 0 }, centres)
  assert.deepEqual(s.big, { count: 5, indexable: true, mergeInto: null, mergeKm: null })
  assert.equal(s.near.indexable, false)
  assert.equal(s.near.mergeInto, 'big')
  assert.equal(s.far.mergeInto, null)
  assert.equal(s.nocentre.mergeInto, null)
  assert.equal(s.empty.mergeInto, null)
  // Grows to 3: indexable again, no redirect (data-driven, nothing to undo by hand).
  assert.equal(computeHubStates({ big: 5, near: 3 }, centres).near.mergeInto, null)
})

test('hubs (real data): merge targets are always indexable hubs, so there are no redirect chains', async () => {
  const { computeHubStates } = await import('../lib/indexing.ts')
  const { isVisibleVenueType } = await import('../lib/venueTypes.ts')
  const byCity = {}
  for (const v of venues) if (isVisibleVenueType(v.venueType)) byCity[v.townSlug] = (byCity[v.townSlug] ?? 0) + 1
  const s = computeHubStates(byCity)
  for (const [slug, st] of Object.entries(s)) {
    if (st.mergeInto) {
      assert.ok(s[st.mergeInto].indexable, `${slug} merges into non-indexable ${st.mergeInto}`)
      assert.ok(st.mergeKm <= 25)
    }
    assert.ok(!(st.indexable && st.mergeInto), `${slug} both indexed and merged`)
  }
})

test('filter pages: need an indexable hub and >= 3 matches', async () => {
  const { isFilterIndexable } = await import('../lib/indexing.ts')
  const ok = { count: 9, indexable: true, mergeInto: null, mergeKm: null }
  assert.equal(isFilterIndexable(3, ok), true)
  assert.equal(isFilterIndexable(2, ok), false)
  assert.equal(isFilterIndexable(5, { ...ok, indexable: false }), false)
  assert.equal(isFilterIndexable(5, undefined), false)
})

test('static export: no never-index venue types remain listed', async () => {
  const { INDEXING } = await import('../lib/indexing.ts')
  for (const v of venues) assert.ok(!INDEXING.neverIndexTypes.includes(v.venueType), `${v.townSlug}/${v.slug} is ${v.venueType}`)
})
