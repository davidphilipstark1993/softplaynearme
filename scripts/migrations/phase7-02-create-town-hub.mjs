// Phase 7-02: give a town its own hub page once it has 3+ soft play venues.
//
//   node scripts/migrations/phase7-02-create-town-hub.mjs --town=Scunthorpe --nearby=Doncaster,Lincoln,Hull
//   node scripts/migrations/phase7-02-create-town-hub.mjs --town=Scunthorpe --nearby=… --execute [--db]
//
// Options: --min=N        genuine soft play venues needed (default 3; the Hull-area sweep of 12 Nov 2026
//                         asked for hubs with at least 1 — pass --min=1 deliberately)
//          --region=…     cities.json region (default East Midlands)
//          --ids=78,31    only move these venue ids
//          --allow-existing  move venues into a hub that already exists (no cities.json entry is added)
//          --keep-slugs   don't strip the old hub's suffix from slugs (use when the DB change is city_slug only)//
// A venue's "home town" comes from its postcode (data/postcode-localities.json). Venues
// in that town that are filed under another hub (Scunthorpe venues under Doncaster) move
// to the new hub. Needs 3+ genuine soft play venues (indoor/pub); fewer aborts. What it
// does (dry run unless --execute):
//   - moves every venue whose home town matches (all types) to the new hub in the static
//     JSON and drops the old hub's city suffix from its slug (…-doncaster);
//   - adds a city entry to data/cities.json (+ cities-basic.json), recomputes towns.json;
//   - adds 301 redirects old URL -> new URL, re-points existing rules (no chains), and
//     rewrites internal links to the old URLs;
//   - with --db: UPDATE venues SET city_slug, town_slug, town, slug (only where id, old
//     city_slug and old slug still match).
// Remember to teach scripts/migrations/_geo.mjs the town's postcode districts so the
// location checker doesn't suggest moving the venues back.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripTrailingCity } from '../lib/venue-slug.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const EXECUTE = process.argv.includes('--execute')
const WITH_DB = process.argv.includes('--db')
const TOWN = arg('town')
if (!TOWN) throw new Error('--town=Name is required')
const MIN = Number(arg('min') ?? 3)
const REGION = arg('region') ?? 'East Midlands'
const ONLY_IDS = arg('ids') ? new Set(arg('ids').split(',').map(Number)) : null
const ALLOW_EXISTING = process.argv.includes('--allow-existing')
const KEEP_SLUGS = process.argv.includes('--keep-slugs')
const NEARBY = (arg('nearby') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const SLUG = slugOf(TOWN)

const readRaw = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const read = (rel) => JSON.parse(readRaw(rel))
const write = (rel, text) => EXECUTE && fs.writeFileSync(path.join(ROOT, rel), text)
const json = (v) => JSON.stringify(v, null, 2)

const localities = read('data/postcode-localities.json')
const venues = read('data/generated/venues.json')
const byTown = read('data/generated/venuesByTown.json')
const towns = read('data/generated/towns.json')
const redirects = read('data/redirects.json')
const citiesRaw = readRaw('data/cities.json')
const cities = JSON.parse(citiesRaw)

const VISIBLE = new Set(['indoor', 'pub'])
const district = (pc) => String(pc ?? '').trim().toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/)?.[1]
const localityOf = (v) => localities.venueOverrides[String(v.id)] ?? localities.districts[district(v.postcode)] ?? null

const movers = venues.filter((v) => localityOf(v) === TOWN && v.townSlug !== SLUG && (!ONLY_IDS || ONLY_IDS.has(v.id)))
const visibleCount = movers.filter((v) => VISIBLE.has(v.venueType) || !v.venueType).length
console.log(`${EXECUTE ? 'EXECUTE' : 'DRY RUN'}: ${movers.length} venue(s) in ${TOWN} (${visibleCount} genuine soft play) filed under other hubs.`)
if (visibleCount < MIN) {
  console.error(`Aborting: a hub needs ${MIN}+ soft play venues, ${TOWN} has ${visibleCount}.`)
  process.exit(1)
}
const hubExists = cities.some((c) => c.slug === SLUG)
if (hubExists && !ALLOW_EXISTING) throw new Error(`${SLUG} already has a hub (pass --allow-existing to move venues into it)`)
if (!hubExists && ALLOW_EXISTING) throw new Error(`${SLUG} has no hub yet; drop --allow-existing`)
const county = localities.counties[TOWN] ?? cities.find((c) => c.slug === SLUG)?.county
if (!county) throw new Error(`No county for ${TOWN} in data/postcode-localities.json -> counties`)

// new slugs
const taken = new Set((byTown[SLUG]?.venues ?? []).map((v) => v.slug))
const plan = movers.map((v) => {
  const base = KEEP_SLUGS ? v.slug : stripTrailingCity(v.slug, v.townSlug)
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  taken.add(slug)
  return { v, oldHub: v.townSlug, oldSlug: v.slug, newSlug: slug }
})
for (const p of plan) console.log(`  /soft-play/${p.oldHub}/${p.oldSlug}  ->  /soft-play/${SLUG}/${p.newSlug}   [${p.v.name}]`)

// static JSON
const byId = new Map(plan.map((p) => [p.v.id, p]))
const apply = (v) => {
  const p = byId.get(v.id)
  if (p) Object.assign(v, { town: TOWN, townSlug: SLUG, slug: p.newSlug })
}
venues.forEach(apply)
const regrouped = {}
for (const entry of Object.values(byTown)) for (const v of entry.venues) apply(v)
for (const v of venues) {
  regrouped[v.townSlug] ??= { town: v.town, townSlug: v.townSlug, venues: [] }
  regrouped[v.townSlug].venues.push(v)
}
// keep the existing key order, new hub inserted alphabetically
const ordered = Object.fromEntries(
  [...new Set([...Object.keys(byTown), SLUG])].sort().map((k) => [k, { ...regrouped[k], venues: regrouped[k].venues.sort((a, b) => a.name.localeCompare(b.name)) }])
)
const townRow = (slug) => {
  const list = ordered[slug].venues
  const rated = list.filter((x) => x.rating)
  return {
    name: ordered[slug].town,
    slug,
    venueCount: list.filter((x) => VISIBLE.has(x.venueType)).length,
    avgRating: rated.length ? (rated.reduce((s, x) => s + (x.rating || 0), 0) / rated.length).toFixed(1) : null,
  }
}
const newTowns = towns.filter((t) => t.slug in ordered).map((t) => townRow(t.slug))
newTowns.push(townRow(SLUG))
newTowns.sort((a, b) => a.name.localeCompare(b.name))
write('data/generated/venues.json', json(venues))
write('data/generated/venuesByTown.json', json(ordered))
write('data/generated/towns.json', json(newTowns))

// cities.json: append in the same shape as the other entries, without reformatting the file
if (!hubExists) {
const existingNames = new Set(cities.map((c) => c.name))
const nearbyAreas = NEARBY.filter((n) => existingNames.has(n))
const entry = {
  slug: SLUG, name: TOWN, county, region: REGION,
  metaTitle: `Soft Play in ${TOWN}`,
  metaDescription: `Find soft play centres in ${TOWN}, ${county}. Compare venues, facilities and ratings.`,
  h1: `Soft Play Centres in ${TOWN}`,
  intro: `Soft play centres in ${TOWN} and the surrounding area of ${county}.`,
  nearbyAreas,
  faqs: [],
}
const insert = ',\n  ' + json(entry).split('\n').join('\n  ')
const closing = citiesRaw.lastIndexOf('\n]')
write('data/cities.json', citiesRaw.slice(0, closing) + insert + citiesRaw.slice(closing))
cities.push(entry)
write('data/cities-basic.json', json(cities.map((c) => ({ slug: c.slug, name: c.name, county: c.county }))) + '\n')
}

// redirects (+ flatten) and internal links
const rules = new Map(redirects.map((r) => [r.source, { ...r }]))
for (const p of plan) {
  const source = `/soft-play/${p.oldHub}/${p.oldSlug}`
  rules.set(source, { source, destination: `/soft-play/${SLUG}/${p.newSlug}`, permanent: true })
}
const finalOf = (u) => { const seen = new Set(); while (rules.has(u) && !seen.has(u)) { seen.add(u); u = rules.get(u).destination } return u }
for (const [s, r] of rules) { const d = finalOf(r.destination); if (d === s) rules.delete(s); else r.destination = d }
write('data/redirects.json', json([...rules.values()]) + '\n')
console.log(`redirects: ${redirects.length} -> ${rules.size}`)

const LINK_RE = /\/soft-play\/([a-z0-9-]+)\/([a-z0-9-]+)(?![a-z0-9-])/g
const files = []
const walk = (dir) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const rel = path.join(dir, e.name); e.isDirectory() ? walk(rel) : /\.(tsx?|json)$/.test(e.name) && files.push(rel) } }
;['app', 'components', 'lib'].forEach(walk)
files.push('data/hullCuratedVenues.ts')
let links = 0
for (const rel of files) {
  const src = readRaw(rel)
  let n = 0
  const out = src.replace(LINK_RE, (m) => (rules.has(m) ? (n++, rules.get(m).destination) : m))
  if (n) { links += n; console.log(`  links: ${rel} (${n})`); write(rel, out) }
}
console.log(`internal links rewritten: ${links}`)

if (WITH_DB) {
  const { getPool } = await import('./_lib.mjs')
  const pool = await getPool()
  try {
    let done = 0
    for (const p of plan) {
      if (!EXECUTE) { console.log(`  would UPDATE id=${p.v.id}`); continue }
      const r = await pool.query(
        `UPDATE venues SET city_slug = $1, town_slug = $1, town = $2, slug = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 AND city_slug = $5 AND slug = $6
            AND NOT EXISTS (SELECT 1 FROM venues o WHERE o.city_slug = $1 AND o.slug = $3)`,
        [SLUG, TOWN, p.newSlug, p.v.id, p.oldHub, p.oldSlug]
      )
      done += r.rowCount
    }
    console.log(EXECUTE ? `DB: ${done}/${plan.length} updated` : 'DB: dry run only')
  } finally { await pool.end() }
}
if (!EXECUTE) console.log('\nDry run — nothing written. Re-run with --execute.')
