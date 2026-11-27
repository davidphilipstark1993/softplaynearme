// Phase 13-01 city reassignment: the derivation rules, the redirect merge, and the
// committed redirects/static data it produced. No network, no DB. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decideCity } from './lib/derive-city.mjs'
import { mergeRedirects, retext } from './migrations/phase13-01-reassign-city-from-location.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))

// ── decideCity: pure rules on a tiny hub map ──────────────────────────────────────────
const HUBS = new Map([
  ['crewe', { slug: 'crewe', name: 'Crewe', centre: { lat: 53.095, lng: -2.442 } }],
  ['stoke', { slug: 'stoke', name: 'Stoke', centre: { lat: 53.003, lng: -2.180 } }],
  ['derby', { slug: 'derby', name: 'Derby', centre: { lat: 52.922, lng: -1.477 } }],
  ['nottingham', { slug: 'nottingham', name: 'Nottingham', centre: { lat: 52.954, lng: -1.158 } }],
  ['hatfield', { slug: 'hatfield', name: 'Hatfield', centre: { lat: 51.763, lng: -0.226 } }],
  ['doncaster', { slug: 'doncaster', name: 'Doncaster', centre: { lat: 53.523, lng: -1.133 } }],
])
const at = (lat, lng, extra = {}) => ({ pc: { lat, lng, bua: null, parish: null, district: null, ttwa: null, ...extra }, rev: null })
const venue = (lat, lng) => ({ postcode: 'AA1 1AA', lat, lng })

test('locality wins: a Derby venue filed under Nottingham goes to Derby', () => {
  const r = decideCity(venue(52.92, -1.47), at(52.92, -1.47, { bua: 'Derby' }), HUBS, 'nottingham')
  assert.equal(r.derived, 'derby')
  assert.equal(r.confidence, 'high')
  assert.match(r.method, /^locality: bua "Derby"/)
})

test('a town with no hub stays in the hub of its travel-to-work area (Winsford -> Crewe)', () => {
  const r = decideCity(venue(53.19, -2.52), at(53.19, -2.52, { bua: 'Winsford', ttwa: 'Crewe' }), HUBS, 'crewe')
  assert.equal(r.derived, 'crewe')
  assert.match(r.method, /^keep/)
})

test('...and a new Winsford venue found in a Stoke search is filed under Crewe, not Stoke', () => {
  const r = decideCity(venue(53.19, -2.52), at(53.19, -2.52, { bua: 'Winsford', ttwa: 'Crewe' }), HUBS, null)
  assert.equal(r.derived, 'crewe')
})

test('a same-named hub far away is not a locality match (Hatfield, Doncaster is not Hatfield, Herts)', () => {
  const r = decideCity(venue(53.58, -1.0), at(53.58, -1.0, { parish: 'Hatfield' }), HUBS, 'doncaster')
  assert.equal(r.derived, 'doncaster')
})

test('nothing within 40 km is "none"', () => {
  const r = decideCity(venue(54.4, -0.6), at(54.4, -0.6), HUBS, 'doncaster')
  assert.equal(r.derived, 'none')
  assert.equal(r.confidence, 'low')
})

test('postcode and coordinates 10+ km apart make the answer low confidence', () => {
  const r = decideCity({ postcode: 'AA1 1AA', lat: 53.5, lng: -1.5 }, at(52.92, -1.47, { bua: 'Derby' }), HUBS, 'nottingham')
  assert.equal(r.confidence, 'low')
  assert.ok(r.flags.some((f) => f.startsWith('postcode-vs-latlng')))
})

// ── mergeRedirects ────────────────────────────────────────────────────────────────────
test('mergeRedirects re-points older redirects, drops ones that would shadow the new page, never chains', () => {
  const existing = [
    { source: '/soft-play/x/old-name-stoke', destination: '/soft-play/x/old-name', permanent: true }, // 11-01 slug fix
    { source: '/soft-play/y/a', destination: '/soft-play/y', permanent: true }, // unrelated retirement
    { source: '/soft-play/z/old-name', destination: '/soft-play/x/old-name', permanent: true }, // would be live again
  ]
  const moves = [{ from_city: 'x', from_slug: 'old-name', to_city: 'z', to_slug: 'old-name' }]
  const out = new Map(mergeRedirects(existing, moves).map((r) => [r.source, r.destination]))
  assert.equal(out.get('/soft-play/x/old-name-stoke'), '/soft-play/z/old-name')
  assert.equal(out.get('/soft-play/x/old-name'), '/soft-play/z/old-name')
  assert.equal(out.get('/soft-play/y/a'), '/soft-play/y')
  assert.ok(!out.has('/soft-play/z/old-name'))
  for (const d of out.values()) assert.ok(!out.has(d), `chain via ${d}`)
})

// ── retext: only template phrases change ─────────────────────────────────────────────
test('retext re-words generated city phrases and nothing else', () => {
  const from = { name: 'Leeds', county: 'West Yorkshire' }, to = { name: 'Bradford', county: 'West Yorkshire' }
  assert.equal(retext('Looking for soft play in Leeds? Funzy offers indoor play.', from, to), 'Looking for soft play in Bradford? Funzy offers indoor play.')
  assert.equal(retext("Funzy | Children's Soft Play Centre, Leeds", from, to), "Funzy | Children's Soft Play Centre, Bradford")
  assert.equal(retext('popular among families across Leeds and West Yorkshire.', from, to), 'popular among families across Bradford and West Yorkshire.')
  assert.equal(retext('Funzy is one of Leeds\'s best-rated venues', from, to), 'Funzy is one of Bradford\'s best-rated venues')
  assert.equal(retext('Unit 4, Leeds Road, Shipley', from, to), 'Unit 4, Leeds Road, Shipley', 'a road name is not the city')
  assert.equal(retext('a Leeds-based family business', from, to), 'a Leeds-based family business')
  const m = { name: 'Manchester', county: 'Greater Manchester' }, o = { name: 'Oldham', county: 'Greater Manchester' }
  assert.equal(retext('serving families in Greater Manchester', m, o), 'serving families in Greater Manchester')
  const b = { name: 'Birmingham', county: 'West Midlands' }, s2 = { name: 'Solihull', county: 'Warwickshire' }
  assert.equal(retext('families across Birmingham and West Midlands', b, s2), 'families across Solihull and Warwickshire')
  const c = { name: 'Cardiff', county: 'Cardiff' }, w = { name: 'Swansea', county: 'Swansea' }
  assert.equal(retext('a leisure and play centre in Cardiff, Cardiff, offering', c, w), 'a leisure and play centre in Swansea, Swansea, offering')
  assert.equal(retext('Cardiff families tend to visit', c, w), 'Swansea families tend to visit')
})

// ── the committed result ─────────────────────────────────────────────────────────────
const moves = read('scripts/migrations/phase13-01-data.json')
const held = read('scripts/migrations/phase13-01-held.json')
const redirects = new Map(read('data/redirects.json').map((r) => [r.source, r.destination]))
const venues = read('data/generated/venues.json')
const live = new Set([...venues.map((v) => `/soft-play/${v.townSlug}/${v.slug}`), ...venues.map((v) => `/soft-play/${v.townSlug}`)])
const byId = new Map(venues.map((v) => [v.id, v]))
// Retired on purpose later (phase18-01: playgrounds, hire, off-category). Its URL, and any
// old URL that 301ed to it, answers 410 Gone (lib/redirects.ts goneFor).
const gone = new Set(read('data/gone.json').map((g) => g.path))
const RETIRED_AFTER_MOVE = new Set([1612])
// Merged into another listing after its move (25 Nov 2026, phase16-01 duplicate merge): both
// its phase-13 URLs 301 straight to the surviving listing.
const MERGED_AFTER_MOVE = new Map([
  [1894, '/soft-play/mossley/tumbles-play-place-2'],
  // phase18-01 (27 Nov 2026): the sports complex is the building the Romsey Rapids soft play is in.
  [1799, '/soft-play/romsey/romsey-rapids-soft-play'],
])
// Refiled again after phase 13 onto a smaller town hub (19 Nov 2026 Hampshire batch: Romsey/Winchester
// split off Southampton). Their phase-13 URLs now 301 on to the town hub.
const REFILED_AFTER_MOVE = new Map([
  [657, 'romsey'], [767, 'romsey'], [770, 'romsey'], [1801, 'romsey'],
  [784, 'winchester'], [1067, 'winchester'],
])
const finalUrl = (m) => (REFILED_AFTER_MOVE.has(m.id) ? `/soft-play/${REFILED_AFTER_MOVE.get(m.id)}/${m.to_slug}` : `/soft-play/${m.to_city}/${m.to_slug}`)

test('every approved move: old URL 301s once to the new URL, which is live in the static export', () => {
  assert.equal(moves.length, 165)
  for (const m of moves) {
    const oldUrl = `/soft-play/${m.from_city}/${m.from_slug}`
    const newUrl = `/soft-play/${m.to_city}/${m.to_slug}`
    // A venue retired after its move (phase 14-01: 3-2-1 Fun hire) 301s, old URL included, to its hub.
    if (RETIRED_AFTER_MOVE.has(m.id)) {
      assert.equal(redirects.get(newUrl), `/soft-play/${m.to_city}`, newUrl)
      assert.equal(redirects.get(oldUrl), `/soft-play/${m.to_city}`, oldUrl)
      continue
    }
    if (MERGED_AFTER_MOVE.has(m.id)) {
      const survivor = MERGED_AFTER_MOVE.get(m.id)
      assert.equal(redirects.get(oldUrl), survivor, oldUrl)
      assert.equal(redirects.get(newUrl), survivor, newUrl)
      assert.ok(live.has(survivor), `${survivor} not in static export`)
      continue
    }
    if (REFILED_AFTER_MOVE.has(m.id)) {
      const finalU = finalUrl(m)
      assert.equal(redirects.get(oldUrl), finalU, oldUrl)
      assert.equal(redirects.get(newUrl), finalU, newUrl)
      assert.ok(!redirects.has(finalU), `${finalU} is itself redirected`)
      assert.ok(live.has(finalU) || gone.has(finalU), `${finalU} not in static export`)
      continue
    }
    assert.equal(redirects.get(oldUrl), newUrl, oldUrl)
    assert.ok(!redirects.has(newUrl), `${newUrl} is itself redirected`)
    if (gone.has(newUrl)) continue
    assert.ok(live.has(newUrl), `${newUrl} not in static export`)
    if (byId.has(m.id)) assert.equal(byId.get(m.id).townSlug, m.to_city)
  }
})

test('older URLs of a moved venue (slug fixes, earlier moves) also land on the new URL in one hop', () => {
  const finals = new Set(moves.map((m) => `/soft-play/${m.to_city}/${m.to_slug}`))
  const oldOnes = new Set(moves.map((m) => `/soft-play/${m.from_city}/${m.from_slug}`))
  for (const [s, d] of redirects) assert.ok(!oldOnes.has(d), `${s} still points at moved-away ${d}`)
  assert.ok([...redirects.values()].filter((d) => finals.has(d)).length > moves.length, 'older redirects were re-pointed')
})

test('held-back moves are untouched', () => {
  assert.equal(held.length, 12)
  for (const m of held) {
    assert.ok(!redirects.has(`/soft-play/${m.from_city}/${m.from_slug}`), `${m.name} was moved`)
    if (byId.has(m.id)) assert.equal(byId.get(m.id).townSlug, m.from_city)
  }
})

test('every GSC wrong-city URL (Nov 2026) resolves in at most one hop to a live page or a deliberate 410', () => {
  // URL column only of the GSC export (seo-data/ itself stays out of the public repo)
  const urls = fs.readFileSync(path.join(ROOT, 'scripts/fixtures/gsc-2026-11-wrong-city-urls.txt'), 'utf8').trim().split('\n')
  assert.equal(urls.length, 49)
  for (const p of urls) {
    const dest = redirects.get(p) ?? p
    assert.ok(live.has(dest) || gone.has(dest), `${p} -> ${dest} is neither live nor deliberately gone`)
    assert.ok(!redirects.has(dest), `${p} chains`)
  }
})
