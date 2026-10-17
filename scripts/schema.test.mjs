import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

const base = { name: 'Our Imagination Station', address: '6 Ferriby Rd', city: 'Hessle', postcode: 'HU13 0PQ', citySlug: 'hull', venueSlug: 'our-imagination-station', venueType: 'indoor' }

test('venue schema: home town, numeric geo, no hours/rating unless known', { skip }, async () => {
  const { buildLocalBusinessSchema } = await import('../lib/schema.ts')
  const s = buildLocalBusinessSchema({ ...base, lat: '53.7227827', lng: '-0.4385964', phone: '01482 205667' })
  assert.equal(s['@type'], 'EntertainmentBusiness')
  assert.equal(s.address.addressLocality, 'Hessle')
  assert.deepEqual(s.geo, { '@type': 'GeoCoordinates', latitude: 53.7227827, longitude: -0.4385964 })
  assert.equal(s.telephone, '01482 205667')
  assert.equal(s.openingHoursSpecification, undefined)
  assert.equal(s.aggregateRating, undefined)
  assert.equal(s.priceRange, undefined)
  assert.equal(s.publisher, undefined, 'publisher is a CreativeWork property, not valid on a business')
})

test('venue schema: opening hours and rating appear only when passed', { skip }, async () => {
  const { buildLocalBusinessSchema } = await import('../lib/schema.ts')
  const s = buildLocalBusinessSchema({
    ...base,
    openingHours: { monday: { open: '09:30', close: '17:00' }, tuesday: 'closed' },
    avgRating: 4.64,
    reviewCount: 12,
  })
  assert.equal(s.openingHoursSpecification.length, 1)
  assert.equal(s.openingHoursSpecification[0].opens, '09:30')
  assert.equal(s.aggregateRating.ratingValue, '4.6')
  assert.equal(s.aggregateRating.reviewCount, 12)
})

test('venue schema: coordinates of 0 or junk are dropped, not emitted', { skip }, async () => {
  const { buildLocalBusinessSchema } = await import('../lib/schema.ts')
  assert.equal(buildLocalBusinessSchema({ ...base, lat: 0, lng: 0 }).geo, undefined)
  assert.equal(buildLocalBusinessSchema({ ...base, lat: 'abc', lng: '-1' }).geo, undefined)
})

test('city ItemList: url + name + position per venue, positions continue across pages, no ratings', { skip }, async () => {
  const { buildItemListSchema } = await import('../lib/schema.ts')
  const venues = [
    { name: 'A', slug: 'a', citySlug: 'hull', address: '1 High St', postcode: 'HU1 1AA', avgRating: 4.5, reviewCount: 100 },
    { name: 'B', slug: 'b', citySlug: 'hull' },
  ]
  const list = buildItemListSchema(venues, 'Soft Play Centres in Hull', 24)
  assert.deepEqual(list.itemListElement.map((i) => i.position), [25, 26])
  assert.equal(list.itemListElement[0].url, 'https://www.softplaynearme.co.uk/soft-play/hull/a')
  assert.equal(list.itemListElement[0].name, 'A')
  assert.equal(list.itemListElement[0].item['@id'], 'https://www.softplaynearme.co.uk/soft-play/hull/a#business')
  assert.equal(JSON.stringify(list).includes('aggregateRating'), false)
  assert.equal(buildItemListSchema([], 'x'), null)
})

test('breadcrumb and FAQ builders', { skip }, async () => {
  const { buildBreadcrumbSchema, buildFAQSchema } = await import('../lib/schema.ts')
  const b = buildBreadcrumbSchema([{ name: 'Home', url: 'https://x/' }, { name: 'Hull' }])
  assert.deepEqual(b.itemListElement.map((i) => i.position), [1, 2])
  assert.equal(b.itemListElement[1].item, undefined)
  assert.equal(buildFAQSchema([]), null)
  assert.equal(buildFAQSchema([{ question: 'q?', answer: 'a' }]).mainEntity[0].acceptedAnswer.text, 'a')
})
