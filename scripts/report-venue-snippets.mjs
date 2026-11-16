// Before/after review sheet for venue page <title> and meta description.
//
//   DATABASE_URL=... node scripts/report-venue-snippets.mjs seo-data/gsc-2026-11/ctr-target-venue-pages.csv
//
// Input: a GSC export with a `url` column (plus clicks/impressions/ctr/position).
// "Before" is fetched from the live site; "after" is what lib/venueSnippet.ts builds
// from the DB row, the same way the venue page does (town from lib/localities
// getVenueTown, nearby = other directory venues within 5 miles, list capped at 20).
// Read-only. Writes <input dir>/venue-snippets-before-after.csv.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerTsResolver } from './ts-resolve-hook.mjs'
import { getPool } from './migrations/_lib.mjs'

registerTsResolver()
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const { venueFacts, buildVenueSeoTitle, buildVenueMetaDescription, NEARBY_MILES, NEARBY_LIST_MAX } = await import('../lib/venueSnippet.ts')
const { VISIBLE_VENUE_TYPES } = await import('../lib/venueTypes.ts')

const input = process.argv[2]
if (!input) throw new Error('usage: report-venue-snippets.mjs <gsc-export.csv>')
const BASE = (process.env.BASE_URL || 'https://www.softplaynearme.co.uk').replace(/\/$/, '')
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))

// lib/localities.ts getVenueTown, without the Next "@/" import alias
const loc = read('data/postcode-localities.json')
const towns = read('data/venue-towns.json')
const district = (pc) => (String(pc || '').trim().toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/) || [])[1]
const venueTown = (v) => loc.venueOverrides[String(v.id)] ?? loc.districts[district(v.postcode)] ?? towns[String(v.id)] ?? null
const cities = new Map(read('data/cities.json').map((c) => [c.slug, c.name]))
const staticTowns = read('data/generated/towns.json')
const cityName = (slug) => cities.get(slug) ?? (Array.isArray(staticTowns) ? staticTowns.find((t) => t.slug === slug)?.name : staticTowns[slug]?.name) ?? slug

const redirects = new Map(read('data/redirects.json').map((r) => [r.source, r.destination]))
const finalPath = (p) => { let d = p; for (let i = 0; i < 10 && redirects.has(d); i++) d = redirects.get(d); return d }

const miles = (a, b) => {
  const r = (x) => (x * Math.PI) / 180
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 3959 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
async function live(p) {
  try {
    const res = await fetch(BASE + p, { redirect: 'manual' })
    const html = await res.text()
    return {
      status: res.status,
      title: decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''),
      meta: decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''),
    }
  } catch (e) {
    return { status: 'error', title: '', meta: String(e.message) }
  }
}

const targets = parseCsv(fs.readFileSync(input, 'utf8'))
const pool = await getPool()
const { rows: all } = await pool.query('SELECT * FROM venues WHERE is_active = true')
await pool.end()
const byPath = new Map(all.map((v) => [`/soft-play/${v.city_slug}/${v.slug}`, v]))
const directory = all.filter((v) => (!v.venue_type || VISIBLE_VENUE_TYPES.includes(v.venue_type)) && v.lat != null && v.lng != null)

const out = []
for (let i = 0; i < targets.length; i += 6) {
  const batch = await Promise.all(targets.slice(i, i + 6).map(async (t) => {
    const p = new URL(t.url).pathname
    const fp = finalPath(p)
    const v = byPath.get(fp)
    const before = await live(fp)
    const row = { ...t, final_url: fp === p ? '' : fp, live_status: before.status, title_before: before.title, meta_before: before.meta }
    if (!v) return { ...row, note: fp.split('/').length === 3 ? 'redirects to a city page (venue removed)' : 'no active venue at this URL' }
    const [, , city, slug] = fp.split('/')
    const town = venueTown(v) ?? cityName(city)
    let nearby = 0
    if (v.lat != null && v.lng != null) {
      const at = { lat: +v.lat, lng: +v.lng }
      nearby = directory.filter((o) => o.id !== v.id && !(o.city_slug === city && o.slug === slug) && miles(at, { lat: +o.lat, lng: +o.lng }) <= NEARBY_MILES).length
    }
    const facts = venueFacts(v, { town, nearbyCount: Math.min(nearby, NEARBY_LIST_MAX), nearbyMore: nearby > NEARBY_LIST_MAX })
    const title = buildVenueSeoTitle(facts, v.venue_type)
    const meta = buildVenueMetaDescription(facts)
    return {
      ...row, venue_id: v.id, town, nearby_5mi: nearby,
      title_after: title, title_after_len: title.length, meta_after: meta, meta_after_len: meta.length,
      facts_used: [facts.rating && 'rating', facts.hours && 'hours', facts.features.length && 'features', facts.ages && 'ages', facts.price && 'price', nearby && 'nearby'].filter(Boolean).join(' '),
    }
  }))
  out.push(...batch)
}

const cols = ['url', 'final_url', 'impressions', 'clicks', 'ctr', 'position', 'live_status', 'venue_id', 'town', 'nearby_5mi',
  'title_before', 'title_after', 'title_after_len', 'meta_before', 'meta_after', 'meta_after_len', 'facts_used', 'note']
const esc = (x) => (x === undefined || x === null ? '' : /[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x))
const dest = path.join(path.dirname(input), 'venue-snippets-before-after.csv')
fs.writeFileSync(dest, '﻿' + [cols.join(','), ...out.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n')

const ok = out.filter((r) => r.title_after)
console.log(`${out.length} rows -> ${path.relative(ROOT, dest)}`)
console.log(`  new snippets: ${ok.length}; no venue: ${out.length - ok.length}`)
console.log(`  titles > 60: ${ok.filter((r) => r.title_after_len > 60).length}; metas > 155: ${ok.filter((r) => r.meta_after_len > 155).length}`)
console.log(`  duplicate titles: ${ok.length - new Set(ok.map((r) => r.title_after)).size}; duplicate metas: ${ok.length - new Set(ok.map((r) => r.meta_after)).size}`)
for (const k of ['rating', 'hours', 'features', 'nearby']) console.log(`  meta uses ${k}: ${ok.filter((r) => r.meta_after.includes(k === 'rating' ? 'Rated' : k === 'nearby' ? 'Compare' : '')).length && ok.filter((r) => r.facts_used.split(' ').includes(k)).length}`)
