import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

const v = (over = {}) => ({
  name: 'V', slug: 'v', avg_rating: null, review_count: null,
  toddler_area: false, parties: false, sen_friendly: false,
  price_from: null, price_to: null, opening_hours: null, opening_hours_text: null, last_verified_at: null, ...over,
})

const sample = [
  v({ name: 'Alpha', slug: 'alpha', avg_rating: 4.8, review_count: 300, toddler_area: true, parties: true, price_from: 6.5, price_to: 8, last_verified_at: '2026-04-01', opening_hours_text: 'Monday: 9:00 AM – 5:00 PM' }),
  v({ name: 'Beta', slug: 'beta', avg_rating: 5, review_count: 2, toddler_area: true }),
  v({ name: 'Gamma', slug: 'gamma', avg_rating: 4.4, review_count: 40, sen_friendly: true }),
  v({ name: 'Delta', slug: 'delta' }),
]

test('intro: counts, top rated (20+ reviews only), and a dated price range from the data', { skip }, async () => {
  const { buildCityIntro } = await import('../lib/cityContent.ts')
  const intro = buildCityIntro({ name: 'Testville', county: 'Testshire', slug: 'testville', venues: sample })
  assert.match(intro, /^Testville has 4 soft play centres in our directory: 2 with a toddler area, 1 offering birthday parties and 1 SEN-friendly\./)
  assert.match(intro, /Highest rated \(20\+ reviews\): Alpha 4\.8 \(300 reviews\) and Gamma 4\.4 \(40 reviews\)\./)
  assert.doesNotMatch(intro, /Beta/, 'a 5.0 from 2 reviews is not "highest rated"')
  assert.match(intro, /Published prices run from £6\.50 to £8 at 1 of 4 venues \(checked 1 Apr 2026\)\./)
})

test('intro: no price sentence when no venue publishes a price', { skip }, async () => {
  const { buildCityIntro } = await import('../lib/cityContent.ts')
  const intro = buildCityIntro({ name: 'Testville', county: '', slug: 't', venues: sample.map((x) => ({ ...x, price_from: null, price_to: null })) })
  assert.doesNotMatch(intro, /£|price/i)
})

test('FAQ: 4-6 questions, answered from data, no invented figures', { skip }, async () => {
  const { buildCityFaqs } = await import('../lib/cityContent.ts')
  for (const venues of [sample, sample.slice(3), [sample[3], sample[3]]]) {
    const faqs = buildCityFaqs({ name: 'Testville', county: 'Testshire', slug: 't', venues, nearbyCount: 0 })
    assert.ok(faqs.length >= 4 && faqs.length <= 6, `got ${faqs.length}`)
    for (const f of faqs) {
      assert.ok(f.question.endsWith('?'))
      assert.ok(f.answer.length > 20)
      // any £ amount must be one of the sample's real prices or a figure from the labelled UK-wide guide (lib/typicalCosts.ts)
      for (const m of f.answer.matchAll(/£(\d+(?:\.\d+)?)/g)) assert.ok(['6.50', '6.5', '8', '4', '10', '14', '135', '270'].includes(m[1]), `unexpected price £${m[1]}`)
    }
  }
  assert.deepEqual(buildCityFaqs({ name: 'Empty', county: '', slug: 'e', venues: [] }), [])
})

test('FAQ: with no price data the cost answer uses only the labelled UK-wide guide', { skip }, async () => {
  const { buildCityFaqs } = await import('../lib/cityContent.ts')
  const faqs = buildCityFaqs({ name: 'Testville', county: '', slug: 't', venues: sample.slice(1) })
  const price = faqs.find((f) => /cost/i.test(f.question))
  assert.ok(price)
  assert.match(price.answer, /UK-wide guide \(published venue prices, checked October 2026\)/)
  assert.doesNotMatch(price.answer, /Published prices (run|are)/, 'no city-specific price claim without data')
})

test('parties and opening-hours answers carry the labelled guide too', { skip }, async () => {
  const { buildCityFaqs } = await import('../lib/cityContent.ts')
  const faqs = buildCityFaqs({ name: 'Testville', county: '', slug: 't', venues: [v({ name: 'P', slug: 'p', parties: true })] })
  assert.match(faqs.find((f) => /party/i.test(f.question)).answer, /UK-wide guide.*party typically costs about £10–£14 per child/)
  assert.match(faqs.find((f) => /opening hours/i.test(f.question)).answer, /most soft play centres open around 9:30am/)
})

test('smoothed rating: small samples cannot outrank large ones', { skip }, async () => {
  const { smoothedRating } = await import('../lib/cityStats.ts')
  assert.ok(smoothedRating(4.6, 300) > smoothedRating(5, 2))
  assert.equal(smoothedRating(null, 10), null)
  assert.equal(smoothedRating(4.5, 0), null)
})
