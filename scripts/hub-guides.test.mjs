import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

const v = (name, postcode, over = {}) => ({
  name, slug: name.toLowerCase().replace(/\W+/g, '-'), postcode, avg_rating: null, review_count: null,
  toddler_area: false, baby_area: false, parties: false, sen_friendly: false, ...over,
})

const BHAM = [
  v('Alpha Play', 'B13 8AA', { avg_rating: 4.8, review_count: 300, toddler_area: true, parties: true }),
  v('Beta Play', 'B29 6AA', { avg_rating: 5, review_count: 2, toddler_area: true }),
  v('Gamma Play', 'B13 9ZZ', { avg_rating: 4.4, review_count: 40, sen_friendly: true, parties: true }),
  v('Delta Play', 'B15 1AA', { baby_area: true }),
  v('Party and Play Glasgow', 'G1 1AA', { avg_rating: 4.9, review_count: 2588, parties: true, toddler_area: true }),
  v('No Postcode Fun', null, { avg_rating: 4.9, review_count: 500, parties: true }),
]

test('data guide: counts and lists come from the venues, with links and districts', { skip }, async () => {
  const { buildDataGuide } = await import('../lib/hubGuides.ts')
  const g = buildDataGuide('birmingham', 'Birmingham', BHAM, { slug: 'best-soft-play-in-birmingham', title: 'Best soft play in Birmingham' })
  assert.equal(g.kind, 'listings')
  const text = g.sections.flatMap((s) => [s.heading, ...s.paragraphs]).join('\n')
  assert.match(text, /We list 6 soft play centres in Birmingham/)
  assert.match(text, /\[Alpha Play\]\(\/soft-play\/birmingham\/alpha-play\) \(B13\)/)
  assert.match(text, /\[Best soft play in Birmingham\]\(\/blog\/best-soft-play-in-birmingham\)/)
  assert.ok(g.sections.some((s) => s.heading === 'Birthday parties'))
  assert.ok(g.sections.some((s) => s.heading === 'SEN-friendly soft play'))
})

test('data guide: a venue filed under the wrong city is counted but never named', { skip }, async () => {
  const { buildDataGuide } = await import('../lib/hubGuides.ts')
  const g = buildDataGuide('birmingham', 'Birmingham', BHAM)
  const text = g.sections.flatMap((s) => s.paragraphs).join('\n')
  assert.doesNotMatch(text, /Glasgow|No Postcode Fun/)
  assert.match(text, /venues in Birmingham's own postcodes are listed as offering birthday parties/, 'says so when the named venues are only some of the hub')
})

test('data guide: highest rated needs 20+ reviews; no prices, hours or invented figures', { skip }, async () => {
  const { buildDataGuide } = await import('../lib/hubGuides.ts')
  const g = buildDataGuide('birmingham', 'Birmingham', BHAM)
  const rated = g.sections.find((s) => s.heading === 'Highest rated').paragraphs[0]
  assert.match(rated, /Alpha Play\]\([^)]*\) 4\.8 from 300 reviews/)
  assert.doesNotMatch(rated, /Beta Play/, 'a 5.0 from 2 reviews is not "highest rated"')
  const all = g.sections.flatMap((s) => s.paragraphs).join(' ')
  assert.doesNotMatch(all, /£|open(s|ing)? (at|from|daily)|\d+\s*(am|pm)\b/i)
})

test('data guide: London gets a by-area section using lib/londonAreas.ts prefixes', { skip }, async () => {
  const { buildDataGuide } = await import('../lib/hubGuides.ts')
  const venues = [v('A', 'E17 4AA'), v('B', 'E2 8AA'), v('C', 'SE5 0AA'), v('D', 'N1 9AA'), v('E', 'SW4 0AA', { toddler_area: true })]
  const g = buildDataGuide('london', 'London', venues)
  const areas = g.sections.find((s) => s.heading === 'Soft play in London by area').paragraphs.join('\n')
  assert.match(areas, /^East London \(E\): 2 centres, including/m)
  assert.match(areas, /^South East London \(SE\): 1 centre, including/m)
  assert.match(areas, /^North London \(N\): 1 centre/m)
})

test('data guide: only the listed hubs, and not for tiny hubs', { skip }, async () => {
  const { buildDataGuide, hasDataGuide, getHubGuide, minFilterVenues } = await import('../lib/hubGuides.ts')
  for (const slug of ['london', 'birmingham', 'manchester', 'edinburgh', 'hull', 'liverpool', 'bristol', 'leeds', 'swansea', 'glasgow', 'sheffield']) assert.ok(hasDataGuide(slug), slug)
  for (const slug of ['stoke', 'norwich', 'beverley', 'crewe', 'halifax', 'nottingham', 'blackpool', 'worthing', 'brighton']) assert.equal(hasDataGuide(slug), false, slug)
  assert.equal(buildDataGuide('hull', 'Hull', BHAM.slice(0, 3)), undefined)
  assert.equal(getHubGuide('hull'), undefined, 'hand-verified registry is untouched')
  assert.equal(minFilterVenues('hull'), 1, 'filter-page indexing rules are unchanged for these hubs')
  assert.equal(minFilterVenues('worthing'), 2)
})
