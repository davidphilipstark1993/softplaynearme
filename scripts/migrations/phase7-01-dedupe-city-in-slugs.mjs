// Phase 7-01: stop repeating the city in venue URL slugs.
//
//   /soft-play/hull/ping-pong-tots-hull-hull   ->  /soft-play/hull/ping-pong-tots
//   /soft-play/hull/monkey-bizness-hull-hull   ->  /soft-play/hull/monkey-bizness
//
// The old importers built slugs as `${name}-${city}`, so a venue already named
// "Ping Pong Tots Hull" got the city twice. The generator is fixed
// (scripts/lib/venue-slug.mjs, used by every importer); this migration rewrites the
// slugs that already exist.
//
// Scope (--scope):
//   repeated  (default) only slugs where the city repeats at the end (…-hull-hull):
//             the unambiguous bug, 116 venues.
//   all       also strip a single trailing -{city} (…-hull). That changes ~1,200
//             more indexed URLs for a cosmetic gain, so it is opt-in: decide
//             deliberately, then run with --scope=all.
//
// What it does (nothing is written without --execute):
//   1. new slug = name slug without the trailing city. A rewrite that would collide
//      with another venue in the same hub, a reserved path (toddler, open-now …) or
//      leave under 3 characters is skipped and reported — never forced.
//   2. data/generated/venues.json + venuesByTown.json: slug updated.
//   3. data/redirects.json: a permanent redirect old -> new for every changed slug.
//      Existing rules are re-pointed at the new URL (no redirect chains), and rules
//      that form a loop through a live page are dropped (there were three loops,
//      e.g. crazy-tykes-…-leeds <-> crazy-tykes-…-york).
//   4. Internal links in blog posts, city copy and code that point at any redirected
//      URL are rewritten to the final URL.
//   5. reports/slug-changes.csv lists every change for review.
//   6. With --db as well: UPDATE venues SET slug (only where id, city_slug and the old
//      slug still match). Run this against production BEFORE or together with the deploy.
//
// Usage:
//   node scripts/migrations/phase7-01-dedupe-city-in-slugs.mjs                 # dry run
//   node scripts/migrations/phase7-01-dedupe-city-in-slugs.mjs --execute       # repo files
//   node scripts/migrations/phase7-01-dedupe-city-in-slugs.mjs --execute --db   # + database

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { trailingCityCount, stripTrailingCity } from '../lib/venue-slug.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const EXECUTE = process.argv.includes('--execute')
const WITH_DB = process.argv.includes('--db')
const SCOPE = process.argv.find((a) => a.startsWith('--scope='))?.slice(8) ?? 'repeated'
if (!['repeated', 'all'].includes(SCOPE)) throw new Error('--scope must be "repeated" or "all"')
const MIN_REPEATS = SCOPE === 'all' ? 1 : 2

const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
const write = (rel, data) => EXECUTE && fs.writeFileSync(path.join(ROOT, rel), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n')

const venues = read('data/generated/venues.json')
const byTown = read('data/generated/venuesByTown.json')
const redirects = read('data/redirects.json')

// ── 1. decide new slugs ─────────────────────────────────────────────────────
const takenByHub = new Map()
for (const v of venues) {
  if (!takenByHub.has(v.townSlug)) takenByHub.set(v.townSlug, new Set())
  takenByHub.get(v.townSlug).add(v.slug)
}

const changes = []
const skipped = []
for (const v of venues) {
  if (trailingCityCount(v.slug, v.townSlug) < MIN_REPEATS) continue
  const next = stripTrailingCity(v.slug, v.townSlug)
  if (next === v.slug) {
    skipped.push({ v, reason: 'stripping would leave an unusable slug (under 3 characters or reserved)' })
    continue
  }
  const taken = takenByHub.get(v.townSlug)
  if (taken.has(next)) {
    skipped.push({ v, reason: `"${next}" is already used by another venue in ${v.townSlug}` })
    continue
  }
  taken.delete(v.slug)
  taken.add(next)
  changes.push({ v, from: v.slug, to: next })
}

console.log(`${EXECUTE ? 'EXECUTE' : 'DRY RUN'} — scope=${SCOPE}: ${changes.length} slug(s) to change, ${skipped.length} skipped.`)
for (const s of skipped) console.log(`  SKIP  ${s.v.townSlug}/${s.v.slug}: ${s.reason}`)

// ── 2. static JSON ──────────────────────────────────────────────────────────
const newSlugById = new Map(changes.map((c) => [c.v.id, c.to]))
for (const v of venues) if (newSlugById.has(v.id)) v.slug = newSlugById.get(v.id)
for (const entry of Object.values(byTown)) for (const v of entry.venues) if (newSlugById.has(v.id)) v.slug = newSlugById.get(v.id)
write('data/generated/venues.json', JSON.stringify(venues, null, 2))
write('data/generated/venuesByTown.json', JSON.stringify(byTown, null, 2))

// ── 3. redirects ────────────────────────────────────────────────────────────
const live = new Set(venues.map((v) => `/soft-play/${v.townSlug}/${v.slug}`))
const url = (hub, slug) => `/soft-play/${hub}/${slug}`

const rules = new Map(redirects.map((r) => [r.source, { ...r }]))
for (const c of changes) {
  rules.set(url(c.v.townSlug, c.from), { source: url(c.v.townSlug, c.from), destination: url(c.v.townSlug, c.to), permanent: true })
}

// A rule whose source is a page that still exists is wrong if it sits on a loop.
// Find loops, then drop the rule(s) in the loop that start from a live URL.
const droppedLoopRules = []
for (const start of [...rules.keys()]) {
  const path = []
  let cur = start
  while (rules.has(cur) && !path.includes(cur)) {
    path.push(cur)
    cur = rules.get(cur).destination
  }
  if (rules.has(cur) && path.includes(cur)) {
    const cycle = path.slice(path.indexOf(cur))
    for (const node of cycle) {
      if (live.has(node) && rules.has(node)) {
        droppedLoopRules.push(rules.get(node))
        rules.delete(node)
      }
    }
  }
}

const finalOf = (u) => {
  const seen = new Set()
  while (rules.has(u) && !seen.has(u)) {
    seen.add(u)
    u = rules.get(u).destination
  }
  return u
}
let repointed = 0
for (const [source, rule] of rules) {
  const dest = finalOf(rule.destination)
  if (dest === source) { rules.delete(source); continue } // self-redirect
  if (dest !== rule.destination) { rule.destination = dest; repointed++ }
}
const merged = [...rules.values()]
console.log(`redirects: ${redirects.length} -> ${merged.length} (+${changes.length} new, ${repointed} re-pointed to avoid chains, ${droppedLoopRules.length} loop rule(s) dropped)`)
for (const r of droppedLoopRules) console.log(`  DROP loop rule  ${r.source} -> ${r.destination}`)
write('data/redirects.json', merged)

// ── 4. internal links ───────────────────────────────────────────────────────
const LINK_RE = /\/soft-play\/([a-z0-9-]+)\/([a-z0-9-]+)(?![a-z0-9-])/g
function listFiles(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) listFiles(rel, out)
    else if (/\.(tsx?|json)$/.test(e.name)) out.push(rel)
  }
  return out
}
const linkFiles = [...listFiles('app'), ...listFiles('components'), ...listFiles('lib'), 'data/cities.json', 'data/hullCuratedVenues.ts']
let linksRewritten = 0
for (const rel of linkFiles) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  let count = 0
  const out = src.replace(LINK_RE, (m) => {
    const rule = rules.get(m)
    if (!rule) return m
    count++
    return rule.destination
  })
  if (count) {
    linksRewritten += count
    console.log(`  links: ${rel} (${count})`)
    write(rel, out)
  }
}
console.log(`internal links rewritten: ${linksRewritten}`)

// ── 5. CSV for review ───────────────────────────────────────────────────────
const csv = ['id,hub,old_slug,new_slug,old_url,new_url,status']
for (const c of changes) csv.push([c.v.id, c.v.townSlug, c.from, c.to, url(c.v.townSlug, c.from), url(c.v.townSlug, c.to), 'changed'].join(','))
for (const s of skipped) csv.push([s.v.id, s.v.townSlug, s.v.slug, '', '', '', `skipped: ${s.reason.replace(/,/g, ';')}`].join(','))
write('reports/slug-changes.csv', csv.join('\n') + '\n')

// ── 6. database ─────────────────────────────────────────────────────────────
if (WITH_DB) {
  const { getPool } = await import('./_lib.mjs')
  const pool = await getPool()
  try {
    let done = 0, missed = 0
    for (const c of changes) {
      if (!EXECUTE) { console.log(`  would UPDATE id=${c.v.id} ${c.from} -> ${c.to}`); continue }
      const res = await pool.query(
        `UPDATE venues SET slug = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND city_slug = $3 AND slug = $4
           AND NOT EXISTS (SELECT 1 FROM venues o WHERE o.city_slug = $3 AND o.slug = $1)`,
        [c.to, c.v.id, c.v.townSlug, c.from]
      )
      res.rowCount ? done++ : missed++
    }
    console.log(EXECUTE ? `DB: ${done} updated, ${missed} not matched (already changed, or new slug taken).` : 'DB: dry run only.')
  } finally {
    await pool.end()
  }
}
if (!EXECUTE) console.log('\nDry run — nothing written. Re-run with --execute to apply.')
