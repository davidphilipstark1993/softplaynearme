import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

test('hub pagination: self-canonical paths, page counts, link window', { skip }, async () => {
  const { totalPagesFor, hubPagePath, parsePageParam, pageWindow, VENUES_PER_PAGE } = await import('../lib/pagination.ts')
  assert.equal(VENUES_PER_PAGE, 24)
  assert.equal(totalPagesFor(0), 1)
  assert.equal(totalPagesFor(24), 1)
  assert.equal(totalPagesFor(25), 2)
  assert.equal(hubPagePath('hull', 1), '/soft-play/hull')
  assert.equal(hubPagePath('hull', 3), '/soft-play/hull?page=3')
  assert.equal(parsePageParam(undefined), 1)
  assert.equal(parsePageParam('0'), 1)
  assert.equal(parsePageParam('abc'), 1)
  assert.equal(parsePageParam('4'), 4)
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3])
  assert.deepEqual(pageWindow(5, 10), [1, null, 3, 4, 5, 6, 7, null, 10])
})

const venue = (name, rating, reviews) => ({ name, slug: name.toLowerCase().replace(/\W+/g, '-'), avg_rating: rating, review_count: reviews })

test('filter pages get unique, data-driven titles/descriptions/intros', { skip }, async () => {
  const { buildFilterMeta } = await import('../lib/filterMeta.ts')
  const hull = [venue('Big Fun', 4.2, 1471), venue('Fluke', 5, 2), venue('Little Astronauts', 4.6, 334), venue('Hull Adventure', 4.8, 362), venue('Quiet', 4.5, 30)]
  const a = buildFilterMeta('toddler', 'Hull', 'East Yorkshire', hull, 20)
  const b = buildFilterMeta('toddler', 'Leeds', 'West Yorkshire', hull.slice(0, 2), 55)
  assert.equal(a.title, 'Toddler Soft Play in Hull: 5 Venues | Soft Play Near Me')
  assert.notEqual(a.title, b.title)
  assert.notEqual(a.description, b.description)
  assert.match(a.description, /including Hull Adventure, Little Astronauts and Quiet\./)
  assert.doesNotMatch(a.description + a.intro, /Fluke/, 'a 5.0 from 2 reviews is never quoted as a top venue')
  assert.match(a.intro, /^5 of Hull's 20 soft play centres have a dedicated toddler area\./)
  assert.ok(a.description.length <= 155)
  const none = buildFilterMeta('birthday-parties', 'Hull', 'East Yorkshire', [], 20)
  assert.equal(none.title, 'Soft Play Birthday Parties in Hull | Soft Play Near Me')
  const one = buildFilterMeta('sen-friendly', 'Beverley', 'East Yorkshire', [venue('Solo', 4.5, 50)], 2)
  assert.match(one.title, /1 Venue( \| Soft Play Near Me)?$/)
  assert.ok(one.title.length <= 60)
  assert.match(one.intro, /^1 of Beverley's 2 soft play centres is listed as SEN-friendly\./)
})

test('legacy /search?filters= links fold into the structured params', { skip }, async () => {
  const { mergeLegacyFilters, hasSearchQuery } = await import('../lib/searchFilters.ts')
  const m = mergeLegacyFilters(new URLSearchParams('q=HU1+1AA&filters=toddler,sen,open_now&facilities=cafe'))
  assert.equal(m.get('filters'), null)
  assert.equal(m.get('age'), 'toddler')
  assert.equal(m.get('facilities'), 'cafe,sen')
  assert.equal(m.get('special'), 'open-now')
  assert.equal(mergeLegacyFilters(new URLSearchParams('age=toddler')).get('age'), 'toddler')
  assert.equal(hasSearchQuery({}), false)
  assert.equal(hasSearchQuery({ filters: 'toddler' }), true)
  assert.equal(hasSearchQuery({ q: undefined }), false)
})
