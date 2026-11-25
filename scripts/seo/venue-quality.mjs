#!/usr/bin/env node
/**
 * Venue page quality classification (Phase 1 SEO audit). Read-only.
 *
 * NOT a Google ranking factor and not shown on the site. It sorts venue pages into
 * buckets so enrichment, merging and noindex decisions are made from evidence, with
 * every reason written next to the URL. Each rule is a plain fact about the row:
 *
 *   facts   verified things a parent can act on, 1 point each:
 *           opening hours (3+ days) · phone · website · a usable photo ·
 *           Google rating with 10+ reviews · 3+ confirmed facilities ·
 *           a review snippet · owner-supplied data
 *   unique  words in the description + what_to_expect + tips whose sentence
 *           (with the venue's name and town swapped for tokens) appears on no
 *           more than 3 other venues — i.e. text that is not template boilerplate
 *   broken  description fragments that end mid-sentence or repeat the name alone
 *
 * Buckets (first match wins):
 *   6 excluded      inactive, or a venue_type/score the page already noindexes
 *   3 duplicate     shares a Google place id, name+postcode or name+hub with another
 *                   active venue (survivor: the URL with GSC impressions, else the richer row)
 *   4 insufficient  no hours, no phone and no website: nothing a parent can verify
 *   2 enrich        facts < 5, or unique < 60
 *   1 strong        everything else
 * (Bucket 5, consolidation, is for hubs and is produced by crawl-report.mjs.)
 *
 * Usage: DATABASE_URL=... node scripts/seo/venue-quality.mjs
 *          [--gsc=seo-data/gsc-2026-11-24/perf/Pages.csv] [--out=seo-data/phase1/venue-quality.csv]
 */
import fs from 'node:fs'
import pg from 'pg'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = true] = a.replace(/^--/, '').split('='); return [k, v] }))
const out = args.out ?? 'seo-data/phase1/venue-quality.csv'
const NOINDEX_TYPES = ['park-playground', 'mobile-hire', 'retail'] // lib/venueContent.ts
const NOINDEX_THRESHOLD = 20
const FACILITY_KEYS = ['cafe', 'parking', 'parties', 'toddler_area', 'baby_area', 'sen_friendly', 'wheelchair_access', 'has_outdoor_play', 'free_wifi', 'air_conditioning', 'party_rooms', 'food_served', 'changing_facilities', 'role_play_area']

const gsc = new Map()
if (args.gsc) {
  for (const line of fs.readFileSync(args.gsc, 'utf8').split('\n').slice(1)) {
    const [u, clicks, impr, , pos] = line.split(',')
    if (u?.startsWith('http')) gsc.set(new URL(u).pathname, { clicks: +clicks, impr: +impr, pos: +pos })
  }
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
// owner_completeness > 0 means a verified owner has added data to the listing
const { rows } = await pool.query('SELECT *, (COALESCE(owner_completeness, 0) > 0) AS has_owner_data FROM venues')
await pool.end()

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sentencesOf = (v) => {
  const text = [v.description, v.what_to_expect, v.tips_before_visiting].filter(Boolean).join('\n')
  const name = (v.name ?? '').trim()
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 4).map((s) => ({
    raw: s,
    key: s.replace(new RegExp(esc(name), 'gi'), '{N}')
      .replace(new RegExp(esc(v.city ?? '~~'), 'gi'), '{T}')
      .replace(new RegExp(esc(v.city_slug ?? '~~').replace(/-/g, '[ -]'), 'gi'), '{T}')
      .replace(/\d+(\.\d+)?/g, '{#}').toLowerCase(),
  }))
}
const active = rows.filter((v) => v.is_active)
const freq = new Map()
for (const v of active) for (const k of new Set(sentencesOf(v).map((s) => s.key))) freq.set(k, (freq.get(k) ?? 0) + 1)

// duplicates
const norm = (s) => (s ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
const groups = new Map()
for (const v of active) {
  const keys = [v.place_id && `p:${v.place_id}`, v.google_place_id && `p:${v.google_place_id}`, v.postcode && `n:${norm(v.name)}|${norm(v.postcode)}`, `c:${norm(v.name)}|${v.city_slug}`].filter(Boolean)
  for (const k of new Set(keys)) (groups.get(k) ?? groups.set(k, []).get(k)).push(v)
}

const hasHours = (h) => h && typeof h === 'object' && Object.values(h.weekday_text ? Object.fromEntries(h.weekday_text.map((t, i) => [i, /closed/i.test(t) ? null : t])) : h).filter((x) => x != null).length >= 3
const photo = (v) => [v.main_image_url, ...(Array.isArray(v.photo_urls) ? v.photo_urls : []), ...(Array.isArray(v.images) ? v.images : [])].some((u) => typeof u === 'string' && /^https?:/.test(u))

const result = []
for (const v of rows) {
  const path = `/soft-play/${v.city_slug}/${v.slug}`
  const facts = {
    hours: hasHours(v.opening_hours),
    phone: !!v.phone,
    website: !!v.website,
    photo: photo(v),
    rating10: (v.reviews_count ?? v.review_count ?? 0) >= 10 && !!(v.rating ?? v.google_rating),
    facilities3: FACILITY_KEYS.filter((k) => v[k] === true).length >= 3,
    reviewSnippet: !!v.review_snippet,
    owner: !!v.has_owner_data,
  }
  const factCount = Object.values(facts).filter(Boolean).length
  const sents = sentencesOf(v)
  const uniqueWords = sents.filter((s) => (freq.get(s.key) ?? 0) <= 4).reduce((n, s) => n + s.raw.split(/\s+/).length, 0)
  const totalWords = sents.reduce((n, s) => n + s.raw.split(/\s+/).length, 0)
  const broken = /[A-Za-z]'\s*$|\b(the|a|and|while|with|of|to)\.?\s*$/i.test((v.description ?? '').trim()) || (v.description ?? '').trim().split('\n').some((l) => l.trim().replace(/['".]/g, '') === (v.name ?? '').trim())

  let dupOf = null
  if (v.is_active) {
    for (const k of [v.place_id && `p:${v.place_id}`, v.google_place_id && `p:${v.google_place_id}`, v.postcode && `n:${norm(v.name)}|${norm(v.postcode)}`, `c:${norm(v.name)}|${v.city_slug}`].filter(Boolean)) {
      const g = groups.get(k)
      if (g && g.length > 1) {
        const impr = (x) => gsc.get(`/soft-play/${x.city_slug}/${x.slug}`)?.impr ?? 0
        // Keep the URL Google already shows, then the richer row.
        const survivor = [...g].sort((a, b) => impr(b) - impr(a) || (b.completeness_score ?? 0) - (a.completeness_score ?? 0) || a.id - b.id)[0]
        if (survivor.id !== v.id) dupOf = `/soft-play/${survivor.city_slug}/${survivor.slug}`
        else dupOf = dupOf ?? 'SURVIVOR'
      }
    }
  }

  const reasons = []
  let bucket
  if (!v.is_active) { bucket = 6; reasons.push('inactive') }
  else if (NOINDEX_TYPES.includes(v.venue_type)) { bucket = 6; reasons.push(`type:${v.venue_type}`) }
  else if ((v.completeness_score ?? 100) < NOINDEX_THRESHOLD) { bucket = 6; reasons.push(`score:${v.completeness_score}`) }
  else if (dupOf && dupOf !== 'SURVIVOR') { bucket = 3; reasons.push(`duplicate-of:${dupOf}`) }
  else if (!facts.hours && !facts.phone && !facts.website) { bucket = 4; reasons.push('no hours/phone/website') }
  else if (factCount < 5 || uniqueWords < 60) {
    bucket = 2
    if (factCount < 5) reasons.push(`facts ${factCount}/8 missing: ${Object.entries(facts).filter(([, x]) => !x).map(([k]) => k).join(' ')}`)
    if (uniqueWords < 60) reasons.push(`unique words ${uniqueWords}/${totalWords}`)
  } else bucket = 1
  if (broken) reasons.push('broken description fragment')
  if (dupOf === 'SURVIVOR') reasons.push('has duplicates')

  const g = gsc.get(path)
  result.push({ id: v.id, path, name: v.name, venue_type: v.venue_type ?? '', active: v.is_active, bucket, factCount, uniqueWords, totalWords, score: v.completeness_score ?? '', broken, gscClicks: g?.clicks ?? '', gscImpr: g?.impr ?? '', gscPos: g?.pos ?? '', reasons: reasons.join('; ') })
}

const cols = Object.keys(result[0])
const csv = [cols.join(','), ...result.sort((a, b) => a.bucket - b.bucket || (+b.gscImpr || 0) - (+a.gscImpr || 0)).map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n')
fs.writeFileSync(out, csv)
const tally = {}
for (const r of result) tally[r.bucket] = (tally[r.bucket] ?? 0) + 1
console.log(out, 'buckets:', tally, 'broken:', result.filter((r) => r.broken && r.active).length,
  'boilerplate sentences (5+ venues):', [...freq.values()].filter((n) => n >= 5).length)
