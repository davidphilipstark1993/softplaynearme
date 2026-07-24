/**
 * enrich-seo-all.mjs
 *
 * Comprehensive SEO enrichment pass across all 1,360 venues.
 *
 * What it does:
 *  1. Fixes city_slug data bugs (glasgow slug containing Birmingham/London venues)
 *  2. Fills empty `city` values from city_slug lookup
 *  3. Generates unique 2–3 paragraph descriptions using seeded templates + venue data
 *  4. Generates "What to Expect" content (what_to_expect field)
 *  5. Generates practical tips (tips_before_visiting field)
 *  6. Generates SEO meta title (seo_title) and meta description (meta_description)
 *  7. Populates tags array
 *  8. Recalculates completeness_score
 *
 * Uniqueness strategy:
 *  - Slug-seeded 32-bit hash → deterministic template selection
 *  - Templates interpolated with venue-specific data (name, city, rating, features)
 *  - Review snippet woven in as authentic user voice
 *  - Conditional paragraphs based on which features are confirmed
 *
 * Usage:
 *   node scripts/enrich-seo-all.mjs              # dry run (shows samples, no writes)
 *   node scripts/enrich-seo-all.mjs --commit      # write to DB
 *   node scripts/enrich-seo-all.mjs --commit --city birmingham
 *   node scripts/enrich-seo-all.mjs --commit --only-missing  # skip venues that already have rich descriptions
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

// ── Args ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  return {
    commit:      argv.includes('--commit'),
    onlyMissing: argv.includes('--only-missing'),
    city:        argv.includes('--city') ? argv[argv.indexOf('--city') + 1] || '' : '',
    fixSlugs:    !argv.includes('--skip-slug-fix'),
  }
}

// ── Env loader ────────────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = path.join(projectRoot, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let val = line.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!(key in process.env)) process.env[key] = val
  }
}

// ── Deterministic hash (same as locationContent.ts) ──────────────────────

function slugHash(slug) {
  let h = 0x811c9dc5
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h
}

function lcg(seed) {
  return ((seed * 1664525 + 1013904223) >>> 0)
}

function seededPick(arr, seed) {
  const idx = seed % arr.length
  return arr[idx]
}

// ── City display name lookup ──────────────────────────────────────────────

const CITY_NAMES = {
  birmingham: 'Birmingham', manchester: 'Manchester', liverpool: 'Liverpool',
  london: 'London', sheffield: 'Sheffield', leeds: 'Leeds', bristol: 'Bristol',
  hull: 'Hull', york: 'York', nottingham: 'Nottingham', cardiff: 'Cardiff',
  edinburgh: 'Edinburgh', glasgow: 'Glasgow', newcastle: 'Newcastle',
  leicester: 'Leicester', brighton: 'Brighton', portsmouth: 'Portsmouth',
  coventry: 'Coventry', bradford: 'Bradford', stoke: 'Stoke',
  sunderland: 'Sunderland', norwich: 'Norwich', swansea: 'Swansea',
  southend: 'Southend', colchester: 'Colchester', ipswich: 'Ipswich',
  lincoln: 'Lincoln', doncaster: 'Doncaster', huddersfield: 'Huddersfield',
  blackpool: 'Blackpool', barnsley: 'Barnsley', halifax: 'Halifax',
  harrogate: 'Harrogate', scarborough: 'Scarborough', rotherham: 'Rotherham',
  wakefield: 'Wakefield', aberdeen: 'Aberdeen', inverness: 'Inverness',
  hastings: 'Hastings', bournemouth: 'Bournemouth', bournmouth: 'Bournemouth',
  'bolton-preston': 'Bolton & Preston', bridlington: 'Bridlington',
  beverley: 'Beverley',
}

function cityDisplayName(citySlug, existingCity) {
  if (existingCity && existingCity.trim()) return existingCity.trim()
  return CITY_NAMES[citySlug] || toTitleCase(citySlug.replace(/-/g, ' '))
}

function toTitleCase(str) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Facility helpers ──────────────────────────────────────────────────────

function getFeatures(v) {
  const fac = v.facilities || {}
  return {
    cafe:        !!(v.cafe || fac.cafe),
    parking:     !!(v.parking || fac.parking || v.free_parking),
    parties:     !!(v.parties || fac.party_rooms || v.has_party_rooms || v.party_rooms),
    toddler:     !!(v.toddler_area || fac.toddler_area),
    baby:        !!(v.baby_area || fac.baby_area || v.has_under_1s),
    sen:         !!(v.sen_friendly || fac.sen_sessions || v.has_sen_sessions),
    outdoor:     !!(v.has_outdoor_play || fac.outdoor_play),
    rolePlay:    !!(v.has_role_play || fac.role_play || v.role_play_area),
    multiLevel:  !!(v.has_multi_level_play || fac.multi_level_play),
    wheelchair:  !!(v.wheelchair_access || v.disabled_access),
    wifi:        !!(v.free_wifi),
  }
}

function featureList(features) {
  const map = {
    cafe:       'an on-site café',
    parking:    'on-site parking',
    parties:    'birthday party facilities',
    toddler:    'a dedicated toddler zone',
    baby:       'a baby play area',
    sen:        'SEN-friendly sessions',
    outdoor:    'outdoor play areas',
    rolePlay:   'a role-play area',
    multiLevel: 'a multi-level play frame',
    wheelchair: 'wheelchair access',
    wifi:       'free WiFi',
  }
  return Object.entries(map)
    .filter(([k]) => features[k])
    .map(([, v]) => v)
}

function oxford(items) {
  if (!items.length) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function ratingLabel(rating) {
  if (!rating) return null
  const r = parseFloat(rating)
  if (r >= 4.5) return 'highly rated'
  if (r >= 4.0) return 'well reviewed'
  if (r >= 3.5) return 'positively rated'
  return null
}

function reviewTier(count) {
  if (!count) return 'new'
  if (count >= 500) return 'very popular'
  if (count >= 200) return 'popular'
  if (count >= 50) return 'established'
  return 'local'
}

function categoryLabel(category) {
  if (!category) return 'soft play centre'
  const c = category.toLowerCase()
  if (c.includes('inflatable')) return 'inflatable play and amusement centre'
  if (c.includes('role play')) return 'role-play and activity centre'
  if (c.includes('trampoline')) return 'trampoline and play centre'
  if (c.includes('indoor playground') || c.includes('indoor play')) return 'indoor soft play centre'
  if (c.includes('amusement')) return "children's amusement and play centre"
  if (c.includes('play centre') || c.includes('play center')) return 'soft play centre'
  if (c.includes('leisure')) return 'leisure and play centre'
  return 'soft play centre'
}

// ── Description templates ─────────────────────────────────────────────────
// 6 P1 openers, 6 P2 bodies, 5 P3 closers
// All interpolated with venue data

const P1_TEMPLATES = [
  (v) => `${v.name} is ${v.article} ${v.type} based in ${v.city}${v.countyStr ? `, ${v.countyStr}` : ''}. ${v.repStr}a welcoming play venue that offers indoor facilities for children of varying ages in a safe and supervised environment.`,
  (v) => `Located in ${v.city}${v.countyStr ? `, ${v.countyStr}` : ''}, ${v.name} is ${v.article} ${v.type} catering to families looking for indoor play activities. ${v.repStr}a reliable destination for local parents and carers.`,
  (v) => `${v.name} provides indoor children's play facilities in ${v.city}. ${v.ratingStr ? v.ratingStr + ' — t' : 'T'}his ${v.type} is ${v.reviewTierStr.trim().toLowerCase()} among families across ${v.city}${v.countyStr ? ` and ${v.countyStr}` : ''}.`,
  (v) => `Families in ${v.city} looking for a reliable indoor play option often head to ${v.name}. ${v.article.charAt(0).toUpperCase() + v.article.slice(1)} ${v.type}${v.countyStr ? ` in ${v.countyStr}` : ''}, it offers a welcoming environment for children to explore, climb, and play.${v.ratingStr ? ` ${v.ratingStr.trim()}.` : ''}`,
  (v) => `${v.name} is ${v.article} ${v.type} in ${v.city} that has become a go-to destination for parents seeking indoor activities for their children. ${v.repStr}a venue that prides itself on providing a safe and enjoyable experience.`,
  (v) => `A ${v.reviewTierStr.trim().toLowerCase()} choice for families in ${v.city}${v.countyStr ? ` and ${v.countyStr}` : ''}, ${v.name} offers indoor play in a dedicated ${v.type} setting. ${v.ratingStr.trim() ? v.ratingStr.trim() + ' — c' : 'C'}hildren and parents consistently appreciate the space.`,
]

const P2_TEMPLATES = [
  (v) => v.facilitiesStr
    ? `The venue offers ${v.facilitiesStr}. ${v.snippetStr ? v.snippetStr + ' ' : ''}${v.city} parents will find it a practical choice for a half-day or full-day outing.`
    : `${v.snippetStr ? v.snippetStr + ' ' : ''}${v.name} provides a range of play equipment suited to children at different developmental stages.`,

  (v) => v.snippetStr
    ? `Recent visitors sum up the experience well: ${v.snippetStr} ${v.facilitiesStr ? `The venue includes ${v.facilitiesStr}, making it a well-rounded option for a family outing in ${v.city}.` : ''}`
    : v.facilitiesStr
      ? `Facilities at ${v.name} include ${v.facilitiesStr} — making it a convenient one-stop option for families visiting from across ${v.city}.`
      : `${v.name} provides a dedicated play space where children can let off steam safely, with equipment designed to encourage active play and imagination.`,

  (v) => {
    const f = v.features
    const specs = []
    if (f.multiLevel) specs.push('a large multi-level play structure suitable for older children')
    if (f.toddler) specs.push('a dedicated toddler and baby zone separated from the main frame')
    if (f.rolePlay) specs.push('a role-play area where children can explore imaginative scenarios')
    if (f.outdoor) specs.push('access to outdoor play areas')
    if (specs.length) {
      return `The play area includes ${oxford(specs)}. ${v.snippetStr ? v.snippetStr : ''}`
    }
    return v.snippetStr
      ? `${v.snippetStr} The play space at ${v.name} is designed to keep children entertained across a wide age range.`
      : `${v.name}'s play space caters to a broad age range, with equipment designed to challenge older children while remaining accessible for younger ones.`
  },

  (v) => {
    const f = v.features
    if (f.parties && f.cafe) {
      return `${v.name} is particularly well equipped for birthday parties, with dedicated party facilities and an on-site café for parents and carers. ${v.snippetStr ? v.snippetStr : `The combination of party rooms and catering options makes it a popular choice for celebrating children's birthdays in ${v.city}.`}`
    }
    if (f.sen) {
      return `Alongside standard open-play sessions, ${v.name} runs SEN-friendly sessions designed to provide a calmer environment for children with additional needs. ${v.facilitiesStr ? `Additional facilities include ${v.facilitiesStr}.` : ''} ${v.snippetStr || ''}`
    }
    return v.facilitiesStr
      ? `Visitors can expect ${v.facilitiesStr} at ${v.name}. ${v.snippetStr ? v.snippetStr : `It's a well-regarded option for families in ${v.city} wanting a reliable indoor play experience.`}`
      : `${v.snippetStr ? v.snippetStr : `${v.name} is a well-regarded play venue in ${v.city} that caters to families with children of varying ages.`}`
  },

  (v) => {
    const highlights = []
    if (v.features.toddler) highlights.push('parents of toddlers appreciate the separate under-3s area')
    if (v.features.cafe) highlights.push('the on-site café means you can refuel between play sessions')
    if (v.features.parking) highlights.push('on-site parking makes it easy to arrive with all the kit')
    if (highlights.length >= 2) {
      return `Families who visit ${v.name} regularly note that ${highlights.slice(0, 2).join(', and ')}. ${v.snippetStr || ''}`
    }
    return v.snippetStr
      ? `Parents visiting ${v.name} report: ${v.snippetStr}`
      : `${v.name} provides a dedicated indoor play space in ${v.city}, suited to families looking for a safe, active outing whatever the weather.`
  },

  (v) => v.rating && parseFloat(v.rating) >= 4.0
    ? `With a ${v.rating}-star rating${v.reviewCount ? ` from ${v.reviewCount.toLocaleString()} reviews` : ''}, ${v.name} is one of ${v.city}'s more consistently well-regarded soft play venues. ${v.facilitiesStr ? `The venue offers ${v.facilitiesStr}.` : ''} ${v.snippetStr || ''}`
    : v.facilitiesStr
      ? `${v.name} provides ${v.facilitiesStr} in a dedicated ${v.type} setting in ${v.city}. ${v.snippetStr || ''}`
      : `${v.name} is a soft play centre in ${v.city} providing indoor play for children in a dedicated and supervised environment. ${v.snippetStr || ''}`,
]

// NOTE: these deliberately do NOT assert facts we don't hold for a specific
// venue (sock policy, generic "designed to entertain" filler, etc — see
// reports/data-quality-audit.md Phase 3). Every sentence here is either
// gated on a confirmed v.features.* boolean, or general advice to verify
// something ("check their website") rather than a claim about the venue.
const P3_TEMPLATES = [
  (v) => `Before visiting ${v.name}, it's worth checking their website or social media for current opening times, session prices, and any booking requirements — these can change seasonally.${v.features.parties ? ` If you're planning a birthday party, book well in advance as slots fill up quickly, especially at weekends.` : ''}`,

  (v) => `${v.name} is located in ${v.city} — check their website or call ahead to confirm opening times before your visit, as hours can vary by day and season.${v.features.cafe ? ` The on-site café makes it easy to turn a play session into a longer outing.` : ''}`,

  (v) => `To get the most out of a visit to ${v.name}, check their current session times and prices online before you go — these are updated regularly.${v.features.sen ? ` SEN-friendly sessions are available — contact the venue directly for schedule details, as these sessions are often not listed on the main booking page.` : ''}`,

  (v) => `Parents planning a visit to ${v.name} should confirm opening hours and whether pre-booking is required — this is increasingly common across soft play venues in ${v.city}.${v.features.toddler ? ` The dedicated toddler area is separate from the main frame, which is particularly useful when visiting with both a baby or toddler and an older sibling.` : ''}`,

  (v) => `If you're heading to ${v.name} for the first time, it's a good idea to check their website for up-to-date session times, prices, and any booking requirements.${v.features.parking ? ` Parking is available, making it accessible by car for families travelling from across ${v.city}.` : ''}`,
]

// ── What to Expect generator ──────────────────────────────────────────────

function generateWhatToExpect(v, features, city) {
  const audiences = []
  if (features.baby || features.toddler) audiences.push('babies and toddlers')
  if (!features.toddler && !features.baby) audiences.push('children of all ages')
  if (features.multiLevel) audiences.push('older children (multi-level play structure)')
  if (features.parties) audiences.push('birthday party groups')
  if (features.sen) audiences.push('children with additional needs')

  const bestFor = audiences.length
    ? `Best for: ${audiences.slice(0, 3).join(', ')}.`
    : `Best for: families with children aged 1–10.`

  const senNote = features.sen
    ? ` SEN-friendly sessions are available — contact the venue for specific times.`
    : ''

  const partyNote = features.parties
    ? ` The venue caters for birthday parties with dedicated party areas and packages — book in advance to secure a slot.`
    : ''

  const toddlerNote = features.toddler
    ? ` Younger children have a dedicated toddler area separated from the main frame, giving parents peace of mind when visiting with mixed-age groups.`
    : ''

  // Only add a rating-based note when we actually have a rating to back it —
  // no generic filler sentence when there's nothing real to say.
  const ratingNote = v.rating && parseFloat(v.rating) >= 4.2
    ? ` Consistently well-rated by local families, ${v.name} is a reliable choice for a soft play outing in ${city}.`
    : ''

  return `${bestFor}${toddlerNote}${senNote}${partyNote}${ratingNote}`
}

// ── Tips Before Visiting generator ────────────────────────────────────────
// Every tip here is either general industry-wide advice (hedged with
// "most"/"many", not asserted as a confirmed fact about this specific
// venue) or gated on a confirmed features.* boolean. Nothing here should
// claim a specific policy (sock rules, ball pit presence, etc) that we
// don't actually hold as data for this venue — see
// reports/data-quality-audit.md Phase 3.

function generateTips(v, features, city) {
  const tips = [
    `Most soft play centres require socks for children (and often adults) — worth packing a spare pair just in case.`,
    features.cafe
      ? `The on-site café means no need to rush home for lunch. Check the menu on their website or social media.`
      : `Bring a snack bag and a water bottle as the café situation varies — call ahead if refreshments are important.`,
    features.parking
      ? `On-site parking is available. Arrive a few minutes early on weekends as the car park can fill up.`
      : `Check parking options near ${v.address || city} before you travel — street parking availability varies.`,
    `Weekend and school holiday sessions fill up quickly at popular venues — check if pre-booking is available.`,
    features.sen
      ? `If you have a child with additional needs, call ahead to ask about SEN session schedules — these aren't always listed on the main website.`
      : `Weekday mornings (especially Tuesday–Thursday, 9–11am) are typically the quietest and calmest times to visit.`,
    `Bring a change of clothes for younger children — soft play sessions can get messy.`,
  ]

  // Return 4-5 tips
  return tips.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n')
}

// ── SEO title + meta description ──────────────────────────────────────────

const SEO_TITLE_TEMPLATES = [
  (name, city) => `${name} – Soft Play in ${city} | Indoor Play for Kids`,
  (name, city) => `${name} | Children's Soft Play Centre, ${city}`,
  (name, city) => `${name} – Indoor Soft Play Centre in ${city}`,
  (name, city) => `${name} | Soft Play & Kids' Activities in ${city}`,
]

function generateSeoTitle(name, city, hash) {
  const tpl = seededPick(SEO_TITLE_TEMPLATES, hash % SEO_TITLE_TEMPLATES.length)
  const title = tpl(name, city)
  return title.length > 70 ? title.slice(0, 67) + '…' : title
}

function generateMetaDescription(v, features, city, hash) {
  const rating = v.rating ? `Rated ${parseFloat(v.rating).toFixed(1)}/5${v.reviews_count ? ` by ${v.reviews_count.toLocaleString()} families` : ''}. ` : ''
  const feats = featureList(features).slice(0, 2)
  const featStr = feats.length ? `Includes ${feats.join(' and ')}. ` : ''
  const type = categoryLabel(v.category)

  const templates = [
    `${v.name} is ${article(type)} ${type} in ${city}. ${rating}${featStr}Find opening times, prices and directions.`,
    `Looking for soft play in ${city}? ${v.name} offers indoor play for children${feats.length ? ` with ${feats[0]}` : ''}. ${rating}See full details here.`,
    `${v.name} – ${type} in ${city}. ${featStr}${rating}Compare venues, check opening hours, and plan your visit.`,
    `Visit ${v.name} in ${city} for safe indoor soft play. ${rating}${featStr}Full venue info, directions and parent reviews.`,
  ]

  const desc = seededPick(templates, hash % templates.length)
  return desc.length > 160 ? desc.slice(0, 157) + '…' : desc
}

function article(s) {
  return /^[aeiou]/i.test(s) ? 'an' : 'a'
}

// ── Tags generator ────────────────────────────────────────────────────────

function generateTags(v, features, citySlug) {
  const tags = new Set([`soft-play-${citySlug}`, 'soft-play', 'indoor-play', 'kids-activities'])
  const cat = (v.category || '').toLowerCase()
  if (cat.includes('inflatable')) tags.add('inflatable-park')
  if (cat.includes('role')) tags.add('role-play-centre')
  if (cat.includes('trampoline')) tags.add('trampoline-park')
  if (features.toddler) tags.add('toddler-friendly')
  if (features.baby)    tags.add('baby-friendly')
  if (features.cafe)    tags.add('cafe-on-site')
  if (features.parking) tags.add('parking-available')
  if (features.parties) tags.add('party-venue')
  if (features.sen)     tags.add('sen-friendly')
  if (features.outdoor) tags.add('outdoor-play')
  if (features.rolePlay) tags.add('role-play')
  if (features.multiLevel) tags.add('large-play-frame')
  const r = parseFloat(v.rating)
  if (r >= 4.5) tags.add('top-rated')
  else if (r >= 4.0) tags.add('highly-rated')
  const cnt = parseInt(v.reviews_count) || 0
  if (cnt >= 500) tags.add('popular')
  else if (cnt >= 100) tags.add('well-established')
  tags.add(citySlug)
  return [...tags]
}

// ── Completeness score ────────────────────────────────────────────────────

function computeScore(v) {
  let s = 0
  if (v.name)         s += 10
  if (v.address)      s += 10
  if (v.phone)        s += 10
  if (v.website)      s += 10
  if (v.description && v.description.length > 100) s += 15
  if (v.opening_hours) s += 10
  if (v.price_from)   s += 10
  const feats = getFeatures(v)
  if (Object.values(feats).some(Boolean)) s += 10
  if ((v.images && v.images.length > 0) || v.main_image_url) s += 5
  if (v.email)        s += 5
  if (v.lat && v.lng) s += 5
  return Math.min(s, 100)
}

// ── Build all enriched fields for one venue ───────────────────────────────

function enrichVenue(v) {
  const city = cityDisplayName(v.city_slug, v.city)
  const countyStr = v.county ? v.county : ''
  const features = getFeatures(v)
  const facilities = featureList(features)
  const facilitiesStr = facilities.length ? oxford(facilities) : null
  const snippetRaw = (v.review_snippet || '').trim()
    .replace(/[,\s]+\.$/, '.') // "word ," → "word."
    .replace(/\s+for\s+the\.?$/i, '.') // trailing "for the" fragments
    .replace(/\s+with\s+\w+\s*[,.]?$/i, '.') // trailing "with role play ,"
    .trim()
  // Only use snippet if it looks complete (has a subject + decent length)
  const snippetStr = snippetRaw && snippetRaw.length > 20 && /\w{3,}/.test(snippetRaw)
    ? (snippetRaw.endsWith('.') || snippetRaw.endsWith('!') || snippetRaw.endsWith('"') ? snippetRaw : snippetRaw + '.')
    : null
  const type = categoryLabel(v.category)
  const art = article(type)
  const rating = v.rating ? parseFloat(v.rating) : null
  const rLabel = ratingLabel(rating)
  const rTier  = reviewTier(v.reviews_count)
  const ratingStr  = rLabel ? `${rLabel.charAt(0).toUpperCase() + rLabel.slice(1)} ` : ''
  const reviewTierStr = `${rTier.charAt(0).toUpperCase() + rTier.slice(1)} `

  // Combined reputation string e.g. "Highly rated and popular — " or just "Popular — "
  const repStr = rLabel && rTier !== 'new'
    ? `${rLabel.charAt(0).toUpperCase() + rLabel.slice(1)} and ${rTier} — `
    : rLabel
      ? `${rLabel.charAt(0).toUpperCase() + rLabel.slice(1)} — `
      : rTier !== 'new'
        ? `${rTier.charAt(0).toUpperCase() + rTier.slice(1)} — `
        : ''

  const vData = {
    name: v.name, city, countyStr, type, article: art,
    ratingStr, reviewTierStr, repStr, facilitiesStr, snippetStr,
    features, rating: v.rating, reviewCount: v.reviews_count,
  }

  // Seeded selectors
  const h1 = slugHash(v.slug || v.name)
  const h2 = lcg(h1)
  const h3 = lcg(h2)
  const h4 = lcg(h3)

  const p1 = seededPick(P1_TEMPLATES, h1 % P1_TEMPLATES.length)(vData)
  const p2 = seededPick(P2_TEMPLATES, h2 % P2_TEMPLATES.length)(vData)
  const p3 = seededPick(P3_TEMPLATES, h3 % P3_TEMPLATES.length)(vData)

  const description = [p1, p2, p3].filter(Boolean).join('\n\n')
  const whatToExpect = generateWhatToExpect(v, features, city)
  const tips = generateTips(v, features, city)
  const seoTitle = generateSeoTitle(v.name, city, h4)
  const metaDesc = generateMetaDescription(v, features, city, h4)
  const tags = generateTags(v, features, v.city_slug)
  const score = computeScore({ ...v, description })

  return { description, whatToExpect, tips, seoTitle, metaDesc, tags, score, city }
}

// ── City slug bug fixes ───────────────────────────────────────────────────

async function fixCitySlugs(client) {
  console.log('\n── Fixing city_slug data bugs ──')

  const fixes = [
    // 30 Birmingham venues incorrectly got city_slug='glasgow'
    {
      sql: `UPDATE venues SET city_slug = 'birmingham' WHERE city_slug = 'glasgow' AND city = 'Birmingham'`,
      label: 'glasgow→birmingham (city=Birmingham)',
    },
    // 2 London venues incorrectly got city_slug='glasgow'
    {
      sql: `UPDATE venues SET city_slug = 'london' WHERE city_slug = 'glasgow' AND city = 'London'`,
      label: 'glasgow→london (city=London)',
    },
    // Hull sub-area venues that got wrong slugs
    {
      sql: `UPDATE venues SET city_slug = 'hull' WHERE city_slug IN ('lincoln','york','bridlington') AND city = 'Hull'`,
      label: 'hull sub-slugs→hull (city=Hull)',
    },
    {
      sql: `UPDATE venues SET city_slug = 'hull' WHERE city_slug = 'doncaster' AND city = 'Hull'`,
      label: 'doncaster→hull (city=Hull)',
    },
    // Fill empty city names from slug
    {
      sql: `UPDATE venues SET city = 'Sheffield' WHERE city_slug = 'sheffield' AND (city IS NULL OR city = '')`,
      label: 'fill empty city=Sheffield',
    },
    {
      sql: `UPDATE venues SET city = 'Hull' WHERE city_slug = 'hull' AND (city IS NULL OR city = '')`,
      label: 'fill empty city=Hull',
    },
    {
      sql: `UPDATE venues SET city = 'Leeds' WHERE city_slug = 'leeds' AND (city IS NULL OR city = '')`,
      label: 'fill empty city=Leeds',
    },
    {
      sql: `UPDATE venues SET city = 'York' WHERE city_slug = 'york' AND (city IS NULL OR city = '')`,
      label: 'fill empty city=York',
    },
    {
      sql: `UPDATE venues SET city = 'Bridlington' WHERE city_slug = 'bridlington' AND (city IS NULL OR city = '')`,
      label: 'fill empty city=Bridlington',
    },
    {
      sql: `UPDATE venues SET city = 'Beverley' WHERE city_slug = 'beverley' AND (city IS NULL OR city = '')`,
      label: 'fill empty city=Beverley',
    },
    // Normalise Bournemouth spelling
    {
      sql: `UPDATE venues SET city = 'Bournemouth', city_slug = 'bournemouth' WHERE city ILIKE 'bournmouth'`,
      label: 'Bournmouth→Bournemouth',
    },
    // Remove unknown venues that are clearly non-play (no name match to soft play)
    // Don't delete — just mark as needs_review
    {
      sql: `UPDATE venues SET needs_review = true WHERE city_slug = 'unknown' OR (city_slug IS NULL AND city IS NULL)`,
      label: 'flag unknown city venues for review',
    },
  ]

  for (const { sql, label } of fixes) {
    const result = await client.query(sql)
    console.log(`  ${label}: ${result.rowCount} rows`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))
  loadEnvLocal()

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }

  console.log('='.repeat(70))
  console.log('SEO ENRICHMENT — ALL VENUES')
  console.log('='.repeat(70))
  console.log(args.commit ? 'MODE: COMMIT' : 'MODE: DRY RUN (add --commit to write)')
  if (args.onlyMissing) console.log('FILTER: Only venues missing descriptions (--only-missing)')
  if (args.city) console.log(`FILTER: City slug = ${args.city}`)
  console.log()

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  try {
    // ── Phase 1: Fix city_slug bugs ────────────────────────────────────────
    if (args.fixSlugs && args.commit) {
      await fixCitySlugs(client)
    } else if (args.fixSlugs && !args.commit) {
      console.log('(city_slug fixes will run on --commit)')
    }

    // ── Phase 2: Load all venues ───────────────────────────────────────────
    console.log('\n── Loading venues ──')
    let query = `SELECT id, name, slug, city_slug, city, county, address, phone, website, email,
      description, what_to_expect, tips_before_visiting, seo_title, meta_description,
      tags, rating, reviews_count, review_snippet, category, main_image_url, images,
      lat, lng, completeness_score, opening_hours, price_from,
      cafe, parking, parties, toddler_area, baby_area, sen_friendly,
      wheelchair_access, free_wifi, has_party_rooms, has_outdoor_play, has_role_play,
      has_multi_level_play, has_under_1s, has_sen_sessions, free_parking,
      facilities
      FROM venues`

    const conditions = []
    const params = []

    if (args.city) {
      params.push(args.city)
      conditions.push(`city_slug = $${params.length}`)
    }

    if (args.onlyMissing) {
      conditions.push(`(description IS NULL OR length(description) < 150 OR seo_title IS NULL OR what_to_expect IS NULL)`)
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ')
    query += ' ORDER BY id'

    const { rows: venues } = await client.query(query, params)
    console.log(`Loaded ${venues.length} venues`)

    // ── Phase 3: Enrich ────────────────────────────────────────────────────
    console.log('\n── Enriching venues ──')

    let updated = 0, errors = 0, skipped = 0
    const samples = []

    for (const v of venues) {
      try {
        const enriched = enrichVenue(v)

        if (samples.length < 3) samples.push({ venue: v, enriched })

        if (!args.commit) {
          updated++
          continue
        }

        await client.query(
          `UPDATE venues SET
            description       = $1,
            what_to_expect    = $2,
            tips_before_visiting = $3,
            seo_title         = $4,
            meta_description  = $5,
            tags              = $6,
            completeness_score = $7,
            city              = COALESCE(NULLIF($8,''), city),
            updated_at        = CURRENT_TIMESTAMP
          WHERE id = $9`,
          [
            enriched.description,
            enriched.whatToExpect,
            enriched.tips,
            enriched.seoTitle,
            enriched.metaDesc,
            enriched.tags,
            enriched.score,
            enriched.city,
            v.id,
          ]
        )
        updated++
        if (updated % 50 === 0) process.stdout.write('.')
      } catch (err) {
        errors++
        console.error(`\n  ERROR [${v.name}]: ${err.message}`)
      }
    }

    // ── Output ─────────────────────────────────────────────────────────────
    console.log()
    console.log()
    console.log('='.repeat(70))
    console.log('RESULTS')
    console.log('='.repeat(70))
    console.log(`Venues processed: ${venues.length}`)
    console.log(`Updated: ${updated}`)
    if (errors) console.log(`Errors: ${errors}`)

    // Show 3 sample enriched outputs
    console.log('\n' + '─'.repeat(70))
    console.log('SAMPLE ENRICHED VENUES')
    console.log('─'.repeat(70))

    for (const { venue: v, enriched: e } of samples) {
      console.log(`\n★ ${v.name} (${v.city_slug})`)
      console.log('  City: ' + e.city)
      console.log('  SEO title: ' + e.seoTitle)
      console.log('  Meta desc: ' + e.metaDesc)
      console.log('  Tags: ' + e.tags.slice(0, 6).join(', '))
      console.log()
      console.log('  DESCRIPTION:')
      e.description.split('\n\n').forEach((p, i) => {
        console.log(`  P${i+1}: ${p}`)
      })
      console.log()
      console.log('  WHAT TO EXPECT / WHO IS THIS FOR:')
      console.log('  ' + e.whatToExpect)
      console.log()
      console.log('  TIPS BEFORE VISITING:')
      e.tips.split('\n').forEach(t => console.log('  ' + t))
      console.log('─'.repeat(70))
    }

    if (!args.commit) {
      console.log('\nDRY RUN — no changes written. Add --commit to apply.')
    } else {
      console.log(`\n✓ ${updated} venues enriched in database.`)
      // Show score summary
      const scores = await client.query(`
        SELECT
          SUM(CASE WHEN completeness_score >= 60 THEN 1 ELSE 0 END) as high,
          SUM(CASE WHEN completeness_score >= 30 AND completeness_score < 60 THEN 1 ELSE 0 END) as mid,
          SUM(CASE WHEN completeness_score < 30 THEN 1 ELSE 0 END) as low,
          COUNT(*) as total
        FROM venues
      `)
      const sc = scores.rows[0]
      console.log(`\nCompleteness score distribution:`)
      console.log(`  High (60+):   ${sc.high} venues — will be indexed`)
      console.log(`  Mid  (30-59): ${sc.mid} venues — may be indexed`)
      console.log(`  Low  (<30):   ${sc.low} venues — noindex`)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Fatal:', err?.message || err)
  process.exit(1)
})
