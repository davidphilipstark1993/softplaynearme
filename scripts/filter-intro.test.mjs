// lib/filterIntro.ts (category pages from their own venues) and lib/introClaims.ts
// (hub intro sentences the hub's data contradicts are dropped).
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

registerTsResolver()

const V = (name, o = {}) => ({ name, ...o })

test('toddler page: names the venues and only states what they confirm', async () => {
  const { buildFilterSections } = await import('../lib/filterIntro.ts')
  const venues = [
    V('Tots', { toddler_area: true, baby_area: true, cafe: true, age_range_min: 0, age_range_max: 5, avg_rating: 4.8, review_count: 300, area: 'Headingley' }),
    V('Jungle', { toddler_area: true, cafe: true, price_from: 6.5, avg_rating: 4.5, review_count: 90, area: 'Morley' }),
    V('Den', { toddler_area: true, area: 'Morley' }),
  ]
  const s = buildFilterSections('toddler', 'Leeds', venues, 40)
  assert.equal(s.intro, '3 of the 40 soft play venues we list in Leeds have a dedicated toddler area: Tots, Jungle and Den.')
  assert.deepEqual(s.details, [
    'Tots also has a separate baby area.',
    'Ages listed: Tots up to 5.',
    'Tots and Jungle have a café.',
    'Entry prices we hold: Jungle from £6.50.',
    'By area: 2 in Morley, 1 in Headingley.',
    'Best rated by Google reviewers: Tots (4.8 from 300 Google reviews), Jungle (4.5 from 90 Google reviews).',
  ])
  assert.ok(s.faqs.every((f) => !/not confirmed|ask the venue|check/i.test(f.answer)))
})

test('two cities with the same data shape share no sentence beyond venue/city names', async () => {
  const { buildFilterSections } = await import('../lib/filterIntro.ts')
  const a = buildFilterSections('birthday-parties', 'York', [V('A', { parties: true, has_party_rooms: true }), V('B', { parties: true })], 10)
  const b = buildFilterSections('birthday-parties', 'Hull', [V('C', { parties: true }), V('D', { parties: true, cafe: true })], 20)
  assert.notDeepEqual(a.details, b.details)
  assert.match(a.details[0], /^A has its own party rooms\.$/)
})

test('hub intro: contradicted claims dropped, honest UK-wide guide kept', async () => {
  const { dropUnsupportedClaims } = await import('../lib/introClaims.ts')
  const intro = 'Soft play in Grimsby is popular. Many soft play centres in Grimsby run dedicated SEN-friendly sessions with reduced noise. Expect to pay £5–£9 per child.\n\nAs a UK-wide guide (published venue prices, checked October 2026), a play session typically costs about £4–£8 per child. Some venues also run specific toddler sessions.'
  const none = { sen: 0, toddler: 0, baby: 0, parties: 0, withPrice: 0 }
  assert.equal(dropUnsupportedClaims(intro, none), 'Soft play in Grimsby is popular.\n\nAs a UK-wide guide (published venue prices, checked October 2026), a play session typically costs about £4–£8 per child.')
  const all = { sen: 2, toddler: 3, baby: 1, parties: 4, withPrice: 2 }
  assert.equal(dropUnsupportedClaims(intro, all), intro)
})
