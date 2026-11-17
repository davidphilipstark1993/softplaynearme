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
  for (const slug of ['london', 'birmingham', 'manchester', 'edinburgh', 'liverpool', 'bristol', 'leeds', 'swansea', 'glasgow', 'sheffield']) assert.ok(hasDataGuide(slug), slug)
  for (const slug of ['stoke', 'norwich', 'beverley', 'crewe', 'halifax', 'nottingham', 'blackpool', 'worthing', 'brighton', 'hull']) assert.equal(hasDataGuide(slug), false, slug)
  assert.equal(buildDataGuide('hull', 'Hull', BHAM.slice(0, 3)), undefined)
  assert.equal(getHubGuide('stoke'), undefined, 'a hub without a written guide has none')
  assert.equal(minFilterVenues('stoke'), 1, 'filter-page indexing rules are unchanged for hubs without a written guide')
  assert.equal(minFilterVenues('hull'), 2, 'a written-guide hub needs 2 venues for a category page')
  assert.equal(minFilterVenues('worthing'), 2)
})

// ── Brighton & Worthing (hand-written guide hubs) ──────────────────────────────────────

test('guide hubs: title "Soft Play in {Area}: N Indoor Play Centres (year)" within 60 chars', { skip }, async () => {
  const { buildGuideTitle, getHubGuide } = await import('../lib/hubGuides.ts')
  const b = buildGuideTitle(getHubGuide('brighton').areaName, 6, 2026)
  assert.equal(b, 'Soft Play in Brighton & Hove: 6 Indoor Play Centres (2026)')
  assert.ok(b.length <= 60)
  assert.equal(buildGuideTitle('Worthing', 3, 2026), 'Soft Play in Worthing: 3 Indoor Play Centres (2026)')
  assert.equal(buildGuideTitle('Worthing', 1, 2026), 'Soft Play in Worthing: 1 Indoor Play Centre (2026)')
})

test('guide hubs: FAQ covers cheapest, toddlers, open late, SEN, parties and trampolines; max 7', { skip }, async () => {
  const { getHubGuide, composeGuideFaqs, MAX_FAQS } = await import('../lib/hubGuides.ts')
  const generic = [
    { question: 'How many soft play centres are there in X?', answer: 'n' },
    { question: 'Which soft play centres in X are the best rated?', answer: 'n' },
    { question: 'Is there soft play for toddlers in X?', answer: 'n' },
    { question: 'Can I book a birthday party at soft play in X?', answer: 'n' },
    { question: 'Is there SEN-friendly soft play in X?', answer: 'n' },
    { question: 'How much does soft play cost in X?', answer: 'n' },
  ]
  for (const city of ['brighton', 'worthing']) {
    const faqs = composeGuideFaqs(getHubGuide(city), generic)
    const qs = faqs.map((f) => f.question).join(' | ')
    assert.ok(faqs.length <= MAX_FAQS, `${city}: ${faqs.length}`)
    assert.equal(new Set(faqs.map((f) => f.question.toLowerCase())).size, faqs.length, `${city}: duplicate question`)
    for (const topic of [/^How many/m, /cheapest|cost/i, /toddler/i, /open late/i, /SEN/, /part(y|ies)/i, /trampoline/i]) {
      assert.match(qs, topic, `${city} FAQ has no ${topic} question`)
    }
    for (const f of getHubGuide(city).faqs) assert.ok(f.answer.length > 40, `${city}: thin answer to ${f.question}`)
  }
})

test('guide hubs: no links to the merged Brighton blog post; Worthing guide no longer lists Flying Fortress as local', { skip }, async () => {
  const { getHubGuide } = await import('../lib/hubGuides.ts')
  const fs = await import('node:fs')
  for (const city of ['brighton', 'worthing']) {
    const g = getHubGuide(city)
    const text = JSON.stringify(g)
    assert.ok(!text.includes('best-soft-play-in-brighton'), city)
  }
  assert.ok(!fs.readFileSync(new URL('../lib/blogPostsSussex.ts', import.meta.url), 'utf8').includes('best-soft-play-in-brighton'))
  assert.ok(!JSON.stringify(getHubGuide('worthing')).includes('/soft-play/worthing/flying-fortress'))
  assert.ok(JSON.stringify(getHubGuide('brighton')).includes('Trampoline parks in Brighton'))
})

test('guide hubs: every link in a guide goes to a live venue, hub or blog post (no redirects)', { skip }, async () => {
  const { getHubGuide } = await import('../lib/hubGuides.ts')
  const fs = await import('node:fs')
  const read = (f) => JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))
  const venues = new Set(read('data/generated/venues.json').map((v) => `/soft-play/${v.townSlug}/${v.slug}`))
  const hubs = new Set(read('data/generated/towns.json').map((t) => `/soft-play/${t.slug}`))
  const redirects = new Set(read('data/redirects.json').map((r) => r.source))
  const { blogPosts } = await import('../lib/blogPosts.ts')
  const posts = new Set(blogPosts.map((p) => `/blog/${p.slug}`))
  for (const city of ['brighton', 'worthing', 'hull', 'nottingham', 'birmingham', 'liverpool', 'blackpool']) {
    const g = getHubGuide(city)
    const text = [...g.sections.flatMap((s) => s.paragraphs), ...g.faqs.map((f) => f.answer)].join(' ')
    for (const [, href] of text.matchAll(/\]\((\/[^)]+)\)/g)) {
      assert.ok(!redirects.has(href), `${city}: ${href} is redirected`)
      assert.ok(venues.has(href) || hubs.has(href) || posts.has(href), `${city}: ${href} is not a live page`)
    }
  }
})
