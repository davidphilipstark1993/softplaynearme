// lib/venueSummary.ts: About text and FAQs built only from facts we hold and show.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

registerTsResolver()
const base = { name: 'Funhouse', kind: 'soft play centre', address: 'Unit 4, Mill Lane, Hessle HU13 0AA', town: 'Hessle' }

test('a venue with no facts gets the short version: what and where, nothing invented', async () => {
  const { buildVenueSummary, buildVenueFaqs, summaryFactCount } = await import('../lib/venueSummary.ts')
  const out = buildVenueSummary({ ...base, cafe: false, parking: false })
  assert.deepEqual(out, ['Funhouse is a soft play centre on Mill Lane in Hessle.'])
  assert.equal(summaryFactCount(base), 0)
  assert.deepEqual(buildVenueFaqs(base), [], 'no "not confirmed" FAQ answers')
  const text = out.join(' ')
  for (const banned of [/£/, /price/i, /hours/i, /review/i, /check/i, /not confirmed/i]) assert.doesNotMatch(text, banned)
})

test('each fact adds one plain sentence; ratings and nearby venues come from what the page lists', async () => {
  const { buildVenueSummary } = await import('../lib/venueSummary.ts')
  const [first, second] = buildVenueSummary({
    ...base, cafe: true, freeParking: true, parking: true, toddlerArea: true, babyArea: true, ageMin: 0, ageMax: 8,
    priceFrom: 6.5, parties: true, partyRooms: true, senSessions: true, rating: 4.6, reviewCount: 1234,
    nearby: [{ name: 'Jungle Jim', miles: 1.24, area: 'Anlaby' }, { name: 'B', miles: 2 }, { name: 'C', miles: 3 }],
  })
  assert.equal(first, 'Funhouse is a soft play centre on Mill Lane in Hessle. It has a toddler area and a separate baby area, a café and free parking. It is for children up to age 8. Entry is from £6.50 per child. It runs sessions for children with SEN and hosts birthday parties in its own party rooms.')
  assert.equal(second, 'Google reviewers rate it 4.6 out of 5 from 1,234 reviews. The closest other soft play is Jungle Jim in Anlaby, 1.2 miles away. 2 more are within 5 miles.')
})

test('no address: town only; street parsing skips units and postcodes', async () => {
  const { buildVenueSummary, streetOf } = await import('../lib/venueSummary.ts')
  assert.equal(buildVenueSummary({ ...base, address: '' })[0], 'Funhouse is a soft play centre in Hessle.')
  assert.equal(streetOf('8a, The Quarter, Lower Hall Ln, Walsall WS1 1RL', 'Walsall'), 'The Quarter')
  assert.equal(streetOf('HU13 0AA', 'Hessle'), null)
  assert.equal(streetOf('12 High Street, Hessle', 'Hessle'), 'High Street')
})

test('FAQs only for confirmed facts', async () => {
  const { buildVenueFaqs } = await import('../lib/venueSummary.ts')
  const faqs = buildVenueFaqs({ ...base, cafe: true, parties: true })
  assert.deepEqual(faqs.map((f) => f.question), ['Can you book a birthday party at Funhouse?', 'Is there a café at Funhouse?'])
  assert.ok(faqs.every((f) => /^Yes/.test(f.answer)))
})
