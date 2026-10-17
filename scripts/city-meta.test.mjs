// Titles/descriptions may only promise what the data backs up.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = process.features.typescript !== false && Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

const mk = (over = {}) => ({
  name: 'V', slug: 'v', avg_rating: 4.5, review_count: 50,
  toddler_area: false, baby_area: false, sen_friendly: false, parties: false,
  price_from: null, opening_hours: null, opening_hours_text: null, ...over,
})

test('no price data -> no "Prices" in title or description', { skip }, async () => {
  const { computeCityStats } = await import('../lib/cityStats.ts')
  const { buildCityMeta } = await import('../lib/cityMeta.ts')
  const venues = Array.from({ length: 10 }, (_, i) => mk({ slug: `v${i}`, opening_hours_text: 'Monday: 9:00 AM – 5:00 PM' }))
  const { title, description } = buildCityMeta('Hull', 'East Yorkshire', computeCityStats(venues))
  assert.doesNotMatch(title + description, /price/i)
  assert.match(title, /^Soft Play in Hull: 10 Centres/)
})

test('"Prices" returns once at least half the venues publish one', { skip }, async () => {
  const { computeCityStats } = await import('../lib/cityStats.ts')
  const { buildCityMeta } = await import('../lib/cityMeta.ts')
  const venues = Array.from({ length: 10 }, (_, i) => mk({ slug: `v${i}`, price_from: i < 5 ? 6 : null }))
  assert.match(buildCityMeta('Hull', '', computeCityStats(venues)).title, /Prices/)
  const fewer = Array.from({ length: 10 }, (_, i) => mk({ slug: `v${i}`, price_from: i < 4 ? 6 : null }))
  assert.doesNotMatch(buildCityMeta('Hull', '', computeCityStats(fewer)).title, /Prices/)
})

test('top rated needs 20+ reviews: a 5.0 from 2 reviews never ranks', { skip }, async () => {
  const { rankTopRated } = await import('../lib/cityStats.ts')
  const ranked = rankTopRated([
    mk({ name: 'Fluke', slug: 'fluke', avg_rating: 5, review_count: 2 }),
    mk({ name: 'Solid', slug: 'solid', avg_rating: 4.4, review_count: 300 }),
    mk({ name: 'Edge', slug: 'edge', avg_rating: 4.6, review_count: 20 }),
    mk({ name: 'Short', slug: 'short', avg_rating: 4.9, review_count: 19 }),
  ])
  assert.deepEqual(ranked.map((v) => v.name), ['Edge', 'Solid'])
})

test('a county that repeats the city name is not repeated', { skip }, async () => {
  const { computeCityStats } = await import('../lib/cityStats.ts')
  const { buildCityDescription } = await import('../lib/cityMeta.ts')
  const d = buildCityDescription('London', 'Greater London', computeCityStats([mk()]))
  assert.doesNotMatch(d, /London, Greater London/)
})

test('"hours" claims only count venues that have hours; todayHoursLabel is faithful', { skip }, async () => {
  const { todayHoursLabel, hasOpeningHours } = await import('../lib/venueFacts.ts')
  const monday = { dayKey: 'monday', minutes: 600 }
  assert.equal(hasOpeningHours({}), false)
  assert.equal(todayHoursLabel({}, monday), null)
  assert.equal(todayHoursLabel({ opening_hours_text: 'Monday: 9:30 AM – 3:00 PM | Tuesday: Closed' }, monday), 'Today 9:30am–3pm')
  assert.equal(todayHoursLabel({ opening_hours_text: 'Monday: 9:30 AM – 3:00 PM | Tuesday: Closed' }, { dayKey: 'tuesday', minutes: 0 }), 'Closed today')
  assert.equal(todayHoursLabel({ opening_hours: { monday: { open: '09:30', close: '17:00' } } }, monday), 'Today 9:30am–5pm')
  assert.equal(todayHoursLabel({ opening_hours_text: 'Sunday 9:00; Saturday 9:00' }, monday), 'Opening hours listed')
})
