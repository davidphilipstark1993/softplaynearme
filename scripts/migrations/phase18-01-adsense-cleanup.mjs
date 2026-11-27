// Phase 18-01: AdSense "low-value content" clean-up (27 Nov 2026).
//
// What it does (decisions in phase18-01-data.json, built from the Phase 1 audit in
// reports/adsense-phase1-audit.md and reviewed by hand; edit the JSON before running):
//   1. Retires (is_active = false) every active park-playground, mobile-hire and retail
//      row, plus the hand-reviewed off-category rows in `deactivate`.
//   2. Reclassifies inflatable/trampoline parks, leisure centres and family attractions
//      that were typed as soft play (`reclassify`). The indexing rules (lib/indexing.ts)
//      then keep them listed under "Other family activities" and noindex them until
//      they carry a verified fact.
//   3. Merges four duplicate listings (`merge`): the duplicate is retired, its URL 301s
//      to the kept row. Nothing is copied: each duplicate is a different business at the
//      same site (garden centre vs its playbarn), so its rating/hours aren't the survivor's.
//   4. Nulls junk values the importer left behind: "nan", "https://nan", "undefined",
//      and Google's placeholder images (default_user.png, result-no-thumbnail) stored as
//      if they were photos.
// Rows an owner has claimed or pays for are never retired or reclassified; they are
// listed for a manual decision instead.
//
//   node scripts/migrations/phase18-01-adsense-cleanup.mjs                     # dry run against the DB
//   node scripts/migrations/phase18-01-adsense-cleanup.mjs --write-files --gsc=seo-data/gsc-2026-11-24/perf/Pages.csv
//        # data/gone.json (410s) and data/redirects.json (merges, and retired URLs with GSC clicks -> their hub)
//        # pass --no-gsc instead of --gsc=… to accept 410 for everything
//   node scripts/migrations/phase18-01-adsense-cleanup.mjs --execute           # DB writes (backup first)
//   node scripts/migrations/phase18-01-adsense-cleanup.mjs --rollback=scripts/output/backups/phase18-01-….json
//   node scripts/migrations/phase18-01-adsense-cleanup.mjs --static            # apply the same plan to data/generated/*.json (no DB)
//
// Order: --write-files, deploy, --execute, then `npm run data:rebuild` (or --static) so the
// static export matches. Deploying the files first means a retired URL answers 410/301 the
// moment its row goes inactive, instead of 404ing in between.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const flag = (f) => args.includes(f)
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')
const EXECUTE = flag('--execute')
const STATIC = flag('--static')
const WRITE_FILES = flag('--write-files')
const ROLLBACK = opt('rollback')
const GSC = opt('gsc')
const PLAN = JSON.parse(readFileSync(path.join(ROOT, 'scripts/migrations/phase18-01-data.json'), 'utf8'))
const NOTE = 'phase18-01 (27 Nov 2026, AdSense clean-up)'

export const JUNK = new Set(['nan', 'https://nan', 'http://nan', 'undefined', 'null', 'none', 'n/a'])
export const PLACEHOLDER_IMAGE = /ssl\.gstatic\.com\/local\/servicebusiness\/default_user|maps\.gstatic\.com\/tactile\/pane\/result-no-thumbnail/
export const isJunk = (v) => typeof v === 'string' && (JUNK.has(v.trim().toLowerCase()) || v.trim() === '')
const JUNK_COLS = ['address', 'postcode', 'phone', 'website', 'main_image_url', 'google_maps_url']

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const url = (r) => `/soft-play/${r.city_slug}/${r.slug}`

/** GSC Pages export -> Map(path -> clicks). */
function loadClicks(file) {
  const rows = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split(','))
  const h = rows[0].map((x) => x.toLowerCase())
  const ci = h.indexOf('clicks')
  return new Map(rows.slice(1).map((r) => [r[0].replace('https://www.softplaynearme.co.uk', '').replace(/\/$/, '') || '/', Number(r[ci]) || 0]))
}

/**
 * The plan, computed from rows shaped like the DB (id, name, slug, city_slug, venue_type,
 * is_active, claimed_by_owner, plan, + JUNK_COLS). Shared by the DB and --static paths so
 * both apply exactly the same changes.
 */
export function buildPlan(rows) {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const protectedRow = (r) => r.claimed_by_owner === true || (r.plan && r.plan !== 'free')
  const out = { retire: [], reclassify: [], merge: [], junk: [], heldForOwner: [], missing: [] }
  const check = (id, name) => {
    const r = byId.get(id)
    if (!r) { out.missing.push(`${id} ${name}: not found`); return null }
    if (norm(r.name) !== norm(name)) { out.missing.push(`${id}: name is now "${r.name}", plan says "${name}"`); return null }
    if (!r.is_active) return null
    return r
  }
  const retireIds = new Set()
  for (const r of rows) {
    if (r.is_active && PLAN.deactivate_types.includes(r.venue_type)) {
      if (protectedRow(r)) out.heldForOwner.push(r); else { out.retire.push({ row: r, reason: `venue_type ${r.venue_type}` }); retireIds.add(r.id) }
    }
  }
  for (const d of PLAN.deactivate) {
    const r = check(d.id, d.name)
    if (!r || retireIds.has(r.id)) continue
    if (protectedRow(r)) out.heldForOwner.push(r); else { out.retire.push({ row: r, reason: d.reason }); retireIds.add(r.id) }
  }
  for (const c of PLAN.reclassify) {
    const r = check(c.id, c.name)
    if (!r || retireIds.has(r.id) || (r.venue_type || 'indoor') === c.to) continue
    if (protectedRow(r)) out.heldForOwner.push(r); else out.reclassify.push({ row: r, to: c.to })
  }
  for (const m of PLAN.merge) {
    const keep = check(m.keep, m.keep_name), dup = check(m.retire, m.retire_name)
    if (!keep || !dup || retireIds.has(dup.id)) continue
    if (protectedRow(dup)) { out.heldForOwner.push(dup); continue }
    out.merge.push({ keep, dup, why: m.why }); retireIds.add(dup.id)
  }
  for (const r of rows) {
    if (!r.is_active || retireIds.has(r.id)) continue
    const set = {}
    for (const c of JUNK_COLS) {
      if (r[c] == null) continue
      if ((isJunk(r[c]) && r[c] !== '') || (c === 'main_image_url' && PLACEHOLDER_IMAGE.test(r[c]))) set[c] = null
    }
    if (Object.keys(set).length) out.junk.push({ row: r, set })
  }
  return out
}

function printPlan(p) {
  const types = {}
  for (const { reason } of p.retire) types[reason.startsWith('venue_type') ? reason : 'hand-reviewed off-category'] = (types[reason.startsWith('venue_type') ? reason : 'hand-reviewed off-category'] ?? 0) + 1
  console.log(`Retire: ${p.retire.length}`, types)
  for (const { row, reason } of p.retire.filter((x) => !x.reason.startsWith('venue_type'))) console.log(`   ${row.id} ${row.name} (${reason})`)
  console.log(`Reclassify: ${p.reclassify.length}`)
  for (const { row, to } of p.reclassify) console.log(`   ${row.id} ${row.name}: ${row.venue_type || 'indoor'} -> ${to}`)
  console.log(`Merge: ${p.merge.length}`)
  for (const { keep, dup } of p.merge) console.log(`   ${url(dup)} -> ${url(keep)}`)
  const jc = {}
  for (const { set } of p.junk) for (const c of Object.keys(set)) jc[c] = (jc[c] ?? 0) + 1
  console.log(`Null junk values: ${p.junk.length} rows`, jc)
  if (p.heldForOwner.length) {
    console.log(`HELD (owner-claimed or paying, decide by hand): ${p.heldForOwner.length}`)
    for (const r of p.heldForOwner) console.log(`   ${r.id} ${r.name} ${url(r)}`)
  }
  if (p.missing.length) { console.log(`Skipped (row changed since the audit): ${p.missing.length}`); for (const m of p.missing) console.log(`   ${m}`) }
}

function writeFiles(p) {
  if (!GSC && !flag('--no-gsc')) {
    console.error('\n--write-files needs --gsc=<GSC Pages.csv> (retired URLs with clicks 301 to their hub instead of 410) or --no-gsc.')
    process.exit(1)
  }
  const clicks = GSC ? loadClicks(GSC) : new Map()
  const goneFile = path.join(ROOT, 'data/gone.json')
  const redirectsFile = path.join(ROOT, 'data/redirects.json')
  let gone = existsSync(goneFile) ? JSON.parse(readFileSync(goneFile, 'utf8')) : []
  const redirects = JSON.parse(readFileSync(redirectsFile, 'utf8'))
  // A run without GSC data may already have filed a URL as 410: one that turns out to
  // earn clicks becomes a 301 to its hub instead.
  gone = gone.filter((g) => !(g.reason?.startsWith(NOTE) && (clicks.get(g.path) ?? 0) > 0))
  const haveGone = new Set(gone.map((g) => g.path))
  const haveRedirect = new Set(redirects.map((r) => r.source))
  let to410 = 0, toHub = 0, merged = 0
  for (const { row, reason } of p.retire) {
    const u = url(row)
    if (haveRedirect.has(u) || haveGone.has(u)) continue
    if ((clicks.get(u) ?? 0) > 0) { redirects.push({ source: u, destination: `/soft-play/${row.city_slug}`, permanent: true }); toHub++ }
    else { gone.push({ path: u, reason: `${NOTE}: ${reason}` }); to410++ }
  }
  // Older URLs that 301 to a retired venue become 410 with it (lib/redirects.ts), unless
  // the old URL itself still earns clicks: then point it at the retired venue's hub.
  const retiredHub = new Map(p.retire.map(({ row }) => [url(row), `/soft-play/${row.city_slug}`]))
  let repointed = 0
  for (const r of redirects) {
    if (retiredHub.has(r.destination) && (clicks.get(r.source) ?? 0) > 0) { r.destination = retiredHub.get(r.destination); repointed++ }
  }
  if (repointed) console.log(`re-pointed ${repointed} older redirects with GSC clicks to the hub`)
  for (const { keep, dup } of p.merge) {
    // Older URLs that 301 to the duplicate go straight to the survivor (no chains).
    for (const r of redirects) if (r.destination === url(dup)) r.destination = url(keep)
    if (haveRedirect.has(url(dup))) continue
    redirects.push({ source: url(dup), destination: url(keep), permanent: true }); merged++
  }
  gone.sort((a, b) => a.path.localeCompare(b.path))
  writeFileSync(goneFile, JSON.stringify(gone, null, 2) + '\n')
  writeFileSync(redirectsFile, JSON.stringify(redirects, null, 2) + '\n')
  console.log(`\ndata/gone.json +${to410} (410)   data/redirects.json +${toHub} retired-with-clicks -> hub, +${merged} merges`)
}

// ── --static: same plan against data/generated/*.json ─────────────────────────
function staticRows() {
  const venues = JSON.parse(readFileSync(path.join(ROOT, 'data/generated/venues.json'), 'utf8'))
  return venues.map((v) => ({
    _v: v, id: v.id, name: v.name, slug: v.slug, city_slug: v.townSlug, venue_type: v.venueType || 'indoor', is_active: true,
    address: v.address, postcode: v.postcode, phone: v.phone, website: v.website, main_image_url: v.mainImageUrl, google_maps_url: v.mapsUrl,
  }))
}
const STATIC_FIELD = { address: 'address', postcode: 'postcode', phone: 'phone', website: 'website', main_image_url: 'mainImageUrl', google_maps_url: 'mapsUrl' }

function applyStatic(p, rows) {
  const drop = new Set([...p.retire.map((x) => x.row.id), ...p.merge.map((x) => x.dup.id)])
  for (const { row, to } of p.reclassify) row._v.venueType = to
  for (const { row, set } of p.junk) for (const c of Object.keys(set)) row._v[STATIC_FIELD[c]] = c === 'main_image_url' ? null : ''
  const venues = rows.filter((r) => !drop.has(r.id)).map((r) => r._v)
  const dir = path.join(ROOT, 'data/generated')
  const byTownOld = JSON.parse(readFileSync(path.join(dir, 'venuesByTown.json'), 'utf8'))
  const townsOld = JSON.parse(readFileSync(path.join(dir, 'towns.json'), 'utf8'))
  const byTown = {}
  for (const v of venues) (byTown[v.townSlug] ??= { town: byTownOld[v.townSlug]?.town ?? v.town, townSlug: v.townSlug, venues: [] }).venues.push(v)
  for (const t of Object.values(byTown)) t.venues.sort((a, b) => a.name.localeCompare(b.name))
  const VISIBLE = ['indoor', 'pub']
  const towns = townsOld.filter((t) => byTown[t.slug]).map((t) => {
    const vs = byTown[t.slug].venues, rated = vs.filter((v) => v.rating)
    return { ...t, venueCount: vs.filter((v) => VISIBLE.includes(v.venueType || 'indoor')).length, avgRating: rated.length ? (rated.reduce((s, v) => s + v.rating, 0) / rated.length).toFixed(1) : null }
  })
  writeFileSync(path.join(dir, 'venues.json'), JSON.stringify(venues, null, 2))
  writeFileSync(path.join(dir, 'venuesByTown.json'), JSON.stringify(byTown, null, 2))
  writeFileSync(path.join(dir, 'towns.json'), JSON.stringify(towns, null, 2))
  console.log(`\nStatic export: ${rows.length} -> ${venues.length} venues, ${townsOld.length} -> ${towns.length} towns`)
}

async function db() {
  const { getPool } = await import('./_lib.mjs')
  const pool = await getPool()
  const client = await pool.connect()
  try {
    if (ROLLBACK) {
      const backup = JSON.parse(readFileSync(ROLLBACK, 'utf8'))
      const cols = ['is_active', 'venue_type', 'notes', ...JUNK_COLS]
      await client.query('BEGIN')
      for (const row of backup.rows) {
        await client.query(`UPDATE venues SET ${cols.map((c, i) => `"${c}" = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`, [row.id, ...cols.map((c) => row[c])])
      }
      await client.query('COMMIT')
      console.log(`Restored ${backup.rows.length} rows from ${ROLLBACK}. Remove the matching entries from data/gone.json and data/redirects.json by hand (git revert of that commit).`)
      return
    }
    const { rows } = await client.query(`SELECT id, name, slug, city_slug, venue_type, is_active, claimed_by_owner, plan, notes, ${JUNK_COLS.join(', ')} FROM venues`)
    const p = buildPlan(rows)
    printPlan(p)
    if (WRITE_FILES) writeFiles(p)
    if (!EXECUTE) { console.log('\nDry run. Pass --execute to write to the DB.'); return }

    const touched = new Map()
    for (const x of [...p.retire, ...p.reclassify, ...p.junk]) touched.set(x.row.id, x.row)
    for (const { dup } of p.merge) touched.set(dup.id, dup)
    const dir = path.join(ROOT, 'scripts/output/backups')
    mkdirSync(dir, { recursive: true })
    const backupFile = path.join(dir, `phase18-01-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    writeFileSync(backupFile, JSON.stringify({ rows: [...touched.values()] }, null, 2))
    console.log(`\nBackup: ${backupFile}`)

    await client.query('BEGIN')
    const retire = async (id, why) => {
      const r = await client.query(`UPDATE venues SET is_active = false, updated_at = NOW(), notes = concat_ws(E'\\n', NULLIF(notes, ''), $2::text) WHERE id = $1 AND is_active = true`, [id, `Retired ${NOTE}: ${why}`])
      if (r.rowCount !== 1) throw new Error(`retire ${id}: ${r.rowCount} rows`)
    }
    for (const { row, reason } of p.retire) await retire(row.id, reason)
    for (const { keep, dup, why } of p.merge) await retire(dup.id, `duplicate of venue ${keep.id} (${url(keep)}): ${why}`)
    for (const { row, to } of p.reclassify) {
      await client.query(`UPDATE venues SET venue_type = $2, updated_at = NOW(), notes = concat_ws(E'\\n', NULLIF(notes, ''), $3::text) WHERE id = $1`, [row.id, to, `venue_type ${row.venue_type || 'indoor'} -> ${to}, ${NOTE}`])
    }
    for (const { row, set } of p.junk) {
      const cols = Object.keys(set)
      await client.query(`UPDATE venues SET ${cols.map((c) => `"${c}" = NULL`).join(', ')}, updated_at = NOW() WHERE id = $1`, [row.id])
    }
    await client.query('COMMIT')
    console.log(`Applied. Now run: npm run data:rebuild`)
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (STATIC) {
    const rows = staticRows()
    const p = buildPlan(rows)
    printPlan(p)
    if (WRITE_FILES) writeFiles(p)
    applyStatic(p, rows)
  } else {
    await db()
  }
}
