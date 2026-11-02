// Builds lib/blogPostsCities.ts: data-driven "Best Soft Play in <city>" guides for cities whose old guide was a
// generic, noindexed template. Every fact comes from the venues table (ratings and review counts from Google,
// facility flags only where a venue confirms them). No prices, ages or opening times.
// A venue whose URL is about to change (reports/slug-fixes.csv) is not linked, so no guide links to a redirect.
//   node scripts/guides/generate-city-guides.mjs
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from '../migrations/_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CITIES = [
  { slug: 'manchester', name: 'Manchester', area: 'Greater Manchester' },
  { slug: 'liverpool', name: 'Liverpool', area: 'Merseyside' },
  { slug: 'birmingham', name: 'Birmingham', area: 'the West Midlands' },
  { slug: 'bristol', name: 'Bristol', area: 'the surrounding area' },
  { slug: 'newcastle', name: 'Newcastle', area: 'Tyneside' },
]
const fixes = fs.existsSync(path.join(ROOT, 'reports/slug-fixes.csv')) ? fs.readFileSync(path.join(ROOT, 'reports/slug-fixes.csv'), 'utf8') : ''
const CHECKED = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const link = (href, label) => `<a href="${href}" class="text-purple-700 hover:underline">${esc(label)}</a>`
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const stars = (r) => (+r).toFixed(1)
const plural = (n, a, b = a + 's') => `${n} ${n === 1 ? a : b}`

const pool = await getPool()
const posts = []
for (const c of CITIES) {
  const { rows } = await pool.query(
    `SELECT name, slug, rating, reviews_count AS review_count, toddler_area, parties, sen_friendly, cafe FROM venues
     WHERE is_active AND city_slug = $1 AND venue_type = 'indoor'`, [c.slug])
  // Counts use every listing (matching the hub page); featured/named venues skip class providers and URLs about to change.
  const linkable = rows.filter((v) => !/nursery|classes|playgroup|toddler sense|baby sensory/i.test(v.name) && !fixes.includes(`/soft-play/${c.slug}/${v.slug},`) && !fixes.includes(`/soft-play/${c.slug}/${v.slug}"`))
  const url = (v) => `/soft-play/${c.slug}/${v.slug}`
  const vlink = (v) => `<strong>${link(url(v), v.name)}</strong>`
  const rated = linkable.filter((v) => v.review_count >= 20 && v.rating).sort((a, b) => b.rating - a.rating || b.review_count - a.review_count)
  const busiest = [...linkable].filter((v) => v.review_count > 0).sort((a, b) => b.review_count - a.review_count).slice(0, 3)
  const named = (flag) => linkable.filter((v) => v[flag]).sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0))
  const count = (flag) => rows.filter((v) => v[flag]).length
  const N = rows.length
  const top = rated[0]
  const facilityLine = (label, flag, noun) => {
    const n = count(flag); if (!n) return ''
    const ns = named(flag).slice(0, 4)
    return `  <li><strong>${label}</strong> (${n}): ${list(ns.map(vlink))}${n > ns.length ? ' and more' : ''}.</li>`
  }
  const facts = [facilityLine('Dedicated toddler area', 'toddler_area'), facilityLine('Birthday parties', 'parties'), facilityLine('SEN-friendly', 'sen_friendly'), facilityLine('Café', 'cafe')].filter(Boolean)
  const html = `<p>We list ${plural(N, 'soft play centre')} in and around ${c.name}, and ${rows.filter((v) => v.review_count >= 20).length} of them have 20 or more Google reviews, enough to say something fair about how families rate them.</p>

<p>This guide only states what we hold real data for: ratings, review counts and facilities the venue confirms. We leave out prices, age limits and opening times, because they change often and are best checked with the venue directly before you set off.</p>

<blockquote>
  <p>👉 <strong>${link(`/soft-play/${c.slug}`, `Browse every soft play centre in ${c.name} with ratings and facilities`)}</strong></p>
</blockquote>
${rated.length ? `
<h2>The best-reviewed soft play in ${c.name}</h2>
<p>${link(url(top), top.name)} has the highest rating of any venue we list with 20+ reviews, at ${stars(top.rating)} stars. Ranked by rating, then by how many people have reviewed them:</p>
<ul>
${rated.slice(0, 5).map((v) => `  <li>${vlink(v)}: ${stars(v.rating)} stars from ${v.review_count.toLocaleString('en-GB')} reviews.</li>`).join('\n')}
</ul>
` : ''}${busiest.length ? `
<h2>The busiest venues</h2>
<p>Review volume is a good proxy for how many families actually go. ${list(busiest.map((v) => `${link(url(v), v.name)} (${v.review_count.toLocaleString('en-GB')} reviews${v.rating ? `, ${stars(v.rating)} stars` : ''})`))} lead the list.</p>
` : ''}${facts.length ? `
<h2>What each venue confirms</h2>
<ul>
${facts.join('\n')}
</ul>
<p>Filter ${c.name} by ${link(`/soft-play/${c.slug}/toddler`, 'toddler areas')}, ${link(`/soft-play/${c.slug}/birthday-parties`, 'birthday parties')} or ${link(`/soft-play/${c.slug}/sen-friendly`, 'SEN-friendly sessions')}. Venues are only tagged when they confirm the facility, so a missing tag means we don't know, not that the venue lacks it.</p>
` : ''}
<h2>Planning a visit with under-fives?</h2>
<p>Read our ${link('/blog/baby-and-toddler-soft-play-uk', 'UK baby and toddler soft play guide')} for what a good toddler area has and how to pick quieter times.</p>

<p>👉 <strong>${link(`/soft-play/${c.slug}`, `See the full ${c.name} directory`)}</strong></p>`
  const faq = [
    { q: `How many soft play centres are there in ${c.name}?`, a: `We list ${plural(N, 'soft play centre')} in and around ${c.name}. The full list, with ratings and facilities, is on our ${c.name} page.` },
    ...(top ? [{ q: `What is the best-reviewed soft play in ${c.name}?`, a: `${top.name} has the highest rating among venues we list with 20 or more reviews, at ${stars(top.rating)} stars from ${top.review_count.toLocaleString('en-GB')} reviews.` }] : []),
    ...(count('toddler_area') ? [{ q: `Which ${c.name} soft play centres have a toddler area?`, a: `${plural(count('toddler_area'), 'venue')} in our ${c.name} listings confirm a dedicated toddler area. Use the toddler filter on the ${c.name} page to see them.` }] : []),
    ...(count('parties') ? [{ q: `Can I book a birthday party at soft play in ${c.name}?`, a: `${plural(count('parties'), 'venue')} in our ${c.name} listings confirm they offer parties. Check each venue for packages and prices.` }] : []),
    ...(count('sen_friendly') ? [{ q: `Is there SEN-friendly soft play in ${c.name}?`, a: `${plural(count('sen_friendly'), 'venue')} in our ${c.name} listings are tagged SEN-friendly. Contact the venue to check session times and what support they offer.` }] : []),
  ]
  const fullLead = top ? `${plural(N, 'venue')}, the best-reviewed (${top.name}, ${stars(top.rating)} stars), and which confirm toddler areas, parties or SEN sessions.` : ''
  const shortLead = `${plural(N, 'venue')} with ratings and the toddler, party and SEN facilities each one confirms. Honest parent guide.`
  const lead = `Soft play in ${c.name} from real data: `
  const body = (lead + fullLead).length <= 155 && fullLead ? fullLead : shortLead
  posts.push({
    slug: `best-soft-play-in-${c.slug}`,
    title: `Best Soft Play in ${c.name} (2026 Parent Guide)`,
    city: c.name,
    excerpt: lead + body,
    publishedAt: '2026-02-18T00:00:00.000Z', updatedAt: '2026-11-02T00:00:00.000Z',
    datePublished: '2026-02-18T00:00:00.000Z', dateModified: '2026-11-02T00:00:00.000Z',
    verifiedOn: CHECKED, contentHtml: html, faq,
  })
  console.log(c.slug, 'N', N, 'rated', rated.length, 'linkable', linkable.length, 'excerpt', posts.at(-1).excerpt.length)
}
await pool.end()
const out = `/**
 * Data-driven city guides replacing the old generic template guides (which were noindexed). GENERATED by
 * scripts/guides/generate-city-guides.mjs from the venues table; re-run the script to refresh.
 */
import type { BlogPost } from './blogPosts'

export const cityGuidePosts: BlogPost[] = ${JSON.stringify(posts, null, 2)}
`
fs.writeFileSync(path.join(ROOT, 'lib/blogPostsCities.ts'), out)
