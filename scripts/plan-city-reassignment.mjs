#!/usr/bin/env node
// READ-ONLY planner. For every venue in the DB, derives the city hub it belongs in
// from its own postcode / lat-lng (scripts/lib/derive-city.mjs) and compares it with
// the stored city_slug. Never writes to the DB.
//
// Outputs (seo-data/):
//   city-reassignment-plan.csv  one row per venue: action keep|move|slug-only|no-hub|inactive
//   hub-centres.csv             where each hub's centre came from
//   gsc-wrong-city-check.csv    cross-check of a GSC URL list against the plan
// --write-centres also refreshes data/hub-centres.json, which the importers read.
//
// Usage:
//   node scripts/plan-city-reassignment.mjs [--write-centres] [--gsc=seo-data/gsc-2026-11/wrong-city-venue-urls.csv]
//
// The approved Nov 2026 run is frozen in scripts/migrations/phase13-01-data.json; the
// migration reads that, not this script's live output.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from './migrations/_lib.mjs'
import { km, normName, lookupLocations, decideCity } from './lib/derive-city.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'seo-data')
const CACHE = path.join(OUT_DIR, '.postcodes-cache.json')
const GSC = process.argv.find((a) => a.startsWith('--gsc='))?.slice(6) ?? 'seo-data/gsc-2026-11/wrong-city-venue-urls.csv'
const WRITE_CENTRES = process.argv.includes('--write-centres')

fs.mkdirSync(OUT_DIR, { recursive: true })
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : { pc: {}, rev: {}, place: {} }
cache.place ??= {}
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache))

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const writeCsv = (file, rows, cols) => fs.writeFileSync(file, [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n')

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
const cities = read('data/cities.json')
const byTown = read('data/generated/venuesByTown.json')
const redirects = read('data/redirects.json')

const pool = await getPool()
const { rows: venues } = await pool.query(
  `SELECT id, name, slug, city_slug, address, postcode, lat::float AS lat, lng::float AS lng, is_active
     FROM venues ORDER BY id`,
)
await pool.end()

// Hub = any /soft-play/{city} page that renders: cities.json or a static town bucket.
const hubs = new Map()
for (const c of cities) hubs.set(c.slug, { slug: c.slug, name: c.name, county: c.county })
for (const t of Object.values(byTown)) if (!hubs.has(t.townSlug)) hubs.set(t.townSlug, { slug: t.townSlug, name: t.town })

// ---------- hub centres (OS Open Names, checked against the median of the hub's venues) ----------
const OS_NAME = { hull: 'Kingston upon Hull', newcastle: 'Newcastle upon Tyne', stoke: 'Stoke-on-Trent', southend: 'Southend-on-Sea' }
const TYPE_RANK = { City: 0, Town: 1, 'Other Settlement': 2, 'Suburban Area': 3, Village: 4, Hamlet: 5 }
const hubVenuePts = {}
for (const v of venues) if (v.is_active && v.lat != null) (hubVenuePts[v.city_slug] ??= []).push({ lat: +v.lat, lng: +v.lng })
for (const h of hubs.values()) {
  const pts = hubVenuePts[h.slug] ?? []
  const med = pts.length ? { lat: median(pts.map((p) => p.lat)), lng: median(pts.map((p) => p.lng)) } : null
  if (!(h.slug in cache.place)) {
    const q = OS_NAME[h.slug] ?? h.name.replace(/\s*\(.*\)$/, '').split(/ & | \/ /)[0]
    const res = await fetch(`https://api.postcodes.io/places?q=${encodeURIComponent(q)}&limit=30`).then((r) => r.json())
    cache.place[h.slug] = (res.result ?? []).filter((p) => normName(p.name_1) === normName(q) || normName(p.name_2) === normName(q))
      .map((p) => ({ lat: p.latitude, lng: p.longitude, type: p.local_type, county: p.county_unitary, region: p.region }))
    saveCache()
  }
  let best = [...cache.place[h.slug]].sort((a, b) =>
    (med ? km(a, med) > 60 : 0) - (med ? km(b, med) > 60 : 0) || // same-name places far from our venues lose
    (TYPE_RANK[a.type] ?? 9) - (TYPE_RANK[b.type] ?? 9) ||
    (med ? km(a, med) - km(b, med) : 0))[0] ?? null
  if (best && med && km(best, med) > 60) best = null // only same-name places elsewhere in the UK
  h.centre = best ? { lat: best.lat, lng: best.lng } : med
  h.centreSource = best ? `os-names:${best.type}` : med ? 'venue-median' : 'none'
  h.centreVsMedianKm = best && med ? +km(best, med).toFixed(1) : null
}
if (WRITE_CENTRES) {
  const out = {}
  for (const h of [...hubs.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (h.centre) out[h.slug] = { lat: +h.centre.lat.toFixed(5), lng: +h.centre.lng.toFixed(5), source: h.centreSource }
  }
  fs.writeFileSync(path.join(ROOT, 'data/hub-centres.json'), JSON.stringify(out, null, 2) + '\n')
}

// ---------- venue location evidence ----------
const locs = await lookupLocations(venues, cache, saveCache)
saveCache()

// ---------- redirects: who already points at each venue ----------
const redirectMap = new Map(redirects.map((r) => [r.source, r.destination]))
const finalDest = (u) => { const seen = new Set(); while (redirectMap.has(u) && !seen.has(u)) { seen.add(u); u = redirectMap.get(u) } return u }
const chainsNow = redirects.filter((r) => redirectMap.has(r.destination)).length
const inbound = new Map()
for (const r of redirects) { const d = finalDest(r.source); (inbound.get(d) ?? inbound.set(d, []).get(d)).push(r.source) }

// ---------- slug suffix check ----------
const suffixTokens = [...new Set([...hubs.keys(), ...venues.map((v) => v.city_slug)])].filter((s) => s && !s.startsWith('_'))
  .sort((a, b) => b.length - a.length)
const taken = new Map()
for (const v of venues) (taken.get(v.city_slug) ?? taken.set(v.city_slug, new Set()).get(v.city_slug)).add(v.slug)

// ---------- decide ----------
const plan = []
venues.forEach((v, i) => {
  const { derived, method, confidence, flags, geo, storedKm } = decideCity(v, locs[i], hubs, v.city_slug)

  // Slug: strip a trailing city that is neither the venue's own town nor the hub it lands in.
  let newSlug = v.slug
  let slugNote = ''
  const suffix = suffixTokens.find((t) => v.slug.endsWith(`-${t}`) && v.slug.length - t.length - 1 >= 3)
  if (suffix) {
    const own = [geo?.bua, geo?.parish, geo?.district].map(normName).filter(Boolean)
    const sufName = normName(hubs.get(suffix)?.name ?? suffix.replace(/-/g, ' '))
    const legit = suffix === derived || own.includes(sufName) || normName(v.name).endsWith(sufName)
    if (!legit) { newSlug = v.slug.slice(0, -(suffix.length + 1)); slugNote = `strip "-${suffix}" (venue is not in ${suffix})` }
    else slugNote = `keep "-${suffix}" (${suffix === derived ? 'matches hub' : 'venue\'s own town/name'})`
  }
  const target = derived === 'none' ? v.city_slug : derived
  const moves = v.is_active && derived !== 'none' && derived !== v.city_slug
  if ((moves || newSlug !== v.slug) && v.is_active) {
    const set = taken.get(target) ?? new Set()
    if (set.has(newSlug) && !(target === v.city_slug && newSlug === v.slug)) {
      let n = 2; while (set.has(`${newSlug}-${n}`)) n++
      flags.push(`slug-collision in ${target}: ${newSlug} -> ${newSlug}-${n}`)
      newSlug = `${newSlug}-${n}`
    }
  }
  const oldUrl = `/soft-play/${v.city_slug}/${v.slug}`
  plan.push({
    venue_id: v.id, name: v.name, active: v.is_active, old_url: oldUrl, stored_city: v.city_slug, derived_city: derived,
    method, confidence, new_url: v.is_active ? `/soft-play/${target}/${newSlug}` : '',
    action: !v.is_active ? 'inactive' : derived === 'none' ? 'no-hub' : moves ? 'move' : newSlug !== v.slug ? 'slug-only' : 'keep',
    slug_check: slugNote, postcode: v.postcode ?? '', bua: geo?.bua ?? '', ttwa: geo?.ttwa ?? '', district: geo?.district ?? '',
    stored_hub_km: storedKm?.toFixed(1) ?? '', existing_redirects_in: (inbound.get(oldUrl) ?? []).length, flags: flags.join('; '),
  })
})

const cols = ['venue_id', 'name', 'active', 'action', 'old_url', 'stored_city', 'derived_city', 'method', 'confidence', 'new_url',
  'slug_check', 'postcode', 'bua', 'ttwa', 'district', 'stored_hub_km', 'existing_redirects_in', 'flags']
writeCsv(path.join(OUT_DIR, 'city-reassignment-plan.csv'), plan, cols)
writeCsv(path.join(OUT_DIR, 'hub-centres.csv'), [...hubs.values()].map((h) => ({ ...h, lat: h.centre?.lat, lng: h.centre?.lng })),
  ['slug', 'name', 'lat', 'lng', 'centreSource', 'centreVsMedianKm'])

// ---------- GSC cross-check ----------
const byOld = new Map(plan.map((p) => [p.old_url, p]))
const gscPath = path.join(ROOT, GSC)
const gsc = fs.existsSync(gscPath) ? fs.readFileSync(gscPath, 'utf8').trim().split('\n').slice(1) : []
const gscRows = gsc.map((line) => {
  const [url, , , clicks, impressions] = line.split(',')
  const p = new URL(url).pathname
  const resolved = finalDest(p)
  const row = byOld.get(resolved)
  return {
    gsc_url: p, clicks, impressions,
    currently: redirectMap.has(p) ? `301 -> ${resolved}` : byOld.get(p)?.active ? 'live' : byOld.has(p) ? 'inactive venue, no redirect' : '404 (no venue, no redirect)',
    venue_id: row?.venue_id ?? byOld.get(p)?.venue_id ?? '',
    action: row?.action ?? (redirectMap.has(p) ? 'redirects to non-venue page' : 'NOT IN PLAN'),
    derived_city: row?.derived_city ?? '', confidence: row?.confidence ?? '',
    final_url: row ? (row.new_url || row.old_url) : '', method: row?.method ?? '',
  }
})
writeCsv(path.join(OUT_DIR, 'gsc-wrong-city-check.csv'), gscRows,
  ['gsc_url', 'clicks', 'impressions', 'currently', 'venue_id', 'action', 'derived_city', 'confidence', 'final_url', 'method'])

// ---------- summary ----------
const active = plan.filter((p) => p.active)
const count = (f) => active.filter(f).length
console.log(JSON.stringify({
  venues_total: plan.length, active: active.length, hubs: hubs.size,
  hub_centre_suspect: [...hubs.values()].filter((h) => h.centreVsMedianKm > 15).map((h) => `${h.slug} ${h.centreVsMedianKm}km`),
  actions: Object.fromEntries(['keep', 'move', 'slug-only', 'no-hub'].map((a) => [a, count((p) => p.action === a)])),
  move_by_confidence: Object.fromEntries(['high', 'medium', 'low'].map((c) => [c, count((p) => p.action === 'move' && p.confidence === c)])),
  keep_low_confidence: count((p) => p.action === 'keep' && p.confidence === 'low'),
  existing_redirects_to_retarget: active.filter((p) => p.action === 'move').reduce((s, p) => s + p.existing_redirects_in, 0),
  existing_redirect_chains_now: chainsNow,
  gsc: { rows: gscRows.length, by_action: gscRows.reduce((a, r) => ((a[r.action] = (a[r.action] ?? 0) + 1), a), {}) },
}, null, 2))
