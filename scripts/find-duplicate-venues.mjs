#!/usr/bin/env node
// Finds venues that may be the same business listed twice and writes candidate
// pairs to a CSV for a human to review. It NEVER merges, edits or deletes
// anything — merging is a judgement call (a chain's separate branches share a
// website; a venue and the café inside it share a postcode).
//
// A pair is a candidate when two venues share at least one of:
//   phone      same number (normalised)
//   website    same site (normalised host + path); social/booking-platform URLs are ignored,
//              and a site shared by many venues is treated as a chain and weighted down
//   postcode   same full postcode
//   location   coordinates within ~40 m
//   reviews    identical review count (50+ reviews; stronger if the rating matches too), within
//              the same hub or 10 km — two listings scraped from one Google profile carry the
//              same numbers (e.g. Active+ Hull and Little Monkeys @ Active+: both 222 reviews)
//   name       near-identical names
// Signals are weighted and summed into a score; confidence is HIGH / MEDIUM / LOW.
//
// Source: the static export by default (no database needed); --db reads the live table.
//
// Usage:
//   node scripts/find-duplicate-venues.mjs [--db] [--out=reports/duplicate-candidates.csv] [--min=MEDIUM|LOW]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const useDb = args.includes('--db')
const outPath = path.resolve(ROOT, args.find((a) => a.startsWith('--out='))?.slice(6) ?? 'reports/duplicate-candidates.csv')
const minConfidence = (args.find((a) => a.startsWith('--min='))?.slice(6) ?? 'MEDIUM').toUpperCase()

async function loadVenues() {
  if (!useDb) {
    const byTown = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/generated/venuesByTown.json'), 'utf8'))
    return Object.values(byTown).flatMap((t) =>
      t.venues.map((v) => ({
        id: v.id, name: v.name, slug: v.slug, hub: t.townSlug, postcode: v.postcode, phone: v.phone, website: v.website,
        lat: v.lat, lng: v.lng, rating: v.rating, reviews: v.reviewCount, type: v.venueType,
      }))
    )
  }
  if (fs.existsSync(path.join(ROOT, '.env.local'))) {
    for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
      const i = line.indexOf('=')
      if (i > 0 && !line.trim().startsWith('#')) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  try {
    const { rows } = await pool.query(
      `SELECT id, name, slug, city_slug AS hub, postcode, phone, website, lat, lng, rating, reviews_count AS reviews, venue_type AS type
         FROM venues WHERE is_active = true`
    )
    return rows
  } finally {
    await pool.end()
  }
}

// ── normalisers ─────────────────────────────────────────────────────────────
const SOCIAL_OR_PLATFORM = /(^|\.)(facebook|fb|instagram|twitter|x|tiktok|linktr|linktree|google|goo|maps|youtube|eventbrite|wixsite|business|squarespace|godaddysites|weebly|tripadvisor|yell|bookwhen|ticketsource|skiddle)\.(com|co\.uk|site|ee|gl|page|link)$/i

function websiteKey(url) {
  if (!url) return null
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    if (SOCIAL_OR_PLATFORM.test(host)) return null
    const p = u.pathname.replace(/\/+$/, '').toLowerCase()
    return `${host}${p}`
  } catch {
    return null
  }
}

function phoneKey(phone) {
  if (!phone) return null
  let d = String(phone).replace(/[^\d+]/g, '')
  d = d.replace(/^\+?44/, '0').replace(/^00/, '')
  d = d.replace(/\D/g, '')
  return d.length >= 10 ? d : null
}

const postcodeKey = (pc) => {
  const k = String(pc ?? '').toUpperCase().replace(/\s+/g, '')
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(k) ? k : null
}

const nameTokens = (n) =>
  new Set(
    String(n ?? '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t && !['the', 'and', 'at', 'of', 'soft', 'play', 'centre', 'center', 'ltd', 'limited', 'kids', 'childrens', 'children'].includes(t))
  )

function nameSimilarity(a, b) {
  const A = nameTokens(a.name), B = nameTokens(b.name)
  if (!A.size || !B.size) return 0
  const inter = [...A].filter((t) => B.has(t)).length
  return inter / Math.min(A.size, B.size)
}

function distanceM(a, b) {
  const lat1 = Number(a.lat), lng1 = Number(a.lng), lat2 = Number(b.lat), lng2 = Number(b.lng)
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite) || (!lat1 && !lng1) || (!lat2 && !lng2)) return Infinity
  const R = 6371000, rad = (x) => (x * Math.PI) / 180
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// ── candidate generation (blocking on each key, so no O(n^2) scan) ──────────
const venues = (await loadVenues()).filter((v) => v.id !== undefined)
const pairs = new Map() // "idA|idB" -> { a, b, signals: Map(name -> weight/detail) }

function addSignal(a, b, signal, weight, detail) {
  if (a.id === b.id) return
  const [x, y] = a.id < b.id ? [a, b] : [b, a]
  const key = `${x.id}|${y.id}`
  if (!pairs.has(key)) pairs.set(key, { a: x, b: y, signals: new Map() })
  pairs.get(key).signals.set(signal, { weight, detail })
}

function block(keyFn, signal, weightFn) {
  const groups = new Map()
  for (const v of venues) {
    const k = keyFn(v)
    if (k) groups.set(k, [...(groups.get(k) ?? []), v])
  }
  for (const [k, group] of groups) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) {
        const w = weightFn(group, group[i], group[j])
        if (w > 0) addSignal(group[i], group[j], signal, w, k)
      }
  }
}

block(phoneKey, 'same_phone', (g) => (g.length > 4 ? 0.5 : 3))
// A website shared by 4+ venues is a chain's corporate site (e.g. a franchise
// homepage), not evidence of a duplicate on its own.
block((v) => websiteKey(v.website), 'same_website', (g) => (g.length > 3 ? 0.5 : 3))
block((v) => postcodeKey(v.postcode), 'same_postcode', (g) => (g.length > 4 ? 0.5 : 1.5))
// Reviews: only meaningful between venues that could plausibly be the same place,
// otherwise two unrelated venues anywhere in the UK with 100 reviews would pair up.
const nearEnough = (a, b) => a.hub === b.hub || distanceM(a, b) <= 10000
block(
  (v) => (Number(v.reviews) >= 20 && Number(v.rating) > 0 ? `${Number(v.rating)}|${Number(v.reviews)}` : null),
  'same_rating_and_review_count',
  (g, a, b) => (!nearEnough(a, b) ? 0 : 2.5)
)
block(
  (v) => (Number(v.reviews) >= 50 ? String(Number(v.reviews)) : null),
  'same_review_count',
  (g, a, b) => (!nearEnough(a, b) || (a.rating && a.rating === b.rating) ? 0 : 1.5)
)

// Coordinates: bucket to ~0.0005 deg (~55 m) cells and check neighbouring cells.
{
  const cell = (v) => [Math.round(Number(v.lat) / 0.0005), Math.round(Number(v.lng) / 0.0005)]
  const grid = new Map()
  for (const v of venues) {
    if (!Number.isFinite(Number(v.lat)) || !Number(v.lat)) continue
    const [r, c] = cell(v)
    grid.set(`${r},${c}`, [...(grid.get(`${r},${c}`) ?? []), v])
  }
  for (const v of venues) {
    if (!Number.isFinite(Number(v.lat)) || !Number(v.lat)) continue
    const [r, c] = cell(v)
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        for (const o of grid.get(`${r + dr},${c + dc}`) ?? []) {
          if (o.id > v.id && distanceM(v, o) <= 40) addSignal(v, o, 'within_40m', 2, `${Math.round(distanceM(v, o))}m`)
        }
  }
}

// Names are only compared between venues that already share another signal.
for (const pair of pairs.values()) {
  const sim = nameSimilarity(pair.a, pair.b)
  if (sim >= 0.75) pair.signals.set('similar_name', { weight: 2, detail: `${Math.round(sim * 100)}% of name words shared` })
}

const confidenceOf = (score) => (score >= 5 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW')
const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 }
const keep = (c) => rank[c] <= rank[minConfidence]

const rows = [...pairs.values()]
  .map((p) => {
    const score = [...p.signals.values()].reduce((s, x) => s + x.weight, 0)
    return { ...p, score, confidence: confidenceOf(score) }
  })
  .filter((p) => keep(p.confidence))
  .sort((p, q) => q.score - p.score || p.a.name.localeCompare(q.a.name))

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const side = (v, k) => [`${k}_id`, v.id, `${k}_name`, v.name, `${k}_url`, `/soft-play/${v.hub}/${v.slug}`, `${k}_postcode`, v.postcode, `${k}_phone`, v.phone, `${k}_website`, v.website, `${k}_rating_reviews`, v.rating ? `${v.rating} (${v.reviews ?? '?'})` : '', `${k}_type`, v.type]
const toObj = (arr) => Object.fromEntries(arr.reduce((acc, x, i) => (i % 2 ? acc : [...acc, [x, arr[i + 1]]]), []))

const out = rows.map((p) => ({
  confidence: p.confidence,
  score: p.score,
  signals: [...p.signals.entries()].map(([k, x]) => `${k}${x.detail && !/^[\d]+$/.test(x.detail) && k !== 'same_website' && k !== 'same_phone' ? ` (${x.detail})` : ''}`).join('; '),
  same_hub: p.a.hub === p.b.hub ? 'yes' : 'no',
  ...toObj(side(p.a, 'a')),
  ...toObj(side(p.b, 'b')),
  review_note: 'Candidate only - not merged. Check both pages before deciding; if merging, use scripts/migrations/phase4-02-merge-city-duplicates.mjs so the old URL 301s to the survivor.',
}))

const columns = Object.keys(out[0] ?? { confidence: '', score: '' })
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, [columns.join(','), ...out.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n')

const tally = out.reduce((m, r) => ((m[r.confidence] = (m[r.confidence] ?? 0) + 1), m), {})
console.log(`Compared ${venues.length} venues from ${useDb ? 'the database' : 'the static export'}.`)
console.log(`Wrote ${out.length} candidate pairs (min confidence ${minConfidence}) to ${path.relative(ROOT, outPath)}:`, tally)
