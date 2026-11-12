// The 12 Nov 2026 CTR audit's recommended titles/metas, rebuilt from LIVE-style stats.
// With the audit's counts the output must match its table exactly; with different counts
// it must follow them (never frozen numbers) and respect the length caps.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'

const st = (total, parties, toddler, sen, extra = {}) => ({
  total, parties, toddler, sen, hoursCoverage: 0.8, topRated: [], ...extra,
})

// slug, name, stats, expected title, expected description  (counts as on the live pages, 12 Nov 2026)
const CASES = [
  ['london', 'London', st(63, 13, 5, 2), 'Soft Play Near Me in London: 63 Centres', 'Find 63 soft play centres near you in London, including 13 with birthday parties and 5 with toddler areas. Compare facilities, reviews and hours.'],
  ['birmingham', 'Birmingham', st(76, 9, 5, 1, { hoursCoverage: 0.9 }), 'Soft Play Near Me in Birmingham: 76 Centres', 'Find 76 soft play centres near you in Birmingham: 9 offering birthday parties, 5 with toddler areas and 1 SEN-friendly. Compare reviews and facilities.'],
  ['manchester', 'Manchester', st(45, 6, 4, 0), 'Soft Play Near Me in Manchester: 45 Centres', 'Find 45 soft play centres near you in Manchester, including 6 that offer birthday parties and 4 with toddler areas. Compare reviews and facilities.'],
  ['edinburgh', 'Edinburgh', st(19, 5, 1, 0), 'Soft Play Near Me in Edinburgh: 19 Centres', 'Find 19 soft play centres near you in Edinburgh, including 5 that offer birthday parties and 1 with a toddler area. Compare hours, reviews and facilities.'],
  ['hull', 'Hull', st(19, 6, 6, 3), 'Soft Play Near Me in Hull: 19 Centres', 'Find 19 soft play centres near you in Hull: 6 with toddler areas, 6 offering birthday parties and 3 SEN-friendly. Compare hours, reviews and facilities.'],
  ['liverpool', 'Liverpool', st(47, 3, 1, 0), 'Soft Play Near Me in Liverpool: 47 Centres', 'Find 47 soft play centres near you in Liverpool, including 3 that offer birthday parties and 1 with a toddler area. Compare reviews and facilities.'],
  ['bristol', 'Bristol', st(19, 4, 2, 0), 'Soft Play Near Me in Bristol: 19 Centres', 'Find 19 soft play centres near you in Bristol, including 4 that offer birthday parties and 2 with toddler areas. Compare reviews and facilities.'],
  ['leeds', 'Leeds', st(52, 4, 3, 5), 'Soft Play Near Me in Leeds: 52 Centres', 'Find 52 soft play centres near you in Leeds: 4 offering birthday parties, 3 with toddler areas and 5 SEN-friendly. Compare hours, reviews and facilities.'],
  ['norwich', 'Norwich', st(27, 0, 2, 0), 'Soft Play Near Me in Norwich: 27 Centres', 'Find 27 soft play centres near you in Norwich, including 2 with toddler areas. Compare hours, reviews and facilities for families across Norfolk.'],
  ['stoke', 'Stoke-on-Trent', st(17, 5, 0, 0), 'Soft Play Near Me in Stoke-on-Trent: 17 Centres', 'Find 17 soft play centres near you in Stoke-on-Trent, including 5 that offer birthday parties. Compare hours, reviews and facilities in Staffordshire.'],
  ['swansea', 'Swansea', st(21, 3, 1, 0), 'Soft Play Near Me in Swansea: 21 Centres', 'Find 21 soft play centres near you in Swansea, including 3 that offer birthday parties and 1 with a toddler area. Compare hours, reviews and facilities.'],
  ['glasgow', 'Glasgow', st(21, 7, 0, 0), 'Soft Play Near Me in Glasgow: 21 Centres', 'Find 21 soft play centres near you in Glasgow, including 7 that offer birthday parties. Compare hours, reviews and facilities across the city.'],
  ['nottingham', 'Nottingham', st(51, 8, 2, 0), 'Soft Play Near Me in Nottingham: 51 Centres', 'Find 51 soft play centres near you in Nottingham, with 8 offering birthday parties and 2 with toddler areas. Compare hours, reviews and facilities.'],
  ['sheffield', 'Sheffield', st(32, 2, 1, 0), 'Soft Play Near Me in Sheffield: 32 Centres', 'Find 32 soft play centres near you in Sheffield, including 2 that offer birthday parties and 1 with a toddler area. Compare hours, reviews and facilities.'],
  ['blackpool', 'Blackpool', st(12, 1, 0, 0), 'Soft Play Near Me in Blackpool: 12 Centres', 'Find 12 soft play centres near you in Blackpool, including 1 that offers birthday parties. Compare hours, reviews and facilities on the Fylde coast.'],
  ['beverley', 'Beverley', st(2, 1, 0, 0), 'Soft Play Near Me in Beverley: 2 Centres', 'Find 2 soft play centres near you in Beverley, East Yorkshire, including 1 that offers birthday parties. Compare hours, reviews and facilities.'],
  ['crewe', 'Crewe', st(4, 0, 1, 0, { topRated: [{ name: 'The Play Hut', rating: 4.8 }] }), 'Soft Play Near Me in Crewe: 4 Centres', 'Find 4 soft play centres near you in Crewe, Cheshire, including 1 with a toddler area. Top rated: The Play Hut (4.8★). Compare hours and reviews.'],
  ['halifax', 'Halifax', st(15, 1, 0, 1), 'Soft Play Near Me in Halifax: 15 Centres', 'Find 15 soft play centres near you in Halifax, including 1 that offers birthday parties and 1 SEN-friendly. Compare hours, reviews and facilities.'],
]

for (const [slug, name, stats, title, description] of CASES) {
  test(`override ${slug}: matches the audit's wording at the audit's counts`, { skip }, async () => {
    const { buildOverrideMeta } = await import('../lib/cityMeta.ts')
    const m = buildOverrideMeta(slug, name, stats)
    assert.equal(m.title, title)
    assert.equal(m.description, description)
    assert.ok(m.title.length <= 60 && m.description.length <= 155)
  })
}

test('overrides follow live counts, never frozen ones', { skip }, async () => {
  const { buildOverrideMeta } = await import('../lib/cityMeta.ts')
  const m = buildOverrideMeta('birmingham', 'Birmingham', st(71, 8, 0, 1))
  assert.equal(m.title, 'Soft Play Near Me in Birmingham: 71 Centres')
  assert.match(m.description, /^Find 71 soft play centres near you in Birmingham: 8 offering birthday parties and 1 SEN-friendly\./)
  assert.doesNotMatch(m.description, /toddler/)
})

test('"hours" is claimed only where config allows it and the data backs it', { skip }, async () => {
  const { buildOverrideMeta } = await import('../lib/cityMeta.ts')
  for (const slug of ['birmingham', 'manchester', 'liverpool', 'bristol']) {
    assert.doesNotMatch(buildOverrideMeta(slug, slug, st(10, 1, 1, 1, { hoursCoverage: 1 })).description, /hours/i, `${slug} must not claim hours`)
  }
  assert.doesNotMatch(buildOverrideMeta('hull', 'Hull', st(19, 6, 6, 3, { hoursCoverage: 0.1 })).description, /hours/i)
})

test('unlisted hubs and the guide/benchmark hubs keep the generated copy', { skip }, async () => {
  const { buildOverrideMeta, hasMetaOverride } = await import('../lib/cityMeta.ts')
  for (const slug of ['worthing', 'brighton', 'sunderland', 'dartford', 'leicester', 'lincoln', 'portsmouth', 'southend']) {
    assert.equal(hasMetaOverride(slug), false)
    assert.equal(buildOverrideMeta(slug, slug, st(10, 1, 1, 1)), null)
  }
})

test('Glasgow never names the Paisley venue; an overlong description drops facts, not words', { skip }, async () => {
  const { buildOverrideMeta } = await import('../lib/cityMeta.ts')
  const g = buildOverrideMeta('glasgow', 'Glasgow', st(21, 7, 0, 0, { topRated: [{ name: 'Adventure Planet Paisley', rating: 4.9 }] }))
  assert.doesNotMatch(g.description, /Paisley/)
  const long = buildOverrideMeta('stoke', 'Stoke-on-Trent', st(1234, 5, 0, 0))
  assert.ok(long.description.length <= 155)
})
