#!/usr/bin/env node
/**
 * Phase 2: Search Console opportunity model. Read-only; writes CSVs for review and
 * tracking. GSC data stays out of git (public repo), so inputs and outputs live in
 * seo-data/ (gitignored).
 *
 * Inputs: GSC Performance exports (Queries.csv, Pages.csv), the current one and an
 * older one whose 3-month window ends ~1 month earlier, for the trend column.
 *
 * ── How a row is scored (every number is in the CSV, nothing hidden) ──────────────
 * expected CTR   the site's OWN click-through rate for queries at that average
 *                position (bucketed, from the current export). Not an industry curve:
 *                "near me" searches show a map pack above organic results, so this
 *                site's CTR at positions 5–15 is ~0.5%, and that is the honest baseline.
 * ctr_gap        impressions × (expected CTR − actual CTR), floored at 0: clicks lost
 *                because this snippet under-performs other results at the same position.
 * rank_upside    impressions × (expected CTR at a position 4 places higher, floor 3 −
 *                expected CTR now): clicks a realistic ranking gain would add.
 * relevance      how well the query matches what the site is for:
 *                1.0 soft play / indoor play / play café / parties / toddler / baby / SEN
 *                0.6 a named venue (navigational: many want the venue's own site)
 *                0.5 adjacent (trampoline parks, playgrounds, hire, farms)
 *                0.2 anything else
 * difficulty     1.0 at positions ≤ 15, 0.6 at 15–30, 0.25 beyond (further = harder)
 * priority       (ctr_gap + rank_upside) × relevance × difficulty
 *                = estimated extra clicks per 3 months, weighted by fit and effort.
 *                It is a sorting aid for this site, not a Google metric.
 * trend          impressions now vs the older export (windows overlap ~2 months).
 *
 * Usage: node scripts/seo/gsc-opportunities.mjs
 *          [--now=seo-data/gsc-2026-11-24/perf] [--then=seo-data/gsc-2026-10-25/perf]
 *          [--out=seo-data/phase2] [--quality=seo-data/phase1/venue-quality.csv]
 */
import fs from 'node:fs'
import path from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v = true] = a.replace(/^--/, '').split('='); return [k, v] }))
const NOW = args.now ?? 'seo-data/gsc-2026-11-24/perf'
const THEN = args.then ?? 'seo-data/gsc-2026-10-25/perf'
const OUT = args.out ?? 'seo-data/phase2'
fs.mkdirSync(OUT, { recursive: true })

// RFC 4180: quoted fields may hold commas, quotes ("") and newlines (GSC keeps
// whatever people typed, including pasted multi-line prompts).
function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}
const readCsv = (f) => parseCsv(fs.readFileSync(f, 'utf8')).slice(1)
  .filter((c) => c.length >= 5 && c[0])
  .map((c) => ({ key: c[0].replace(/\s+/g, ' ').trim(), clicks: +c[1], impr: +c[2], ctr: +c[1] / +c[2] || 0, pos: +c[4] }))

// ── site CTR curve ──────────────────────────────────────────────────────────────
const BUCKETS = [[1, 3], [3, 5], [5, 8], [8, 11], [11, 15], [15, 20], [20, 30], [30, 1000]]
const queriesNow = readCsv(path.join(NOW, 'Queries.csv'))
const curve = BUCKETS.map(([lo, hi]) => {
  const rows = queriesNow.filter((r) => r.pos >= lo && r.pos < hi)
  const c = rows.reduce((n, r) => n + r.clicks, 0), i = rows.reduce((n, r) => n + r.impr, 0)
  return { lo, hi, ctr: i ? c / i : 0, impr: i }
})
// keep it monotonic (thin buckets are noisy): a higher position never expects less
for (let k = curve.length - 2; k >= 0; k--) curve[k].ctr = Math.max(curve[k].ctr, curve[k + 1].ctr)
const expected = (pos) => (curve.find((b) => pos >= b.lo && pos < b.hi) ?? curve.at(-1)).ctr

// ── classification ──────────────────────────────────────────────────────────────
const cities = JSON.parse(fs.readFileSync('data/cities.json', 'utf8'))
const towns = (() => { try { return Object.values(JSON.parse(fs.readFileSync('data/generated/towns.json', 'utf8'))) } catch { return [] } })()
const placeNames = [...new Set([...cities.map((c) => c.name), ...towns.map((t) => t.name ?? t.town).filter(Boolean)])]
  .map((n) => n.toLowerCase()).filter((n) => n.length > 3).sort((a, b) => b.length - a.length)
const venues = JSON.parse(fs.readFileSync('data/generated/venues.json', 'utf8'))
const norm = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const venueNames = [...new Set(venues.map((v) => norm(v.name).replace(/\b(ltd|limited|soft play|softplay|play centre|the)\b/g, ' ').replace(/\s+/g, ' ').trim()).filter((n) => n.length >= 5))]

const CORE = /soft ?play|softplay|indoor play|play ?(cafe|café)|play centre|play center|toddler|baby|babies|sen\b|sensory|autism|send\b|party|parties|birthday|kids play|childrens? play|play area|play barn|play ?zone|ball pit/
const ADJ = /trampoline|playground|play ?park|\bhire\b|farm|bounce|inflatable|adventure|ninja|climb|jungle|activities|things to do/
const theme = (q) =>
  /toddler|under ?5|under fives|tots/.test(q) ? 'toddler'
  : /baby|babies|under ?1/.test(q) ? 'baby'
  : /\bsen\b|send\b|sensory|autism|autistic|additional needs|disab/.test(q) ? 'sen-sensory'
  : /party|parties|birthday/.test(q) ? 'parties'
  : /cafe|café|coffee/.test(q) ? 'play-cafe'
  : /trampoline/.test(q) ? 'trampoline'
  : /playground|play ?park|park/.test(q) ? 'playground'
  : /\bhire\b/.test(q) ? 'hire'
  : /shire\b|yorkshire|\bcounty\b|sussex|essex|kent\b|surrey|norfolk|suffolk|devon|cornwall|dorset|cumbria|durham|northumberland|merseyside|tyne|midlands|lancs|cheshire|staffs/.test(q) ? 'county'
  : /indoor/.test(q) ? 'indoor-play'
  : /soft ?play|softplay/.test(q) ? 'soft-play'
  : 'other'

function classifyQuery(q) {
  const n = norm(q)
  const place = placeNames.find((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(n)) ?? ''
  const bare = n.replace(/\bthe\b/g, ' ').replace(/\s+/g, ' ')
  const venue = venueNames.find((v) => bare.includes(v)) ?? ''
  const nearMe = /near (me|by)|nearby|closest|nearest/.test(n)
  const scope = venue ? 'venue' : place ? 'city' : nearMe ? 'near-me' : 'national'
  const relevance = scope === 'venue' ? 0.6 : CORE.test(n) ? 1 : ADJ.test(n) ? 0.5 : 0.2
  return { scope, theme: theme(n), place, venue, relevance }
}

const pageType = (u) => {
  const p = new URL(u).pathname.split('/').filter(Boolean)
  if (!p.length) return 'home'
  if (p[0] === 'blog') return p.length > 1 ? 'blog' : 'blog-index'
  if (p[0] !== 'soft-play') return 'static'
  if (p.length === 1) return 'cities-index'
  if (p.length === 2) return new URL(u).search ? 'city-paged' : 'city'
  if (p[2] === 'area') return 'london-area'
  if (['toddler', 'birthday-parties', 'sen-friendly', 'open-now'].includes(p[2])) return 'city-filter'
  return 'venue'
}

const difficulty = (pos) => (pos <= 15 ? 1 : pos <= 30 ? 0.6 : 0.25)
const score = (r, relevance) => {
  const exp = expected(r.pos)
  const ctrGap = Math.max(0, r.impr * (exp - r.ctr))
  const target = Math.max(3, r.pos - 4)
  const rankUpside = Math.max(0, r.impr * (expected(target) - exp))
  return { expCtr: exp, ctrGap, rankUpside, difficulty: difficulty(r.pos), priority: (ctrGap + rankUpside) * relevance * difficulty(r.pos) }
}

const trendMap = (f) => new Map(readCsv(f).map((r) => [r.key, r]))
const trend = (thenMap, r) => {
  const t = thenMap.get(r.key)
  if (!t) return { imprThen: '', posThen: '', trend: 'new' }
  const d = r.impr - t.impr
  return { imprThen: t.impr, posThen: t.pos, trend: d >= 50 && r.impr >= t.impr * 1.3 ? 'growing' : -d >= 50 && r.impr <= t.impr * 0.7 ? 'declining' : 'steady' }
}

// ── queries ─────────────────────────────────────────────────────────────────────
const qThen = trendMap(path.join(THEN, 'Queries.csv'))
const queries = queriesNow.map((r) => { const c = classifyQuery(r.key); return { ...r, ...c, ...score(r, c.relevance), ...trend(qThen, r) } })
  .sort((a, b) => b.priority - a.priority)

// ── pages ───────────────────────────────────────────────────────────────────────
const pThen = trendMap(path.join(THEN, 'Pages.csv'))
let quality = new Map()
try {
  const [h, ...ls] = fs.readFileSync(args.quality ?? 'seo-data/phase1/venue-quality.csv', 'utf8').trim().split('\n')
  const cols = JSON.parse(`[${h.split(',').map((c) => JSON.stringify(c)).join(',')}]`)
  quality = new Map(ls.map((l) => { const o = Object.fromEntries(JSON.parse(`[${l}]`).map((v, i) => [cols[i], v])); return [o.path, o] }))
} catch { /* optional */ }
const pages = readCsv(path.join(NOW, 'Pages.csv')).map((r) => {
  const type = pageType(r.key)
  const relevance = type === 'venue' ? 0.8 : 1
  const q = quality.get(new URL(r.key).pathname)
  return { ...r, type, qualityBucket: q?.bucket ?? '', venueType: q?.venue_type ?? '', ...score(r, relevance), ...trend(pThen, r) }
}).sort((a, b) => b.priority - a.priority)

// ── write ───────────────────────────────────────────────────────────────────────
const pct = (x) => (x * 100).toFixed(2) + '%'
const num = (x) => (typeof x === 'number' ? Math.round(x * 10) / 10 : x)
const write = (file, rows, cols) => fs.writeFileSync(path.join(OUT, file),
  [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(c.endsWith('tr') && typeof r[c] === 'number' ? pct(r[c]) : num(r[c] ?? ''))).join(','))].join('\n'))
write('query-opportunities.csv', queries, ['key', 'scope', 'theme', 'place', 'venue', 'clicks', 'impr', 'ctr', 'pos', 'expCtr', 'ctrGap', 'rankUpside', 'relevance', 'difficulty', 'priority', 'imprThen', 'posThen', 'trend'])
write('page-opportunities.csv', pages, ['key', 'type', 'venueType', 'qualityBucket', 'clicks', 'impr', 'ctr', 'pos', 'expCtr', 'ctrGap', 'rankUpside', 'difficulty', 'priority', 'imprThen', 'posThen', 'trend'])
fs.writeFileSync(path.join(OUT, 'ctr-curve.json'), JSON.stringify(curve, null, 1))
console.log('CTR curve:', curve.map((b) => `${b.lo}-${b.hi}: ${pct(b.ctr)}`).join(' | '))
console.log(`${queries.length} queries, ${pages.length} pages -> ${OUT}/`)
