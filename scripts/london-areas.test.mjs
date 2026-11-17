// London area sub-hubs (lib/londonAreaHubs.ts): only areas with 5+ venues get a page, and the
// /soft-play/london/area/{area} URLs can't collide with a venue.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = process.features.typescript !== false && Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'
const venues = JSON.parse(fs.readFileSync(new URL('../data/generated/venues.json', import.meta.url), 'utf8'))

test('no London venue uses the reserved slug "area"', () => {
  assert.ok(!venues.some((v) => v.townSlug === 'london' && v.slug === 'area'))
})

test('area pages: only areas with 5+ main-list venues, nearby-town venues excluded', { skip }, async () => {
  const { MIN_AREA_VENUES } = await import('../lib/londonAreaContent.ts')
  const { getLondonAreaSlug } = await import('../lib/londonAreas.ts')
  const loc = JSON.parse(fs.readFileSync(new URL('../data/postcode-localities.json', import.meta.url), 'utf8'))
  const nearby = new Set(loc.hubs.london.nearby)
  const main = venues.filter((v) => v.townSlug === 'london' && (!v.venueType || ['indoor', 'pub'].includes(v.venueType)) && !nearby.has(loc.venueOverrides[String(v.id)]))
  assert.ok(!main.some((v) => /bushey|epsom/i.test(v.slug)), 'Bushey/Epsom are nearby towns, not London areas')
  const counts = {}
  for (const v of main) { const a = getLondonAreaSlug(v.postcode); if (a) counts[a] = (counts[a] ?? 0) + 1 }
  const pages = Object.entries(counts).filter(([, n]) => n >= MIN_AREA_VENUES).map(([a]) => a)
  assert.ok(pages.length >= 3, `only ${pages.length} areas qualify`)
  assert.ok(!pages.includes('central-london'), 'central London has too few venues for a page')
})

test('area FAQ and summary come from the area venues and stay within limits', { skip }, async () => {
  const { buildAreaContent } = await import('../lib/londonAreaContent.ts')
  const vs = [
    { name: 'A Play', slug: 'a', city_slug: 'london', postcode: 'E3 2PS', avg_rating: 4.7, review_count: 40, toddler_area: true },
    { name: 'B Play', slug: 'b', city_slug: 'london', postcode: 'IG1 1RS', avg_rating: 3.8, review_count: 37, parties: true },
    { name: 'C Play', slug: 'c', city_slug: 'london', postcode: 'RM1 1AU', avg_rating: 5, review_count: 3 },
  ]
  const { summary, faqs } = buildAreaContent('East London', vs)
  assert.match(summary, /^We list 3 soft play centres in East London \(E, IG and RM postcodes\)\. The highest rated with 20\+ reviews is A Play, at 4\.7 from 40 reviews\.$/)
  assert.ok(!faqs.some((f) => /C Play \(5\.0/.test(f.answer)), 'a 3-review venue is not ranked')
  assert.match(faqs.find((f) => /toddler/.test(f.question)).answer, /A Play/)
  assert.match(faqs.find((f) => /party/.test(f.question)).answer, /B Play/)
})
