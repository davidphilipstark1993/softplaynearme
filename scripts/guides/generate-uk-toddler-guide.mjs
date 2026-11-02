// Builds lib/blogPostsUk.ts: the UK-wide baby and toddler soft play guide.
// The venue table is read from the live database (toddler_area = true, indoor soft play) and balanced
// by nation/region so no one city dominates. Re-run to refresh:  node scripts/guides/generate-uk-toddler-guide.mjs
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from '../migrations/_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cities = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cities.json'), 'utf8'))
const hub = Object.fromEntries(cities.map((c) => [c.slug, c]))
const fixes = fs.existsSync(path.join(ROOT, 'reports/slug-fixes.csv')) ? fs.readFileSync(path.join(ROOT, 'reports/slug-fixes.csv'), 'utf8') : ''
const nation = (region) => (region === 'Scotland' || region === 'Wales' || region === 'Northern Ireland' ? region : 'England')
const REGION_CAP = { England: 2, Scotland: 3, Wales: 3, 'Northern Ireland': 3 } // per region (England) / per nation

const pool = await getPool()
const { rows } = await pool.query(`SELECT name, slug, city_slug, rating, reviews_count AS review_count, baby_area, baby_change
  FROM venues WHERE is_active AND toddler_area = true AND venue_type = 'indoor'`)
await pool.end()

// A venue whose URL is about to change (reports/slug-fixes.csv) is left out so the guide never links to a redirect.
const candidates = rows
  .filter((v) => !/nursery|classes|playgroup|toddler sense|baby sensory/i.test(v.name)) // class and childcare providers are not drop-in soft play
  .filter((v) => hub[v.city_slug] && !fixes.includes(`/soft-play/${v.city_slug}/${v.slug},`) && !fixes.includes(`/soft-play/${v.city_slug}/${v.slug}"`))
  .map((v) => ({ ...v, town: hub[v.city_slug].name, region: hub[v.city_slug].region, nation: nation(hub[v.city_slug].region) }))
  .sort((a, b) => ((b.review_count >= 20 ? +b.rating : 0) - (a.review_count >= 20 ? +a.rating : 0)) || (b.review_count ?? 0) - (a.review_count ?? 0))

const picked = []
const perGroup = {}; const perCity = {}
for (const v of candidates) {
  const group = v.nation === 'England' ? v.region.replace('Yorkshire and the Humber', 'Yorkshire') : v.nation
  const cap = REGION_CAP[v.nation]
  if ((perGroup[group] ?? 0) >= cap || (perCity[v.city_slug] ?? 0) >= 1) continue
  perGroup[group] = (perGroup[group] ?? 0) + 1; perCity[v.city_slug] = 1
  picked.push(v)
}
const order = ['England', 'Scotland', 'Wales', 'Northern Ireland']
picked.sort((a, b) => order.indexOf(a.nation) - order.indexOf(b.nation) || a.town.localeCompare(b.town))

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const a = (href, label) => `<a href="${href}" class="text-purple-700 hover:underline">${esc(label)}</a>`
const rowHtml = (v) => `    <tr><td>${a(`/soft-play/${v.city_slug}/${v.slug}`, v.name)}</td><td>${a(`/soft-play/${v.city_slug}`, v.town)}</td><td>Yes${v.baby_area ? ' + baby area' : ''}</td><td>${v.review_count >= 20 ? `${(+v.rating).toFixed(1)} from ${v.review_count} reviews` : '–'}</td></tr>`
const tables = order.map((n) => {
  const vs = picked.filter((v) => v.nation === n)
  if (!vs.length) return ''
  return `<h3>${n}</h3>\n<table>\n  <thead><tr><th>Venue</th><th>Town</th><th>Toddler area</th><th>Rating (20+ reviews)</th></tr></thead>\n  <tbody>\n${vs.map(rowHtml).join('\n')}\n  </tbody>\n</table>`
}).join('\n\n')

const total = rows.length
const nationCount = (n) => rows.filter((v) => hub[v.city_slug] && nation(hub[v.city_slug].region) === n).length
const toddlerLinks = picked.slice(0, 0)
const CHECKED = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

const html = `<p>Soft play suits babies and toddlers best when the centre has a separate under-fives zone, so little ones can crawl and toddle without older children racing past. We list ${total} soft play centres across the UK that confirm a toddler area, and this guide shows you what to look for, how to get the most from a visit, and where to start.</p>

<blockquote>
  <p>👉 <strong>Looking for a specific town? Open any city page and choose <em>Toddler</em> to see only the centres with a toddler area.</strong></p>
</blockquote>

<h2>Quick answers</h2>
<h3>What age is soft play for?</h3>
<p>Most soft play centres welcome children from babies up to around 11 or 12 years old, with the main frame aimed at school-age children and a separate zone for under-fives. Age and height limits differ from venue to venue, so check the venue's own page before you go.</p>
<h3>Can babies go to soft play?</h3>
<p>Yes. Many centres have a baby or toddler area with soft flooring where non-walkers can lie, roll and crawl safely, and most allow parents to sit in with them. Look for a venue that confirms a baby or toddler area rather than assuming it has one.</p>
<h3>Is soft play safe for a 1 year old?</h3>
<p>A dedicated toddler or baby zone is the safest choice for a one-year-old, because it keeps them away from the large climbing frames and from bigger children. Stay close, keep to the zone designed for their age, and follow the venue's rules on supervision and age or height limits.</p>
<h3>Do babies pay at soft play?</h3>
<p>It varies. Some centres let babies in free, others charge a reduced or full rate, and some set the cut-off by age or by whether the child is walking. We only show a price on a listing when the venue has published one, so check the venue before you travel.</p>
<!-- TODO(David): add a verified UK-wide statement on baby entry prices once confirmed from venue sources. -->
<h3>What is a toddler session?</h3>
<p>A toddler session is a set time, often on weekday mornings, when a soft play centre is reserved for younger children or is quieter. Not every venue runs one, and the times change, so look at the venue's website or call ahead.</p>

<h2>What a good baby and toddler area has</h2>
<ul>
  <li><strong>A separate zone</strong> for under-fives, away from the main frame, ideally with its own entrance or a low gate.</li>
  <li><strong>Soft, clean flooring</strong> and low-level equipment suited to crawlers and first-time walkers.</li>
  <li><strong>Posted age and height limits</strong>, so you know the area is meant for your child's size.</li>
  <li><strong>Baby-change facilities</strong> and somewhere to feed a baby.</li>
  <li><strong>A café with a view of the play area</strong>, so you can keep watch while you sit down.</li>
</ul>

<h2>Quieter times and what to bring</h2>
<p>Weekday mornings and term-time afternoons are usually calmer than weekends and school holidays, which is when toddlers get the most room. Confirm opening times with the venue first, as they change with the season.</p>
<p>Bring socks for everyone (grip socks are ideal), a change of clothes, water and a snack if the café allows outside food, and a spare nappy bag for pushchair storage.</p>

<h2>Soft play with a toddler area across the UK</h2>
<p>These centres all confirm a toddler area in our listings. To give every part of the UK a fair look, the list takes the highest-rated centres in each region of England and in Scotland, Wales and Northern Ireland, with no more than one per town. Ratings are shown only where a centre has 20 or more reviews. Of the ${total} centres that confirm a toddler area, ${nationCount('England')} are in England, ${nationCount('Scotland')} in Scotland, ${nationCount('Wales')} in Wales and ${nationCount('Northern Ireland')} in Northern Ireland, and the list grows as we add venues. Listings checked ${CHECKED}.</p>

${tables}

<h2>Find a toddler-friendly centre near you</h2>
<p>Choose your town to see its soft play centres and filter by toddler area. Popular starting points: ${a('/soft-play/london/toddler', 'London')}, ${a('/soft-play/manchester/toddler', 'Manchester')}, ${a('/soft-play/glasgow/toddler', 'Glasgow')}, ${a('/soft-play/cardiff/toddler', 'Cardiff')} and ${a('/soft-play', 'every town and city')}. See also our local toddler guides: ${a('/blog/best-toddler-soft-play-in-hull', 'toddler soft play in Hull')} and ${a('/blog/baby-and-toddler-soft-play-in-brighton-and-worthing', 'baby and toddler soft play in Brighton and Worthing')}.</p>`

const faq = [
  ['What age is soft play for?', 'Most soft play centres welcome children from babies up to around 11 or 12, with a separate zone for under-fives. Age and height limits vary, so check the venue.'],
  ['Can babies go to soft play?', 'Yes. Many centres have a baby or toddler area with soft flooring, and parents can usually stay with their baby. Look for a venue that confirms the area.'],
  ['Is soft play safe for a 1 year old?', 'A dedicated toddler or baby zone is the safest choice for a one-year-old. Stay close, keep to the zone designed for their age and follow the venue\'s rules.'],
  ['Do babies pay at soft play?', 'It varies by venue: some admit babies free, others charge a reduced or full rate. Check the venue before you travel.'],
  ['What is a toddler session?', 'A set time, often on weekday mornings, when a centre is reserved for younger children or is quieter. Not every venue runs one, so check its website.'],
]
const out = `/**
 * UK-wide baby and toddler soft play guide. GENERATED by scripts/guides/generate-uk-toddler-guide.mjs
 * from venues that confirm a toddler area; re-run the script to refresh the table.
 */
import type { BlogPost } from './blogPosts'

export const ukPosts: BlogPost[] = [
  {
    slug: 'baby-and-toddler-soft-play-uk',
    title: 'Baby and Toddler Soft Play UK: Parent Guide',
    city: 'UK',
    excerpt: ${JSON.stringify(`What age soft play suits, what a good baby and toddler area has, and ${total} UK soft play centres that confirm a toddler area, from Scotland to Wales to England.`)},
    publishedAt: '2026-11-02T00:00:00.000Z',
    updatedAt: '2026-11-02T00:00:00.000Z',
    datePublished: '2026-11-02T00:00:00.000Z',
    dateModified: '2026-11-02T00:00:00.000Z',
    verifiedOn: ${JSON.stringify(CHECKED)},
    contentHtml: ${JSON.stringify(html)},
    faq: ${JSON.stringify(faq.map(([q, a]) => ({ q, a })), null, 6)},
  },
]
`
fs.writeFileSync(path.join(ROOT, 'lib/blogPostsUk.ts'), out)
console.log(`total ${total}; table ${picked.length}:`, Object.fromEntries(order.map((n) => [n, picked.filter((v) => v.nation === n).length])))
console.log(picked.map((v) => `${v.nation}/${v.region}: ${v.name} (${v.town})`).join('\n'))
