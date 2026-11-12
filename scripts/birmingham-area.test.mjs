// Birmingham-area sweep, 12 Nov 2026: the review SQL, the new hubs, the static export and the 301s must agree.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (p) => fs.readFileSync(p, 'utf8')
const json = (p) => JSON.parse(read(p))
const sqlDir = 'scripts/sql/birmingham-area-2026-11-12'
const retagSql = read(`${sqlDir}/02-retag-after-hubs.sql`)
const emailSql = read(`${sqlDir}/01-official-emails.sql`)
const cities = json('data/cities.json')
const hubSlugs = new Set(cities.map((c) => c.slug))
const venues = json('data/generated/venues.json')
const redirects = json('data/redirects.json')

const retags = [...retagSql.matchAll(/UPDATE venues SET city_slug = '([a-z-]+)'[^;]*?WHERE id IN \(([\d, ]+)\) AND city_slug = '([a-z]+)';/g)]
  .map(([, to, ids, from]) => ({ to, from, ids: ids.split(',').map((s) => Number(s.trim())) }))

test('the review SQL rolls back by default and only retags onto hubs that exist', () => {
  for (const f of [retagSql, emailSql]) {
    assert.match(f, /^ROLLBACK;$/m)
    assert.match(f, /^-- COMMIT;$/m)
    assert.doesNotMatch(f, /^COMMIT;$/m)
  }
  assert.ok(retags.length >= 24)
  for (const r of retags) assert.ok(hubSlugs.has(r.to), `${r.to} must be a hub before it is retagged onto`)
})

test('every active venue the SQL retags is filed under that hub in the static export', () => {
  const byId = new Map(venues.map((v) => [v.id, v]))
  for (const r of retags) for (const id of r.ids) {
    const v = byId.get(id)
    if (!v) continue // inactive rows are not in the static export
    assert.equal(v.townSlug, r.to, `${id} ${v.name}`)
  }
})

test('each moved venue 301s from its old Birmingham/Leicester URL and the destination is not itself redirected', () => {
  const rule = new Map(redirects.map((r) => [r.source, r]))
  const byId = new Map(venues.map((v) => [v.id, v]))
  let checked = 0
  for (const r of retags) for (const id of r.ids) {
    const v = byId.get(id)
    if (!v) continue
    const old = `/soft-play/${r.from}/${v.slug}`
    const dest = `/soft-play/${r.to}/${v.slug}`
    const hit = rule.get(old)
    if (!hit) { assert.ok([2014, 2015, 2112].includes(id), `no 301 for ${old}`); continue }
    assert.equal(hit.destination, dest)
    assert.equal(hit.permanent, true)
    assert.ok(!rule.has(dest), `redirect chain at ${dest}`)
    checked++
  }
  assert.ok(checked >= 60, `only ${checked} redirects checked`)
})

test('new hubs have a county, honest default copy, and nearby towns that are real hubs', () => {
  const fresh = ['solihull', 'stourbridge', 'walsall', 'dudley', 'nuneaton', 'tamworth', 'west-bromwich', 'wolverhampton', 'wombourne', 'aldridge', 'halesowen', 'kidderminster', 'alvechurch', 'barnt-green', 'himley', 'middleton', 'smethwick', 'tipton', 'willenhall', 'wythall', 'telford', 'shifnal', 'cleobury-mortimer']
  const names = new Set(cities.map((c) => c.name))
  for (const s of fresh) {
    const c = cities.find((x) => x.slug === s)
    assert.ok(c, s)
    assert.ok(c.county && c.region)
    assert.match(c.intro, /^Soft play centres in .+ and the surrounding area of .+\.$/)
    assert.deepEqual(c.faqs, [])
    for (const n of c.nearbyAreas) assert.ok(names.has(n), `${s} lists ${n}, which has no hub`)
    assert.ok(venues.some((v) => v.townSlug === s && (!v.venueType || ['indoor', 'pub'].includes(v.venueType))), `${s} has no visible venue`)
  }
  assert.ok(!hubSlugs.has('rowley-regis'), 'Rowley Regis only has a mobile-hire listing, so no hub')
})

test('genuine Birmingham and already-correct Coventry rows were not touched', () => {
  const byId = new Map(venues.map((v) => [v.id, v]))
  for (const id of [415, 406, 400, 2013, 416, 1073]) assert.equal(byId.get(id)?.townSlug, 'birmingham', String(id))
  for (const id of [1935, 1936]) assert.equal(byId.get(id)?.townSlug, 'coventry', String(id))
  for (const r of retags) for (const id of r.ids) assert.ok(![415, 406, 400, 2013, 416, 1935, 1936].includes(id), `${id} must not be retagged`)
})

test('email SQL: six official addresses, only into an empty field; Emily\'s PR address cleared, never replaced', () => {
  const updates = emailSql.split('\n').filter((l) => l.startsWith('UPDATE'))
  assert.equal(updates.length, 7)
  assert.equal([...emailSql.matchAll(/SET contact_email = '([^']+)'/g)].length, 6)
  assert.equal([...emailSql.matchAll(/\(contact_email IS NULL OR BTRIM\(contact_email\) = ''\)/g)].length, 6)
  assert.match(emailSql, /SET contact_email = NULL[^;]*424 AND lower\(BTRIM\(contact_email\)\) = 'draytonmanor@rewiredpr\.com'/s)
  const stored = [...emailSql.matchAll(/SET contact_email = '([^']+)'/g)].map((m) => m[1])
  for (const banned of ['parties@thecubecoventry.com', 'ctga@thecubecoventry.com', 'tinytimscharity@outlook.com', 'bolton@jumpxtreme.com', 'marketing@jumpxtreme.com', '6380@greeneking.co.uk', 'guestservices@draytonmanor.co.uk', 'events@draytonmanor.co.uk']) {
    assert.ok(!stored.includes(banned), banned)
  }
})
