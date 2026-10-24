#!/usr/bin/env node
/**
 * Rewrite the generic-template "best soft play in <city>" blog guides so each one
 * is built from the live venue data: real names, ratings, review counts,
 * localities and confirmed facility flags. Every sentence is derived from a
 * database field, so nothing in a guide can be invented or drift from the data.
 *
 *   node scripts/generate-city-guides.mjs                 # dry run, prints a summary
 *   node scripts/generate-city-guides.mjs --write         # rewrites those posts in lib/blogPosts.ts
 *   node scripts/generate-city-guides.mjs --write --city=cardiff,leicester
 *
 * Deliberately NOT used: opening hours (opening_hours_text holds opening times
 * only, with no closing times), prices and age limits (not held for these venues).
 * A venue is only named under a city when it lies within MAX_KM of the hub's
 * median centre, so a venue that was historically mis-filed under the wrong
 * region is never described as being "in" it. Needs DATABASE_URL (read from .env.local if unset).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.argv.includes('--write')
const ONLY = process.argv.find((a) => a.startsWith('--city='))?.slice(7).split(',')
const TODAY = '2026-10-24T00:00:00.000Z'

// hub slug -> display name (hubs cover a region, so membership is by distance, below)
const CITIES = {
  bournemouth: { name: 'Bournemouth' },
  brighton: { name: 'Brighton' },
  cardiff: { name: 'Cardiff' },
  colchester: { name: 'Colchester' },
  hastings: { name: 'Hastings' },
  ipswich: { name: 'Ipswich' },
  norwich: { name: 'Norwich' },
  portsmouth: { name: 'Portsmouth' },
  southend: { name: 'Southend-on-Sea', short: 'Southend' },
  swansea: { name: 'Swansea' },
  huddersfield: { name: 'Huddersfield' },
  edinburgh: { name: 'Edinburgh' },
  glasgow: { name: 'Glasgow' },
  aberdeen: { name: 'Aberdeen' },
  leicester: { name: 'Leicester' },
  blackpool: { name: 'Blackpool' },
  york: { name: 'York' },
}
const MAX_KM = 35
const MIN_VENUES = 8 // below this a guide would be a list of everything, not a guide

const MIN_REVIEWS = 20
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const num = (n) => Number(n).toLocaleString('en-GB')
const stars = (r) => Number(r).toFixed(1)
const list = (items) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`

function loadEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const m = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)
  return m[1].replace(/^["']|["']$/g, '')
}

const localities = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/postcode-localities.json'), 'utf8'))
const district = (pc) => String(pc ?? '').trim().toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/)?.[1]
const localityOf = (v) => localities.venueOverrides?.[String(v.id)] ?? localities.districts?.[district(v.postcode)] ?? null
const km = (a, b) => {
  const r = (d) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
/** Venues within MAX_KM of the hub's median centre (venues with no coordinates can't be placed, so are left out). */
function nearCentre(all) {
  const pts = all.filter((v) => v.lat && v.lng).map((v) => ({ v, lat: Number(v.lat), lng: Number(v.lng) }))
  if (!pts.length) return []
  const c = { lat: median(pts.map((p) => p.lat)), lng: median(pts.map((p) => p.lng)) }
  return pts.filter((p) => km(c, p) <= MAX_KM).map((p) => p.v)
}

/** Classes, clubs and services that sit in the soft play data but aren't places to play. */
const NOT_A_VENUE = /\b(classes|class|signing|nursery|nurseries|childminder|swim|school|hire|entertainers?|casino|caravan|leisure centre|sports centre|sports hall|community|church|library|toddler sense|tots play|baby sensory)\b/i
/** One entry per real venue: duplicate Google listings share a name and review count. */
function dedupe(vs) {
  const seen = new Set()
  return vs.filter((v) => {
    const key = `${v.name.toLowerCase().replace(/[^a-z0-9]/g, '')}|${v.reviews_count ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const link = (city, v, text = v.name) => `<a href="/soft-play/${city}/${v.slug}" class="text-purple-700 hover:underline">${esc(text)}</a>`
const rated = (v) => v.rating && v.reviews_count >= MIN_REVIEWS
const byQuality = (a, b) => Number(b.rating) - Number(a.rating) || b.reviews_count - a.reviews_count || a.name.localeCompare(b.name)
const byVolume = (a, b) => b.reviews_count - a.reviews_count || Number(b.rating) - Number(a.rating)

function buildGuide(slug, cfg, all) {
  const { name } = cfg
  const short = cfg.short ?? name
  const vs = dedupe(nearCentre(all).filter((v) => !NOT_A_VENUE.test(v.name)))
  const outside = all.length - vs.length
  if (vs.length < MIN_VENUES) return null

  const ratedVs = vs.filter(rated)
  const best = [...ratedVs].sort(byQuality)
  const volume = [...ratedVs].sort(byVolume)
  const topQuality = best.slice(0, 5)
  const topVolume = volume.filter((v) => v !== volume[0] && !topQuality.includes(v)).slice(0, 3)

  // where the venues are
  const loc = new Map()
  for (const v of vs) {
    const l = localityOf(v)
    if (l) loc.set(l, [...(loc.get(l) ?? []), v])
  }
  const areas = [...loc.entries()].sort((a, b) => b[1].length - a[1].length)
  const multiArea = areas.length >= 2
  const placeOf = (v) => {
    const l = localityOf(v)
    return l && l !== name && l !== short ? ` (${esc(l)})` : ''
  }

  const fac = (key) => vs.filter((v) => v[key])
  const cafe = fac('cafe'), parties = fac('parties'), toddler = fac('toddler_area'), baby = fac('baby_area')
  const sen = fac('sen_friendly'), wheel = fac('wheelchair_access'), parking = fac('parking'), outdoor = fac('has_outdoor_play')
  const nameList = (arr, n = 6) => {
    const picked = [...arr].sort(byVolume).slice(0, n)
    const names = picked.map((v) => `<strong>${link(slug, v)}</strong>`)
    return arr.length > n ? `${names.join(', ')} and ${arr.length - n} more` : list(names)
  }

  // ── intro ──────────────────────────────────────────────────────────────
  const spread = multiArea
    ? ` They are spread across ${list(areas.slice(0, 3).map(([l, a]) => `${esc(l)} (${a.length})`))}${areas.length > 3 ? ' and elsewhere in the area' : ''}, so the nearest good option is not always the one with ${esc(short)} in its name.`
    : ''
  let html = `<p>We list ${plural(vs.length, 'soft play venue')} in and around ${esc(name)}, and ${num(ratedVs.length)} of them have ${MIN_REVIEWS} or more Google reviews — enough to say something fair about how families rate them.${spread}</p>\n\n`
  html += `<p>This guide only states what we hold real data for: ratings, review counts, locations and confirmed facilities. We leave out prices, age limits and opening times, because they change often and are best checked with the venue directly before you set off.</p>\n\n`
  html += `<blockquote>\n  <p>👉 <strong><a href="/soft-play/${slug}">Browse every soft play venue in ${esc(name)} with ratings and facilities</a></strong></p>\n</blockquote>\n\n`

  // ── best rated ─────────────────────────────────────────────────────────
  if (topQuality.length) {
    html += `<h2>The best-reviewed soft play in ${esc(name)}</h2>\n`
    const lead = topQuality[0]
    const ties = topQuality.filter((v) => v.rating === lead.rating).length
    html += `<p>${ties > 1 ? `${num(ties)} venues share the top rating of ${stars(lead.rating)} stars` : `${link(slug, lead)} has the highest rating of any venue with ${MIN_REVIEWS}+ reviews, at ${stars(lead.rating)} stars`} — ranked below by rating, then by how many people have reviewed them:</p>\n<ul>\n`
    for (const v of topQuality) html += `  <li><strong>${link(slug, v)}</strong>${placeOf(v)} — ${stars(v.rating)} stars from ${num(v.reviews_count)} reviews.</li>\n`
    html += `</ul>\n\n`
  }
  if (volume.length) {
    const big = volume[0]
    html += `<h2>The busiest venues</h2>\n<p>Review volume is a good proxy for how many families actually go. ${link(slug, big)}${placeOf(big)} is the most-reviewed on our list with ${num(big.reviews_count)} reviews at ${stars(big.rating)} stars`
    html += topVolume.length
      ? `, followed by ${list(topVolume.map((v) => `${link(slug, v)} (${num(v.reviews_count)} reviews, ${stars(v.rating)} stars)`))}.</p>\n\n`
      : `.</p>\n\n`
  }

  // ── facilities ─────────────────────────────────────────────────────────
  const facLines = []
  if (cafe.length) facLines.push(`<li><strong>On-site café</strong> (${num(cafe.length)} of ${num(vs.length)}): ${nameList(cafe)}.</li>`)
  if (toddler.length) facLines.push(`<li><strong>Dedicated toddler area</strong> (${num(toddler.length)}): ${nameList(toddler)}.</li>`)
  if (baby.length) facLines.push(`<li><strong>Baby area</strong> (${num(baby.length)}): ${nameList(baby)}.</li>`)
  if (parties.length) facLines.push(`<li><strong>Birthday parties</strong> (${num(parties.length)}): ${nameList(parties)}.</li>`)
  if (sen.length) facLines.push(`<li><strong>SEN-friendly</strong> (${num(sen.length)}): ${nameList(sen)}.</li>`)
  if (wheel.length) facLines.push(`<li><strong>Wheelchair access</strong> (${num(wheel.length)}): ${nameList(wheel)}.</li>`)
  if (parking.length) facLines.push(`<li><strong>On-site parking</strong> (${num(parking.length)}): ${nameList(parking)}.</li>`)
  if (outdoor.length) facLines.push(`<li><strong>Outdoor play area</strong> (${num(outdoor.length)}): ${nameList(outdoor)}.</li>`)
  if (facLines.length) {
    html += `<h2>Where the confirmed facilities are</h2>\n<p>Facility information is patchy across smaller venues, so these lists show only what is confirmed on each listing — a venue missing from a list may well have the facility, it just isn’t confirmed in our data.</p>\n<ul>\n  ${facLines.join('\n  ')}\n</ul>\n\n`
  }

  // ── by area ────────────────────────────────────────────────────────────
  if (multiArea) {
    const shown = areas.filter(([, a]) => a.length >= 2).slice(0, 3)
    if (shown.length >= 2) {
      html += `<h2>Soft play by area</h2>\n`
      for (const [l, a] of shown) {
        const top = [...a].sort(byQuality).slice(0, 3)
        html += `<p><strong>${esc(l)}</strong> — ${plural(a.length, 'venue')} on our list. ${top.some(rated) ? 'Best rated: ' : 'Includes '}${list(top.map((v) => `${link(slug, v)}${rated(v) ? ` (${stars(v.rating)} stars, ${num(v.reviews_count)} reviews)` : ''}`))}.</p>\n`
      }
      html += `\n`
    }
  }

  // ── which first ────────────────────────────────────────────────────────
  const picks = []
  if (best[0]) picks.push(`<p><strong>Highest rated:</strong> ${link(slug, best[0])}${placeOf(best[0])} (${stars(best[0].rating)} stars, ${num(best[0].reviews_count)} reviews).</p>`)
  if (volume[0] && volume[0] !== best[0]) picks.push(`<p><strong>Most popular:</strong> ${link(slug, volume[0])}${placeOf(volume[0])} (${num(volume[0].reviews_count)} reviews).</p>`)
  const cafeBest = [...cafe].filter(rated).sort(byQuality)[0]
  if (cafeBest) picks.push(`<p><strong>If you want a proper café:</strong> ${link(slug, cafeBest)} (${stars(cafeBest.rating)} stars, café confirmed).</p>`)
  const partyBest = [...parties].filter(rated).sort(byQuality)[0]
  if (partyBest) picks.push(`<p><strong>For a birthday party:</strong> ${link(slug, partyBest)} (${stars(partyBest.rating)} stars, party facilities confirmed).</p>`)
  const toddlerBest = [...toddler].filter(rated).sort(byQuality)[0]
  if (toddlerBest) picks.push(`<p><strong>For under-fives:</strong> ${link(slug, toddlerBest)} (${stars(toddlerBest.rating)} stars, dedicated toddler area).</p>`)
  const senBest = [...sen].sort(byVolume)[0]
  if (senBest) picks.push(`<p><strong>For SEN-friendly play:</strong> ${link(slug, senBest)}${rated(senBest) ? ` (${stars(senBest.rating)} stars)` : ''} — call ahead to confirm current session times.</p>`)
  if (picks.length) html += `<h2>Which one to try first</h2>\n${picks.join('\n')}\n\n`

  html += `<h2>Before you go</h2>\n<p>Socks are required at nearly every soft play centre, and policies on grip socks, adult entry and booking vary by venue. For weekends and school holidays, booking ahead is safer than turning up. Check the venue’s own website or phone for current prices, session times and any age limits.</p>\n\n`

  // ── related links ──────────────────────────────────────────────────────
  const rel = []
  if (toddler.length) rel.push(`<a href="/soft-play/${slug}/toddler">toddler soft play in ${esc(name)}</a>`)
  if (parties.length) rel.push(`<a href="/soft-play/${slug}/birthday-parties">birthday party venues in ${esc(name)}</a>`)
  if (sen.length) rel.push(`<a href="/soft-play/${slug}/sen-friendly">SEN-friendly soft play in ${esc(name)}</a>`)
  html += `<blockquote>\n  <p>👉 <strong><a href="/soft-play/${slug}">See the full ${esc(name)} directory</a></strong>${rel.length ? ` · More: ${list(rel)}` : ''}</p>\n</blockquote>\n\n`

  // ── FAQ ────────────────────────────────────────────────────────────────
  const faq = []
  faq.push({
    q: `How many soft play centres are there in ${name}?`,
    a: `We list ${plural(vs.length, 'soft play venue')} in and around ${name}${multiArea ? `, across ${list(areas.slice(0, 3).map(([l]) => l))}${areas.length > 3 ? ' and nearby areas' : ''}` : ''}. ${num(ratedVs.length)} have ${MIN_REVIEWS} or more Google reviews.`,
  })
  if (best[0]) {
    const tied = best.filter((v) => v.rating === best[0].rating)
    faq.push({
      q: `What is the best-rated soft play in ${name}?`,
      a: tied.length > 1
        ? `${list(tied.slice(0, 4).map((v) => v.name))} share the top rating of ${stars(best[0].rating)} stars among venues with ${MIN_REVIEWS}+ reviews. ${best[0].name} has the most reviews of those (${num(best[0].reviews_count)}).`
        : `${best[0].name} has the highest rating of any venue with ${MIN_REVIEWS}+ reviews: ${stars(best[0].rating)} stars from ${num(best[0].reviews_count)} reviews.`,
    })
  }
  if (volume[0]) faq.push({ q: `Which ${short} soft play has the most reviews?`, a: `${volume[0].name} is the most-reviewed on our list, with ${num(volume[0].reviews_count)} reviews at ${stars(volume[0].rating)} stars.` })
  if (parties.length) faq.push({ q: `Where can I book a soft play birthday party in ${name}?`, a: `${plural(parties.length, 'venue')} on our list confirm party facilities, including ${list([...parties].sort(byVolume).slice(0, 3).map((v) => v.name))}. Check prices and availability with the venue directly.` })
  if (sen.length) faq.push({ q: `Is there SEN-friendly soft play in ${name}?`, a: `${list([...sen].sort(byVolume).slice(0, 3).map((v) => v.name))} ${sen.length === 1 ? 'is' : 'are'} listed as SEN-friendly. Session times change often, so call the venue to confirm before you visit.` })
  if (cafe.length) faq.push({ q: `Which ${short} soft play centres have a café?`, a: `${plural(cafe.length, 'venue')} confirm an on-site café, including ${list([...cafe].sort(byVolume).slice(0, 3).map((v) => v.name))}.` })

  const excerpt = `A guide to soft play in ${name} built from real data: ${num(vs.length)} venues, the best-reviewed${topQuality[0] ? ` (${topQuality[0].name}, ${stars(topQuality[0].rating)} stars)` : ''}, and which ones confirm a café, toddler area, parties or SEN-friendly sessions.`
  return { html: html.trim(), faq, excerpt, venueCount: vs.length, outside }
}

const tsString = (s) => '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`'
const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

async function main() {
  const pool = new pg.Pool({ connectionString: loadEnv(), ssl: { rejectUnauthorized: false } })
  const slugs = Object.keys(CITIES).filter((s) => !ONLY || ONLY.includes(s))
  const { rows } = await pool.query(
    `SELECT id, name, slug, city_slug, address, postcode, rating, reviews_count, cafe, parking, parties,
            toddler_area, baby_area, sen_friendly, wheelchair_access, has_outdoor_play, lat, lng
       FROM venues
      WHERE is_active = true AND (venue_type IS NULL OR venue_type IN ('indoor','pub')) AND city_slug = ANY($1)`,
    [slugs]
  )
  await pool.end()

  const file = path.join(ROOT, 'lib/blogPosts.ts')
  let src = fs.readFileSync(file, 'utf8')
  for (const slug of slugs) {
    const g = buildGuide(slug, CITIES[slug], rows.filter((r) => r.city_slug === slug))
    if (!g) { console.log(`${slug}: skipped (fewer than ${MIN_VENUES} venues)`); continue }
    const marker = `    slug: 'best-soft-play-in-${slug}',`
    const start = src.indexOf(marker)
    if (start < 0) { console.log(`${slug}: post not found`); continue }
    const objStart = src.lastIndexOf('\n  {\n', start) + 1
    const end = src.indexOf('\n  },\n', start) + '\n  },\n'.length
    const old = src.slice(objStart, end)
    const published = old.match(/publishedAt: '([^']+)'/)[1]
    const title = old.match(/title: ('(?:[^'\\]|\\.)*')/)[1]
    const city = old.match(/city: ('(?:[^'\\]|\\.)*')/)[1]
    const next = `  {
    slug: 'best-soft-play-in-${slug}',
    title: ${title},
    city: ${city},
    excerpt: ${q(g.excerpt)},
    publishedAt: '${published}',
    updatedAt: '${TODAY}',
    datePublished: '${published}',
    dateModified: '${TODAY}',
    contentHtml: ${tsString(g.html)},
    faq: [
${g.faq.map((f) => `      {\n        q: ${q(f.q)},\n        a: ${q(f.a)},\n      },`).join('\n')}
    ],
  },
`
    console.log(`${slug}: ${g.venueCount} venues named-eligible${g.outside ? ` (${g.outside} filed under the hub but more than ${MAX_KM} km from its centre — not named)` : ''}, ${g.faq.length} FAQs, ${g.html.length} chars${/noindex: true/.test(old) ? ', noindex cleared' : ''}`)
    src = src.slice(0, objStart) + next + src.slice(end)
  }
  if (WRITE) { fs.writeFileSync(file, src); console.log('Wrote lib/blogPosts.ts') } else console.log('\nDry run — pass --write to apply.')
}
main().catch((e) => { console.error(e); process.exit(1) })
