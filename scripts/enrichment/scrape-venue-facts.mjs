#!/usr/bin/env node
// Read-only venue website scraper -> review queue (Phase 2D, 27 Nov 2026).
//
// For each active venue with a website: fetch the home page and up to 3 same-site pages
// that look like prices / parties / SEN / about / FAQ, extract fact candidates with the
// sentence that supports each (scripts/enrichment/extract.mjs), and queue them. It never
// writes to the venues table: scripts/enrichment/review-queue.mjs applies what a person
// approves, recording source URL and date (venue_fact_sources).
//
// Polite by default: robots.txt is honoured, one request per second per site, 10 s
// timeout, at most 4 pages per venue, and an identifying User-Agent.
//
//   node scripts/enrichment/scrape-venue-facts.mjs --static --limit=20             # from the static export, queue to a JSON file
//   node scripts/enrichment/scrape-venue-facts.mjs --limit=200                     # from the DB, queue to a JSON file
//   node scripts/enrichment/scrape-venue-facts.mjs --limit=200 --write-db          # from the DB, insert into venue_fact_candidates
//   options: --city=<slug>  --ids=1,2,3  --only-missing (skip venues already indexable)  --out=<file>
//
// Default output: seo-data/enrichment/candidates-<date>.json (gitignored with seo-data/).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pageText, extractFacts, interestingLinks, robotsDisallows } from './extract.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')
const has = (k) => process.argv.includes(`--${k}`)
const LIMIT = Number(arg('limit') ?? 50)
const CITY = arg('city')
const IDS = arg('ids')?.split(',').map(Number)
const UA = 'SoftPlayDirectoryBot/1.0 (+https://www.softplaynearme.co.uk/about)'
const TODAY = new Date().toISOString().slice(0, 10)
const OUT = arg('out') ?? path.join(ROOT, 'seo-data', 'enrichment', `candidates-${TODAY}.json`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 10_000)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,text/plain;q=0.9' }, signal: ctrl.signal, redirect: 'follow' })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !/text\/(html|plain)/.test(type)) return null
    return { url: res.url, body: (await res.text()).slice(0, 2_000_000) }
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** Venue rows: { id, name, website, known: {field: true} } */
async function loadVenues() {
  if (has('static')) {
    const venues = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/generated/venues.json'), 'utf8'))
    return venues
      .filter((v) => v.website && (!CITY || v.townSlug === CITY) && (!IDS || IDS.includes(v.id)))
      .map((v) => ({
        id: v.id, name: v.name, website: v.website,
        known: { toddler_area: v.toddlerArea, baby_area: v.babyArea, has_sen_sessions: v.hasSenSessions, parties: v.parties, has_party_rooms: v.hasPartyRooms, cafe: v.cafe, parking: v.parking, free_parking: false, has_soft_play: v.hasSoftPlay, age_range: v.ageRangeMax != null, price_from: v.priceFrom != null },
      }))
  }
  const { getPool } = await import('../migrations/_lib.mjs')
  const pool = await getPool()
  const { rows } = await pool.query(
    `SELECT id, name, website, toddler_area, baby_area, has_sen_sessions, parties, has_party_rooms, cafe, parking, free_parking, has_soft_play, age_range_max, price_from
       FROM venues WHERE is_active = true AND website IS NOT NULL AND website <> ''
       ${CITY ? 'AND city_slug = $1' : ''} ORDER BY id`,
    CITY ? [CITY] : [],
  )
  await pool.end()
  return rows
    .filter((v) => !IDS || IDS.includes(v.id))
    .map((v) => ({ id: v.id, name: v.name, website: v.website, known: { ...v, age_range: v.age_range_max != null, price_from: v.price_from != null } }))
}

async function scrapeVenue(v, robotsCache) {
  let start
  try { start = new URL(/^https?:/i.test(v.website) ? v.website : `https://${v.website}`) } catch { return [] }
  if (!robotsCache.has(start.host)) {
    const r = await get(`${start.protocol}//${start.host}/robots.txt`)
    robotsCache.set(start.host, r?.body ?? '')
  }
  const robots = robotsCache.get(start.host)
  if (robotsDisallows(robots, start.pathname || '/')) return [{ skipped: 'robots.txt' }]
  const home = await get(start.toString())
  if (!home) return []
  const pages = [home]
  for (const link of interestingLinks(home.body, home.url, 3)) {
    if (robotsDisallows(robots, new URL(link).pathname)) continue
    await sleep(1000)
    const p = await get(link)
    if (p) pages.push(p)
  }
  const known = { ...v.known }
  const out = []
  for (const p of pages) {
    for (const c of extractFacts(pageText(p.body), p.url, known)) {
      known[c.field] = true
      out.push({ venue_id: v.id, venue_name: v.name, ...c, fetched_at: TODAY })
    }
  }
  return out
}

async function main() {
  const venues = (await loadVenues()).slice(0, LIMIT)
  console.log(`Scraping ${venues.length} venue websites (read-only)…`)
  const robotsCache = new Map()
  const all = []
  let i = 0, skippedRobots = 0, failed = 0
  for (const v of venues) {
    i++
    const found = await scrapeVenue(v, robotsCache)
    if (found[0]?.skipped) { skippedRobots++; continue }
    if (!found.length) failed++
    all.push(...found)
    if (i % 10 === 0) console.log(`  ${i}/${venues.length}: ${all.length} candidates`)
    await sleep(1000)
  }
  const byField = all.reduce((m, c) => ((m[c.field] = (m[c.field] ?? 0) + 1), m), {})
  console.log(`Done: ${all.length} candidates`, byField, `| robots.txt said no: ${skippedRobots} | nothing found / unreachable: ${failed}`)

  if (has('write-db')) {
    const { getPool } = await import('../migrations/_lib.mjs')
    const pool = await getPool()
    let n = 0
    for (const c of all) {
      const r = await pool.query(
        `INSERT INTO venue_fact_candidates (venue_id, field, value, evidence, source_url, fetched_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [c.venue_id, c.field, JSON.stringify(c.value), c.evidence.slice(0, 1000), c.source_url, c.fetched_at],
      )
      n += r.rowCount
    }
    await pool.end()
    console.log(`Queued ${n} new candidates in venue_fact_candidates (duplicates of pending ones skipped).`)
  } else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(all, null, 2))
    console.log(`Wrote ${OUT}. Review it, then: node scripts/enrichment/review-queue.mjs import --file=${path.relative(ROOT, OUT)}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
