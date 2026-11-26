// National category hubs (lib/categoryHubs.ts), Phase 5.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = process.features.typescript !== false && Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

const v = (o) => ({ slug: o.name.toLowerCase().replace(/\W+/g, '-'), city_slug: 'leeds', ...o })

test('hub matching uses only what we hold: flags, stated ages, the venue’s own name', { skip }, async () => {
  const { HUBS, isPlayCafeName } = await import('../lib/categoryHubs.ts')
  assert.ok(isPlayCafeName('The Square Play Cafe'))
  assert.ok(!isPlayCafeName('Little Big Village (Children’s Role Play and Café)'))
  assert.ok(isPlayCafeName('Wild Ones Play Café'))
  assert.ok(!isPlayCafeName('Rainbow Soft Play & Cafe'))
  assert.ok(isPlayCafeName('Lemon Tree Softplay Cafe'))
  assert.ok(isPlayCafeName('Littleville Role Play Cafe'))
  assert.ok(!isPlayCafeName('Fun Valley Nottingham'))
  assert.ok(HUBS['toddler-soft-play'].matches(v({ name: 'A', toddler_area: true })))
  assert.ok(HUBS['toddler-soft-play'].matches(v({ name: 'B', age_range_min: 0, age_range_max: 6 })))
  assert.ok(!HUBS['toddler-soft-play'].matches(v({ name: 'C', age_range_min: 0, age_range_max: 11 })))
  assert.ok(!HUBS['toddler-soft-play'].matches(v({ name: 'D', toddler_area: false })))
  assert.ok(HUBS['sen-soft-play'].matches(v({ name: 'E', has_sen_sessions: true })))
  assert.equal(HUBS['sen-soft-play'].reason(v({ name: 'E', has_sen_sessions: true })), 'SEN sessions')
  assert.ok(!HUBS['soft-play-parties'].matches(v({ name: 'F', parties: null })))
})

test('grouping: known regions in order, Yorkshire folded in, cities by size, venues by rating', { skip }, async () => {
  const { groupHubVenues } = await import('../lib/categoryHubs.ts')
  const info = { leeds: { name: 'Leeds', region: 'Yorkshire' }, york: { name: 'York', region: 'Yorkshire and the Humber' }, london: { name: 'London', region: 'London' } }
  const groups = groupHubVenues([
    v({ name: 'Low', rating: 4.1 }), v({ name: 'High', rating: 4.9 }), v({ name: 'Y1', city_slug: 'york' }),
    v({ name: 'L1', city_slug: 'london' }), v({ name: 'Nowhere', city_slug: 'atlantis' }),
  ], (s) => info[s])
  assert.deepEqual(groups.map((g) => g.region), ['London', 'Yorkshire and the Humber'])
  assert.deepEqual(groups[1].cities.map((c) => c.cityName), ['Leeds', 'York'])
  assert.deepEqual(groups[1].cities[0].venues.map((x) => x.name), ['High', 'Low'])
})

test('FAQ answers are computed from the listed venues', { skip }, async () => {
  const { HUBS, hubFaqs } = await import('../lib/categoryHubs.ts')
  const venues = [1, 2, 3, 4, 5].map((i) => v({ name: `V${i}`, price_from: i * 2, prebooking_required: i === 1, cafe: i < 3, age_range_min: 0, age_range_max: 4 + i }))
  const faqs = hubFaqs(HUBS['toddler-soft-play'], venues, 2)
  assert.ok(!hubFaqs(HUBS['soft-play-parties'], venues, 2).some((f) => /cost/.test(f.question)), 'parties: entry prices are not party prices')
  const text = faqs.map((f) => f.answer).join(' ')
  assert.match(text, /lists 5 venues across 2 UK towns/)
  assert.match(text, /from £2\.00 to £10\.00/)
  assert.match(text, /upper age limits run from 5 to 9/)
  assert.match(text, /1 of the 5 venues listed here says you need to book/)
  assert.match(text, /2 of the 5 venues .* confirmed café/)
  // too few prices: no price question at all rather than a weak claim
  assert.ok(!hubFaqs(HUBS['toddler-soft-play'], venues.slice(0, 2), 1).some((f) => /cost/.test(f.question)))
})
