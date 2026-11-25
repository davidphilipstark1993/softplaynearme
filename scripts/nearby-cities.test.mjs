// "Nearby" hub links (lib/venues.ts getNearbyCities): geographically sensible, never empty
// when a hub has a neighbour within 50 km, at most 6.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = process.features.typescript !== false && Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'
const centres = JSON.parse(fs.readFileSync(new URL('../data/hub-centres.json', import.meta.url), 'utf8'))
const km = (a, b) => {
  const r = (x) => (x * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

test('nearby hubs: within 60 km, no self-link, no duplicates, at most 6', { skip }, async () => {
  const { cities, getNearbyCities } = await import('../lib/venues.ts')
  for (const c of cities) {
    const near = getNearbyCities(c.slug)
    assert.ok(near.length <= 6, c.slug)
    assert.equal(new Set(near.map((n) => n.slug)).size, near.length, `${c.slug}: duplicate`)
    for (const n of near) {
      assert.notEqual(n.slug, c.slug)
      if (centres[c.slug] && centres[n.slug]) assert.ok(km(centres[c.slug], centres[n.slug]) <= 60, `${c.slug} -> ${n.slug}`)
    }
    const anyClose = cities.some((o) => o.slug !== c.slug && centres[c.slug] && centres[o.slug] && km(centres[c.slug], centres[o.slug]) <= 50)
    if (anyClose) assert.ok(near.length > 0, `${c.slug} has a hub within 50 km but no nearby links`)
  }
})

test('nearby hubs: hand-picked neighbours come first', { skip }, async () => {
  const { getNearbyCities } = await import('../lib/venues.ts')
  const leeds = getNearbyCities('leeds').map((c) => c.slug)
  assert.ok(leeds.includes('bradford'), leeds.join(','))
  assert.ok(!getNearbyCities('lancaster').some((c) => c.slug === 'carlisle'), 'Carlisle (94 km) is not "nearby" Lancaster')
})
