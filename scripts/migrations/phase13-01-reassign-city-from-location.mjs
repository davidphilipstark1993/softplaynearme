// Phase 13-01: move venues to the city hub their own address puts them in.
//
// Cause: the old importers stamped city_slug with the SEARCH city, not the venue's
// city (a Derby venue found in a Nottingham search became /soft-play/nottingham/...).
// Phase 11-01 fixed the slugs; this fixes the folder. The approved list (177 venues,
// Nov 2026) is frozen in phase13-01-data.json, produced by scripts/plan-city-reassignment.mjs
// (rules in scripts/lib/derive-city.mjs). A venue that moves and carries a wrong-city
// slug suffix loses it in the same hop; every other slug is kept as it is.
//
// Two halves:
//   --write-files   (no DB) the repo side, already committed with this script:
//                   data/redirects.json (old URL -> new URL, older redirects re-pointed so
//                   nothing chains), data/generated/*.json, and internal links in lib/app/
//                   components/data. Idempotent.
//   (default)       DRY RUN against the DB: checks every row is still where the plan
//                   found it and that no target URL is taken. Changes nothing.
//   --execute       UPDATEs city_slug / slug / city / county, and re-words the old city in
//                   generated SEO text (retext below), in one transaction, after
//                   writing a backup to scripts/output/backups/.
//   --rollback=<backup.json> [--execute]   puts the rows back.
//
// ORDER: deploy the code first, then run --execute whenever. Until the DB is updated the
// new URLs are served by a fallback in the venue page (lib/redirects.ts pendingSources),
// so no URL 404s on either side of the switch. Afterwards: `npm run data:rebuild`.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BASE = '/soft-play'
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/migrations/phase13-01-data.json'), 'utf8'))
const EXECUTE = process.argv.includes('--execute')
const WRITE_FILES = process.argv.includes('--write-files')
const ROLLBACK = process.argv.find((a) => a.startsWith('--rollback='))?.slice(11)
const REDIRECTS = path.join(ROOT, 'data/redirects.json')
const GEN = path.join(ROOT, 'data/generated')

// Indexed GSC URL with no redirect and no venue (an older "-and-" spelling of a closed
// venue). Same destination as its sibling spellings already in redirects.json.
const EXTRA_REDIRECTS = [
  { source: '/soft-play/hull/jump-inc-by-airhop-adventure-and-trampoline-park-beverley', destination: '/soft-play/hull' },
]

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const write = (f, data) => fs.writeFileSync(f, JSON.stringify(data, null, 2) + (f.startsWith(GEN) ? '' : '\n'))
const oldUrl = (m) => `${BASE}/${m.from_city}/${m.from_slug}`
const newUrl = (m) => `${BASE}/${m.to_city}/${m.to_slug}`

// Generated SEO text (enrich-seo-all / importer templates) names the hub city:
// "soft play in Leeds", "families across Leeds and West Yorkshire",
// "Children's Soft Play Centre, Leeds". Rewrite only those template contexts; anything
// else that still names the old city is listed for a human (it may be a road name, or
// a true "near Leeds").
const TEXT_FIELDS = ['seo_title', 'meta_description', 'description', 'seo_summary']
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function retext(text, from, to) {
  if (!text || from.name === to.name) return text
  const o = esc(from.name)
  let out = text
  if (from.county && to.county && from.county !== to.county) {
    out = out.replace(new RegExp(`\\b(across|throughout|serving) ${o} and ${esc(from.county)}\\b`, 'g'), `$1 ${to.name} and ${to.county}`)
  }
  out = out
    .replace(new RegExp(`(?<!Greater )\\b([Ii]n|across|serving|throughout|around|of) ${o}(?![\\w-])`, 'g'), `$1 ${to.name}`)
    .replace(new RegExp(`([,–|-]\\s*)${o}(\\s*(?:\\||$))`, 'g'), `$1${to.name}$2`)
    .replace(new RegExp(`(?<!Greater )\\b${o} families\\b`, 'g'), `${to.name} families`)
  if (from.county && to.county && from.county !== to.county) {
    out = out
      .replace(new RegExp(`\\b${esc(to.name)}, ${esc(from.county)}\\b`, 'g'), `${to.name}, ${to.county}`)
      .replace(new RegExp(`\\b${esc(to.name)} and the surrounding ${esc(from.county)} area\\b`, 'g'), `${to.name} and the surrounding ${to.county} area`)
  }
  return out
}

function hubInfo() {
  const cities = read(path.join(ROOT, 'data/cities.json'))
  const byTown = read(path.join(GEN, 'venuesByTown.json'))
  return (slug) => {
    const c = cities.find((x) => x.slug === slug)
    return { name: c?.name ?? byTown[slug]?.town ?? slug, county: c?.county ?? null, inCities: !!c }
  }
}

/** Redirect rules after the move: one hop from every old URL, nothing shadowing a live page. */
export function mergeRedirects(existing, moves, extra = []) {
  const moved = new Map(moves.map((m) => [oldUrl(m), newUrl(m)]))
  const nowLive = new Set(moved.values())
  const out = new Map()
  for (const r of existing) {
    if (nowLive.has(r.source)) continue // the new URL is a real page now
    const dest = moved.get(r.destination) ?? r.destination
    out.set(r.source, { ...r, destination: dest })
  }
  for (const [source, destination] of moved) out.set(source, { source, destination, permanent: true })
  for (const r of extra) if (!out.has(r.source)) out.set(r.source, { ...r, permanent: true })
  return [...out.values()]
}

function writeFiles() {
  const hub = hubInfo()
  // 1. redirects
  const before = read(REDIRECTS)
  const merged = mergeRedirects(before, DATA, EXTRA_REDIRECTS)
  const retargeted = before.filter((r) => DATA.some((m) => r.destination === oldUrl(m))).length
  write(REDIRECTS, merged)

  // 2. static export (same shape scripts/rebuild-static-json.mjs writes)
  const venues = read(path.join(GEN, 'venues.json'))
  const byId = new Map(venues.map((v) => [v.id, v]))
  let staticMoved = 0
  for (const m of DATA) {
    const v = byId.get(m.id)
    if (!v || (v.townSlug === m.to_city && v.slug === m.to_slug)) continue
    if (v.townSlug !== m.from_city || v.slug !== m.from_slug) throw new Error(`static venue ${m.id} is at ${v.townSlug}/${v.slug}, plan expected ${m.from_city}/${m.from_slug}`)
    Object.assign(v, { townSlug: m.to_city, town: hub(m.to_city).name, slug: m.to_slug, description: retext(v.description, hub(m.from_city), hub(m.to_city)) })
    staticMoved++
  }
  const VISIBLE = ['indoor', 'pub'] // lib/venueTypes.ts VISIBLE_VENUE_TYPES
  // Edit venuesByTown in place (keeps every untouched bucket byte-identical): take each
  // moved venue out of its old bucket and insert it, by name, into its new one.
  const grouped = read(path.join(GEN, 'venuesByTown.json'))
  const movedIds = new Set(DATA.map((m) => m.id))
  for (const g of Object.values(grouped)) g.venues = g.venues.filter((v) => !movedIds.has(v.id))
  for (const m of DATA) {
    const v = byId.get(m.id)
    if (!v) continue
    const g = (grouped[m.to_city] ??= { town: hub(m.to_city).name, townSlug: m.to_city, venues: [] })
    const at = g.venues.findIndex((x) => x.name.localeCompare(v.name) > 0)
    g.venues.splice(at === -1 ? g.venues.length : at, 0, v)
  }
  for (const k of Object.keys(grouped)) if (!grouped[k].venues.length) delete grouped[k]
  const emptied = [...new Set(DATA.map((m) => m.from_city))].filter((c) => !grouped[c] && !hub(c).inCities)
  if (emptied.length) throw new Error(`these hubs would lose their page (no venues left, not in cities.json): ${emptied.join(', ')}`)
  const towns = Object.values(grouped).map((g) => ({
    name: g.town, slug: g.townSlug,
    venueCount: g.venues.filter((v) => VISIBLE.includes(v.venueType)).length,
    avgRating: g.venues.some((v) => v.rating) ? (g.venues.reduce((s, v) => s + (v.rating || 0), 0) / g.venues.filter((v) => v.rating).length).toFixed(1) : null,
  })).sort((a, b) => a.name.localeCompare(b.name))
  write(path.join(GEN, 'venues.json'), venues)
  write(path.join(GEN, 'towns.json'), towns)
  write(path.join(GEN, 'venuesByTown.json'), Object.fromEntries(Object.keys(grouped).sort().map((k) => [k, grouped[k]])))

  // 3. hand-written links to an old URL (guides, blog posts) go straight to the new one
  const files = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name)
      if (e.isDirectory()) { if (!['node_modules', '.next', 'generated'].includes(e.name)) walk(f) }
      else if (/\.(tsx?|json|md)$/.test(e.name) && e.name !== 'redirects.json') files.push(f)
    }
  }
  for (const d of ['lib', 'app', 'components', 'data']) walk(path.join(ROOT, d))
  const pairs = DATA.map((m) => [new RegExp(oldUrl(m).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9-])', 'g'), newUrl(m)])
  let links = 0
  const touched = []
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8')
    if (!text.includes(`${BASE}/`)) continue
    let out = text
    for (const [re, to] of pairs) out = out.replace(re, () => { links++; return to })
    if (out !== text) { fs.writeFileSync(f, out); touched.push(path.relative(ROOT, f)) }
  }
  console.log(`redirects: ${before.length} -> ${merged.length} (${DATA.length} new, ${retargeted} re-pointed at the new URL, +${EXTRA_REDIRECTS.length} extra)`)
  console.log(`static export: ${staticMoved} venues moved, ${towns.length} towns`)
  console.log(`internal links rewritten: ${links} in ${touched.length} files ${touched.join(', ')}`)
}

async function db() {
  const { getPool } = await import('./_lib.mjs')
  const pool = await getPool()
  const client = await pool.connect()
  const hub = hubInfo()
  try {
    if (ROLLBACK) {
      const backup = read(ROLLBACK)
      console.log(`${EXECUTE ? 'ROLLBACK' : 'DRY RUN rollback'}: ${backup.length} venues`)
      if (!EXECUTE) return
      await client.query('BEGIN')
      for (const b of backup) {
        await client.query(
          `UPDATE venues SET city_slug=$1, slug=$2, city=$3, county=$4,
             seo_title=$5, meta_description=$6, description=$7, seo_summary=$8, updated_at=CURRENT_TIMESTAMP
           WHERE id=$9 AND city_slug=$10 AND slug=$11`,
          [b.city_slug, b.slug, b.city, b.county, b.seo_title, b.meta_description, b.description, b.seo_summary, b.id, b.to_city, b.to_slug])
      }
      await client.query('COMMIT')
      console.log('Rolled back. Redirects in data/redirects.json still point old -> new; revert that commit too if you are abandoning the move.')
      return
    }
    const { rows } = await client.query(`SELECT id, name, city_slug, slug, city, county, is_active, ${TEXT_FIELDS.join(', ')} FROM venues WHERE id = ANY($1)`, [DATA.map((m) => m.id)])
    const byId = new Map(rows.map((r) => [r.id, r]))
    const ok = [], skipped = [], textMentions = []
    let rewrites = 0
    for (const m of DATA) {
      const r = byId.get(m.id)
      if (!r) { skipped.push(`${m.id} ${m.name}: not found`); continue }
      if (r.city_slug === m.to_city && r.slug === m.to_slug) { skipped.push(`${m.id} ${m.name}: already moved`); continue }
      if (r.name !== m.name || r.city_slug !== m.from_city || r.slug !== m.from_slug || !r.is_active) {
        skipped.push(`${m.id} ${m.name}: DB has ${r.city_slug}/${r.slug} "${r.name}" active=${r.is_active}, plan expected ${m.from_city}/${m.from_slug}`); continue
      }
      const clash = await client.query('SELECT id FROM venues WHERE city_slug=$1 AND slug=$2 AND id<>$3', [m.to_city, m.to_slug, m.id])
      if (clash.rows.length) { skipped.push(`${m.id} ${m.name}: ${newUrl(m)} already taken by venue ${clash.rows[0].id}`); continue }
      const from = hub(m.from_city), to = hub(m.to_city)
      const text = Object.fromEntries(TEXT_FIELDS.map((f) => [f, retext(r[f], from, to)]))
      rewrites += TEXT_FIELDS.filter((f) => text[f] !== r[f]).length
      const scrub = (t) => t.replaceAll(r.name, '').replaceAll(to.county ?? '\0', '')
      const left = TEXT_FIELDS.filter((f) => text[f] && new RegExp(`\\b${esc(from.name)}\\b`).test(scrub(text[f])))
      if (left.length) textMentions.push(`${m.id} ${m.name}: ${left.map((f) => `${f} "…${scrub(text[f]).match(new RegExp(`.{0,35}\\b${esc(from.name)}\\b.{0,20}`))?.[0]}…"`).join('; ')}`)
      ok.push({ m, r, text })
    }
    console.log(`${EXECUTE ? 'EXECUTE' : 'DRY RUN'}: ${ok.length} to move, ${skipped.length} skipped`)
    for (const { m } of ok) console.log(`  ${oldUrl(m)} -> ${newUrl(m)}  [${m.confidence}] ${m.method}`)
    for (const s of skipped) console.log(`  SKIP ${s}`)
    console.log(`\nGenerated text: ${rewrites} field(s) re-worded from the old city to the new hub (template phrases only).`)
    if (textMentions.length) console.log(`${textMentions.length} venues still name their old city somewhere else in that text (left alone; review by hand):\n  ${textMentions.join('\n  ')}`)
    if (!EXECUTE || !ok.length) { if (!EXECUTE) console.log('\nDry run, nothing written. Re-run with --execute.'); return }

    const backupDir = path.join(ROOT, 'scripts/output/backups')
    fs.mkdirSync(backupDir, { recursive: true })
    const backupFile = path.join(backupDir, `phase13-01-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    write(backupFile, ok.map(({ m, r }) => ({
      id: r.id, city_slug: r.city_slug, slug: r.slug, city: r.city, county: r.county,
      ...Object.fromEntries(TEXT_FIELDS.map((f) => [f, r[f]])), to_city: m.to_city, to_slug: m.to_slug,
    })))
    await client.query('BEGIN')
    for (const { m, text } of ok) {
      const h = hub(m.to_city)
      await client.query(
        `UPDATE venues SET city_slug=$1, slug=$2, city=$3, county=COALESCE($4, county),
           seo_title=$5, meta_description=$6, description=$7, seo_summary=$8, updated_at=CURRENT_TIMESTAMP
         WHERE id=$9 AND city_slug=$10 AND slug=$11`,
        [m.to_city, m.to_slug, h.name, h.county, text.seo_title, text.meta_description, text.description, text.seo_summary, m.id, m.from_city, m.from_slug])
    }
    await client.query('COMMIT')
    console.log(`\nMoved ${ok.length}. Backup: ${path.relative(ROOT, backupFile)}\nNext: DATABASE_URL=... npm run data:rebuild (the committed static export already matches; this just refreshes it).`)
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (WRITE_FILES) writeFiles()
  else await db()
}
