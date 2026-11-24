#!/usr/bin/env node
/**
 * For every URL the crawl audit saw return 404, find out what it was and whether a
 * genuine replacement page exists. Read-only; writes a CSV for review.
 *
 * Identity of a 404 venue URL comes from the newest committed static export that
 * held it (name, postcode, Google place id). A replacement is:
 *   same-place   the one DB venue with the same Google place id
 *   same-name-pc the one DB venue with the same normalised name and postcode
 *   same-name    the one DB venue with the same normalised name in the same hub
 *   same-id      the DB row with the export's id, only if its name also matches
 *                (export ids were renumbered in spring 2026)
 * More than one candidate is ambiguous and is not matched. The replacement may be
 * inactive: its own URL already 301s (to its hub), and redirects.json flattens the
 * chain, so the old URL lands in one hop where the venue's current URL does.
 * Anything else is "no replacement" — a genuine removal, left as 404.
 *
 * Usage: DATABASE_URL=... node scripts/seo/resolve-404s.mjs
 *          [--crawl=seo-data/phase1/crawl.json] [--out=seo-data/phase1/404-resolution.csv]
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import pg from 'pg'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = true] = a.replace(/^--/, '').split('='); return [k, v] }))
const crawl = JSON.parse(fs.readFileSync(args.crawl ?? 'seo-data/phase1/crawl.json', 'utf8'))
const out = args.out ?? 'seo-data/phase1/404-resolution.csv'
const git = (...a) => execFileSync('git', a, { maxBuffer: 1 << 30 }).toString()
const norm = (s) => (s ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')

const missing = crawl.filter((r) => r.status === 404)
const want = new Map(missing.map((r) => [r.path, null]))

// newest export holding each path wins (git log is newest first)
for (const rev of git('log', '--format=%h|%ad', '--date=short', '--', 'data/generated/venues.json').trim().split('\n')) {
  const [h, date] = rev.split('|')
  let list
  try { list = JSON.parse(git('show', `${h}:data/generated/venues.json`)) } catch { continue }
  for (const v of list) {
    const p = `/soft-play/${v.townSlug ?? v.city_slug}/${v.slug}`
    if (want.has(p) && !want.get(p)) want.set(p, { ...v, _rev: h, _date: date })
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const { rows } = await pool.query('SELECT id, name, slug, city_slug, postcode, place_id, google_place_id, is_active, venue_type FROM venues')
await pool.end()
const byPlace = new Map(), byNamePc = new Map(), byNameHub = new Map(), byId = new Map()
for (const v of rows) {
  byId.set(v.id, v)
  for (const pid of [v.place_id, v.google_place_id].filter(Boolean)) (byPlace.get(pid) ?? byPlace.set(pid, []).get(pid)).push(v)
  if (v.postcode) (byNamePc.get(`${norm(v.name)}|${norm(v.postcode)}`) ?? byNamePc.set(`${norm(v.name)}|${norm(v.postcode)}`, []).get(`${norm(v.name)}|${norm(v.postcode)}`)).push(v)
  ;(byNameHub.get(`${norm(v.name)}|${v.city_slug}`) ?? byNameHub.set(`${norm(v.name)}|${v.city_slug}`, []).get(`${norm(v.name)}|${v.city_slug}`)).push(v)
}
const url = (v) => `/soft-play/${v.city_slug}/${v.slug}`
const liveOk = new Set(crawl.filter((r) => r.status === 200 || (r.hops && r.finalStatus === 200)).map((r) => r.path))

const res = []
for (const r of missing) {
  const h = want.get(r.path)
  const row = { path: r.path, sources: r.sources.join(' '), lastSeen: h?._date ?? '', name: h?.name ?? '', postcode: h?.postcode ?? '', match: '', replacement: '', replacementActive: '', replacementType: '' }
  if (h) {
    const pid = h.googlePlaceId ?? h.place_id
    // Export ids were renumbered in spring 2026, so an id alone proves nothing:
    // the row with the same id must also carry the same name.
    const exact = h.id && byId.get(h.id)
    const sameName = (v) => norm(v.name) === norm(h.name)
    const cands = [
      ['same-place', (pid && byPlace.get(pid)) || []],
      ['same-name-pc', (h.postcode && byNamePc.get(`${norm(h.name)}|${norm(h.postcode)}`)) || []],
      ['same-name', byNameHub.get(`${norm(h.name)}|${r.path.split('/')[2]}`) || []],
      ['same-id', exact && sameName(exact) ? [exact] : []],
    ]
    for (const [kind, all] of cands) {
      const list = all.filter((v) => url(v) !== r.path)
      // Two different rows with this identity (e.g. two "Play Area"s): ambiguous, skip.
      if (list.length !== 1) { if (list.length > 1) row.ambiguous = `${kind}:${list.length}`; continue }
      const v = list[0]
      row.match = kind
      row.replacement = url(v)
      row.replacementActive = v.is_active
      row.replacementType = v.venue_type ?? ''
      row.replacementLive = liveOk.has(url(v))
      break
    }
  } else if (r.path.startsWith('/blog/')) row.match = 'blog'
  res.push(row)
}
const cols = ['path', 'sources', 'lastSeen', 'name', 'postcode', 'match', 'ambiguous', 'replacement', 'replacementActive', 'replacementLive', 'replacementType']
fs.writeFileSync(out, [cols.join(','), ...res.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n'))
const t = {}
for (const r of res) { const k = `${r.match || 'none'}${r.match ? (r.replacementActive ? ':active' : ':inactive') : ''}`; t[k] = (t[k] ?? 0) + 1 }
console.log(out, res.length, t)
