import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectAreaWave, distanceMiles, HULL_CENTRE } from './outreach/area-wave.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
const venues = read('data/generated/venues.json')
const byId = (id) => venues.find((v) => v.id === id)

// ── data ─────────────────────────────────────────────────────────────────────────
test('(a) Sweet Soft Play (Lockington, HU17) is on the Beverley hub, not Hull', () => {
  assert.equal(byId(78).townSlug, 'beverley')
  assert.notEqual(byId(78).townSlug, 'hull')
})

test('(b) south-Humber venues are on their own town hubs, not Doncaster', () => {
  assert.equal(byId(31).townSlug, 'grimsby') // Time 4 Play, DN32
  assert.equal(byId(33).townSlug, 'cleethorpes') // The Magical Castle, DN35
  assert.equal(byId(27).townSlug, 'brigg') // FunForest, DN20
  assert.equal(byId(1177).townSlug, 'goole') // Jurassica, DN14
  assert.equal(byId(19).townSlug, 'driffield') // JAM JAMZ, YO25
  for (const id of [31, 33, 27, 1177]) assert.notEqual(byId(id).townSlug, 'doncaster')
  assert.notEqual(byId(19).townSlug, 'bridlington')
})

test('every new hub is a real hub (cities.json + cities-basic.json) with its venue, and every move has a 301', () => {
  const cities = read('data/cities.json')
  const basic = read('data/cities-basic.json')
  const redirects = new Map(read('data/redirects.json').map((r) => [r.source, r.destination]))
  const moves = [[31, 'grimsby', 'doncaster'], [33, 'cleethorpes', 'doncaster'], [27, 'brigg', 'doncaster'], [1177, 'goole', 'doncaster'], [19, 'driffield', 'bridlington'], [78, 'beverley', 'hull']]
  for (const [id, hub, old] of moves) {
    assert.ok(cities.some((c) => c.slug === hub), `${hub} missing from cities.json`)
    assert.ok(basic.some((c) => c.slug === hub), `${hub} missing from cities-basic.json`)
    const v = byId(id)
    assert.equal(redirects.get(`/soft-play/${old}/${v.slug}`), `/soft-play/${hub}/${v.slug}`, `no 301 for ${v.slug}`)
  }
  assert.equal(cities.length, basic.length)
})

test('new hubs only link to hubs that exist', () => {
  const cities = read('data/cities.json')
  const names = new Set(cities.map((c) => c.name))
  for (const slug of ['grimsby', 'cleethorpes', 'brigg', 'driffield', 'goole']) {
    const hub = cities.find((c) => c.slug === slug)
    assert.ok(hub.nearbyAreas.length > 0)
    for (const area of hub.nearbyAreas) assert.ok(names.has(area), `${slug} links to ${area}, which has no hub`)
  }
})

test('each new hub holds exactly its venue in the static data, counts derived not hand-typed', () => {
  const towns = new Map(read('data/generated/towns.json').map((t) => [t.slug, t]))
  for (const slug of ['grimsby', 'cleethorpes', 'brigg', 'driffield', 'goole']) assert.equal(towns.get(slug).venueCount, 1, slug)
  assert.equal(towns.get('beverley').venueCount, 3)
})

// ── widened recipient query ─────────────────────────────────────────────────────────────────
const row = (over) => ({ is_active: true, claimed_by_owner: false, venue_type: 'indoor', lat: 53.75, lng: -0.34, postcode: 'HU5 1SN', city_slug: 'hull', ...over })
const FIXTURE = [
  row({ id: 14, name: 'Adventure Play Town', slug: 'adventure-play-town-hull', contact_email: 'info@adventureplaytown.co.uk' }),
  row({ id: 32, name: 'Ping Pong Tots Hull', slug: 'ping-pong-tots', contact_email: 'info@mysite.com' }),
  row({ id: 81, name: 'The Freedom Centre', slug: 'the-freedom-centre-hull', contact_email: 'sales@freedomcentre.info', claimed_by_owner: true }),
  // the six already-emailed venues the `city_slug = 'hull'` filter missed
  row({ id: 21, name: 'Let Loose Yorkshire', slug: 'let-loose-yorkshire', city_slug: 'beverley', contact_email: 'info@letlooseyorkshire.co.uk', lat: 53.8, lng: -0.42, postcode: 'HU17 0RS' }),
  row({ id: 192, name: 'Jack in the Box Soft Play and Role Play', slug: 'jack-in-the-box-soft-play-and-role-play', city_slug: 'beverley', contact_email: 'admin@jackintheboxclub.co.uk', lat: 53.841, lng: -0.40, postcode: 'HU17 0LF' }),
  row({ id: 27, name: 'FunForest Brigg', slug: 'funforest-brigg', city_slug: 'doncaster', contact_email: 'play@funforest.co.uk', lat: 53.5517, lng: -0.4838, postcode: 'DN20 8UN' }),
  row({ id: 31, name: 'Time 4 Play Grimsby Ltd', slug: 'time-4-play-grimsby-ltd', city_slug: 'doncaster', contact_email: 'info@timeforplay.co.uk', lat: 53.5629, lng: -0.0807, postcode: 'DN32 9AB' }),
  row({ id: 33, name: 'The Magical Castle', slug: 'the-magical-castle', city_slug: 'doncaster', contact_email: 'ask@magicalcastle.co.uk', lat: 53.5497, lng: -0.0397, postcode: 'DN35 0FB' }),
  row({ id: 636, name: 'Play Avenue Ltd', slug: 'play-avenue-ltd', city_slug: 'scunthorpe', contact_email: 'hello@playavenue.co.uk', lat: 53.5936, lng: -0.6905, postcode: 'DN17 3RD' }),
  // must NOT be returned
  row({ id: 900, name: 'Too far', slug: 'too-far', city_slug: 'york', contact_email: 'a@b.co.uk', lat: 53.96, lng: -1.08, postcode: 'YO1 7HH' }),
  row({ id: 901, name: 'Trampoline park', slug: 'tp', venue_type: 'trampoline-park', contact_email: 'a@tp.co.uk' }),
  row({ id: 902, name: 'Inactive', slug: 'inactive', is_active: false, contact_email: 'a@inactive.co.uk' }),
  row({ id: 903, name: 'No email', slug: 'no-email', contact_email: '' }),
  row({ id: 904, name: 'Lead email only', slug: 'lead', contact_email: null, email: null, lead_notification_email: 'leads@x.co.uk' }),
  row({ id: 905, name: 'Recent outreach', slug: 'recent', contact_email: 'info@gigglesplayandadventure.co.uk' }),
  row({ id: 906, name: 'Bad email', slug: 'bad', contact_email: 'not an email' }),
  row({ id: 907, name: 'Fallback email', slug: 'fallback', contact_email: '  ', email: 'Hello@Fallback.co.uk' }),
  row({ id: 908, name: 'No coordinates', slug: 'nocoords', contact_email: 'a@nc.co.uk', lat: null, lng: null }),
]

test('(c) the widened query returns the six already-emailed non-Hull tags and not Ping Pong Tots', () => {
  const ids = selectAreaWave(FIXTURE).map((r) => r.id)
  for (const id of [21, 192, 27, 31, 33, 636]) assert.ok(ids.includes(id), `missing venue ${id}`)
  assert.ok(ids.includes(14), 'the original Hull venues are still reached')
  assert.ok(!ids.includes(32), 'Ping Pong Tots (info@mysite.com) must not be returned')
})

test('the widened query keeps every other rule', () => {
  const ids = selectAreaWave(FIXTURE).map((r) => r.id)
  for (const id of [81, 900, 901, 902, 903, 904, 905, 906, 908]) assert.ok(!ids.includes(id), `venue ${id} should be excluded`)
  const fallback = selectAreaWave(FIXTURE).find((r) => r.id === 907)
  assert.equal(fallback.email, 'hello@fallback.co.uk', 'falls back to email, lower-cased')
})

test('distance reproduces the sweep report to the hundredth of a mile, from the repo\'s own coordinates', () => {
  const expected = { 21: 5.26, 192: 7.08, 27: 14.63, 31: 16.4, 33: 19.1, 636: 19.66 } // section 4.2 of the sweep
  for (const [id, miles] of Object.entries(expected)) {
    const v = byId(Number(id))
    assert.equal(distanceMiles(HULL_CENTRE, { lat: Number(v.lat), lng: Number(v.lng) }), miles, v.name)
  }
})

test('the SQL file carries the same rules as the JS mirror', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'scripts/sql/hull-area-2026-11-12/03-hull-area-claim-wave.sql'), 'utf8')
  for (const needle of ['v.is_active = true', "COALESCE(v.claimed_by_owner, false) = false", "v.venue_type IN ('indoor', 'pub')", "NOT LIKE '%@mysite.com'", "NOT LIKE '%@example.com'", "NOT LIKE '%@email.com'", '<= 20.00', "~ '^HU[0-9]'", '3958.7613', '53.7457', '-0.3367', 'info@gigglesplayandadventure.co.uk']) {
    assert.ok(sql.includes(needle), `SQL is missing: ${needle}`)
  }
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /lead_notification_email/, 'never the lead address')
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /city_slug = /, 'the wave is no longer limited to one city tag')
})

test('the email SQL only fills empty addresses and covers the eight sourced venues', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'scripts/sql/hull-area-2026-11-12/01-official-emails-and-beverley-tag.sql'), 'utf8')
  for (const email of ['enquiries@big-fun-hull.co.uk', 'info@thesecretvillage.co.uk', 'enquiries@blackburnleisure.co.uk', 'enquiries@cheekychimpsscunthorpe.co.uk', 'hull@superbowluk.co.uk', 'hello@williamsden.co.uk', 'info@princesquay.com', 'sally@pinkpigfarm.co.uk']) {
    assert.ok(sql.includes(`'${email}'`), email)
  }
  assert.equal((sql.match(/contact_email IS NULL OR BTRIM\(contact_email\) = ''/g) ?? []).length, 8)
  for (const banned of ['mezza1988@hotmail.com', 'scunthorpe@airkings.co.uk', 'reception@hornseavillage.com', 'jurassicaplay@gmail.com']) assert.ok(!sql.includes(`'${banned}'`), `${banned} is third-party`)
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /karoo|mysite/i)
})
