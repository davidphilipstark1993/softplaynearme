import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { venueSlug, stripTrailingCity, trailingCityCount, slugify, uniqueSlug } from './lib/venue-slug.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))

test('the generator never repeats the city', () => {
  assert.equal(venueSlug('Ping Pong Tots Hull', 'hull'), 'ping-pong-tots')
  assert.equal(venueSlug('Monkey Bizness Hull', 'hull'), 'monkey-bizness')
  assert.equal(venueSlug('Big Fun Indoor Play Centre', 'hull'), 'big-fun-indoor-play-centre')
  assert.equal(venueSlug('Hull Adventure', 'hull'), 'hull-adventure', 'a city inside the name is kept')
  assert.equal(venueSlug("Fuzzy Ed's Funhouse Aberdeen", 'aberdeen'), 'fuzzy-ed-s-funhouse')
})

test('stripping falls back rather than producing an unusable slug', () => {
  assert.equal(stripTrailingCity('lc-swansea-swansea', 'swansea'), 'lc-swansea')
  assert.equal(stripTrailingCity('toddler-hull', 'hull'), 'toddler-hull', 'reserved route names stay as they are')
  assert.equal(stripTrailingCity('ab-hull', 'hull'), 'ab-hull')
  assert.equal(trailingCityCount('a-hull-hull', 'hull'), 2)
})

test('uniqueSlug disambiguates within a hub', () => {
  const taken = new Set(['fun-shack'])
  assert.equal(uniqueSlug('fun-shack', taken), 'fun-shack-2')
  assert.equal(slugify('  Café & Play! '), 'caf-play')
})

const venues = readJson('data/generated/venues.json')
const redirects = readJson('data/redirects.json')
const live = new Set([...venues.map((v) => `/soft-play/${v.townSlug}/${v.slug}`), ...new Set(venues.map((v) => `/soft-play/${v.townSlug}`))])
const bySource = new Map(redirects.map((r) => [r.source, r.destination]))

test('no live venue slug still repeats its city', () => {
  const offenders = venues.filter((v) => trailingCityCount(v.slug, v.townSlug) >= 2).map((v) => `${v.townSlug}/${v.slug}`)
  assert.deepEqual(offenders, [])
})

test('slugs are unique within each hub and never shadow a filter route', () => {
  const seen = new Set()
  for (const v of venues) {
    const key = `${v.townSlug}/${v.slug}`
    assert.ok(!seen.has(key), `duplicate ${key}`)
    seen.add(key)
    assert.ok(!['toddler', 'birthday-parties', 'sen-friendly', 'open-now'].includes(v.slug), `${key} shadows a route`)
  }
})

test('redirects: no chains, no loops, every destination is a live page', () => {
  for (const [source, destination] of bySource) {
    assert.notEqual(source, destination, `self-redirect ${source}`)
    assert.ok(!bySource.has(destination), `chain ${source} -> ${destination} -> ${bySource.get(destination)}`)
    assert.ok(live.has(destination), `${source} redirects to ${destination}, which is not a live page`)
  }
})

test('a page that still exists only redirects if that is a known, deliberate merge', () => {
  // Static export is older than the DB for these two merged duplicates (see reports/duplicate-candidates.csv).
  const allowed = new Set(['/soft-play/brighton/kidzone-at-missionfiit-hailsham', '/soft-play/york/flying-legends-wacky-warehouse-york'])
  for (const source of bySource.keys()) if (live.has(source)) assert.ok(allowed.has(source), `${source} is live but redirects`)
})

test('every slug change has a permanent redirect from the old URL', () => {
  const rows = fs.readFileSync(path.join(ROOT, 'reports/slug-changes.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','))
  const changed = rows.filter((r) => r[6] === 'changed')
  assert.ok(changed.length >= 100)
  for (const [, , , , oldUrl, newUrl] of changed) {
    // A later change (retirement, further rename) may re-point the old URL; it must still redirect somewhere live.
    const dest = bySource.get(oldUrl)
    assert.ok(dest, `missing redirect ${oldUrl}`)
    assert.ok(dest === newUrl || live.has(dest), `${oldUrl} -> ${dest} is not live`)
  }
  assert.ok(redirects.every((r) => r.permanent === true))
})

test('internal links in blog posts point at live pages, not at redirects', () => {
  const posts = fs.readFileSync(path.join(ROOT, 'lib/blogPosts.ts'), 'utf8')
  const reserved = new Set(['toddler', 'birthday-parties', 'sen-friendly', 'open-now'])
  for (const m of posts.matchAll(/\/soft-play\/([a-z0-9-]+)\/([a-z0-9-]+)(?![a-z0-9-])/g)) {
    if (reserved.has(m[2])) continue
    assert.ok(!bySource.has(m[0]), `blog links to redirected URL ${m[0]}`)
  }
})
