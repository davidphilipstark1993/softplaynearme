#!/usr/bin/env node
/**
 * Builds the list of every URL Google may know about, for the Phase 1 crawl audit
 * (scripts/seo/crawl-audit.mjs). Read-only: git history, the DB and local files.
 *
 * Sources, each tagged so the audit can say where a URL came from:
 *   sitemap    the live https://www.softplaynearme.co.uk/sitemap.xml
 *   gsc        top pages in a GSC Performance export (Pages.csv)
 *   redirect   every source in data/redirects.json
 *   db         every venue row, active or not
 *   history    every venue URL any committed static export ever held
 *              (data/generated/venues.json, all revisions), and every blog slug
 *              lib/blogPosts*.ts ever held
 *   hubs       every city in data/cities.json + static towns, with filter pages
 *
 * Usage: node scripts/seo/url-inventory.mjs --gsc=seo-data/gsc-2026-11-24/perf/Pages.csv
 *        [--out=seo-data/phase1/url-inventory.json]
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const SITE = 'https://www.softplaynearme.co.uk'
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = true] = a.replace(/^--/, '').split('='); return [k, v] }))
const out = args.out ?? 'seo-data/phase1/url-inventory.json'

const urls = new Map() // path -> Set(source)
const add = (p, src) => {
  if (!p) return
  p = p.replace(SITE, '').replace(/^https?:\/\/(www\.)?softplaynearme\.co\.uk/, '') || '/'
  if (p.length > 1) p = p.replace(/\/+$/, '')
  ;(urls.get(p) ?? urls.set(p, new Set()).get(p)).add(src)
}
const git = (...a) => execFileSync('git', a, { maxBuffer: 1 << 30 }).toString()

// sitemap
const xml = await (await fetch(`${SITE}/sitemap.xml`)).text()
for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) add(m[1], 'sitemap')

// GSC pages
if (args.gsc) {
  for (const line of fs.readFileSync(args.gsc, 'utf8').split('\n').slice(1)) {
    const u = line.split(',')[0]
    if (u.startsWith('http')) add(new URL(u).pathname, 'gsc')
  }
}

// redirects
for (const r of JSON.parse(fs.readFileSync('data/redirects.json', 'utf8'))) add(r.source, 'redirect')

// DB
if (process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const { rows } = await pool.query('SELECT city_slug, slug, is_active FROM venues')
  for (const r of rows) add(`/soft-play/${r.city_slug}/${r.slug}`, r.is_active ? 'db' : 'db-inactive')
  await pool.end()
}

// history: venue URLs in every committed static export
const revs = git('log', '--format=%h', '--', 'data/generated/venues.json').trim().split('\n')
for (const rev of revs) {
  let list
  try { list = JSON.parse(git('show', `${rev}:data/generated/venues.json`)) } catch { continue }
  for (const v of Array.isArray(list) ? list : Object.values(list)) {
    const town = v.townSlug ?? v.city_slug
    if (town && v.slug) add(`/soft-play/${town}/${v.slug}`, 'history')
  }
}
// history: blog slugs ever committed
const blogRevs = git('log', '--format=%h', '--', 'lib').trim().split('\n')
const seenBlobs = new Set()
for (const rev of blogRevs) {
  const files = git('ls-tree', '-r', '--name-only', rev, 'lib').split('\n').filter((f) => /^lib\/blogPosts\w*\.ts$/.test(f))
  for (const f of files) {
    const blob = git('rev-parse', `${rev}:${f}`).trim()
    if (seenBlobs.has(blob)) continue
    seenBlobs.add(blob)
    for (const m of git('cat-file', '-p', blob).matchAll(/^\s*slug:\s*['"]([a-z0-9-]+)['"]/gm)) add(`/blog/${m[1]}`, 'history')
  }
}

// hubs
const cities = JSON.parse(fs.readFileSync('data/cities.json', 'utf8'))
const filters = ['toddler', 'birthday-parties', 'sen-friendly', 'open-now']
for (const c of Array.isArray(cities) ? cities : Object.values(cities)) {
  add(`/soft-play/${c.slug}`, 'hubs')
  for (const f of filters) add(`/soft-play/${c.slug}/${f}`, 'hubs')
}

const rows = [...urls].map(([p, s]) => ({ path: p, sources: [...s].sort() })).sort((a, b) => a.path.localeCompare(b.path))
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(rows, null, 1))
const bySrc = {}
for (const r of rows) for (const s of r.sources) bySrc[s] = (bySrc[s] ?? 0) + 1
console.log(`${rows.length} unique paths -> ${out}`, bySrc)
