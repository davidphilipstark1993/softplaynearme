// scripts/enrichment/extract.mjs: narrow, evidence-backed fact candidates.
import test from 'node:test'
import assert from 'node:assert/strict'
import { extractFacts, ageRange, childPrice, pageText, interestingLinks, robotsDisallows } from './enrichment/extract.mjs'

const fields = (text) => Object.fromEntries(extractFacts(text, 'https://example.co.uk/').map((c) => [c.field, c.value]))

test('specific phrases only: a lone "park", "food" or "accessible" is not a fact', () => {
  assert.deepEqual(fields('Near the park. We love food. Our website is accessible. Send us an email.'), {})
  assert.deepEqual(fields('We have a separate toddler area and a baby zone. Our café serves hot food. Free parking on site.'),
    { toddler_area: true, baby_area: true, cafe: true, free_parking: true })
  assert.equal(fields('SEN sessions run every Sunday morning.').has_sen_sessions, true)
  assert.equal(fields('We are a sensory-friendly venue.').has_sen_sessions, undefined)
})

test('every candidate carries its evidence sentence and source URL', () => {
  const [c] = extractFacts('Book your party with us! Birthday parties from £12 per head.', 'https://ex.co.uk/parties')
  assert.equal(c.field, 'parties')
  assert.match(c.evidence, /Book your party/)
  assert.equal(c.source_url, 'https://ex.co.uk/parties')
})

test('ages and child entry prices', () => {
  assert.deepEqual(ageRange('For children aged 0–8 years.'), { min: 0, max: 8 })
  assert.deepEqual(ageRange('Suitable for kids under 11'), { min: 0, max: 10 })
  assert.equal(ageRange('Open 9-5'), null)
  assert.equal(childPrice('Child entry (off-peak): £5.50, peak £7'), 5.5)
  assert.equal(childPrice('Party packages from £14.95 per child'), null, 'party prices are not entry prices')
  assert.equal(childPrice('Adults £2, coffee £3'), null)
})

test('page text, follow-up links and robots.txt', () => {
  assert.equal(pageText('<nav>Menu</nav><p>Hello&nbsp;there</p><script>x()</script><p>£5 &amp; up</p>'), 'Hello there\n£5 & up')
  const links = interestingLinks('<a href="/prices">Prices</a><a href="https://other.com/party">x</a><a href="/parties">Parties</a><a href="/blog">Blog</a><a href="/menu.pdf">Prices</a>', 'https://ex.co.uk/')
  assert.deepEqual(links, ['https://ex.co.uk/prices', 'https://ex.co.uk/parties'])
  const robots = 'User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: BadBot\nDisallow: /'
  assert.equal(robotsDisallows(robots, '/private/x'), true)
  assert.equal(robotsDisallows(robots, '/private/ok/page'), false)
  assert.equal(robotsDisallows(robots, '/prices'), false)
  assert.equal(robotsDisallows('User-agent: SoftPlayDirectoryBot\nDisallow: /', '/'), true)
})
