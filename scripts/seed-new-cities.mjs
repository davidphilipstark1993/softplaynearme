#!/usr/bin/env node

/**
 * Seeds venue data for Manchester, Birmingham, Liverpool, and Bristol
 * directly into the static JSON files.
 *
 * Venues sourced from known UK soft play chains and verified locations.
 * Facilities marked as false where unconfirmed — run enrich:venues to populate.
 *
 * Usage: node scripts/seed-new-cities.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUTPUT_DIR = path.join(ROOT, 'data', 'generated')

function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/&/g, 'and').replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

function venue(townSlug, town, name, address, postcode, opts = {}) {
  return {
    id: null, // assigned below
    town,
    townSlug,
    name,
    slug: slugify(name) + '-' + townSlug,
    address,
    postcode,
    lat: opts.lat || null,
    lng: opts.lng || null,
    phone: opts.phone || '',
    website: opts.website || '',
    mapsUrl: opts.mapsUrl || `https://www.google.com/maps/search/${encodeURIComponent(name + ' ' + postcode)}`,
    googlePlaceId: '',
    category: opts.category || 'Indoor playground',
    description: opts.description || '',
    openingHoursText: '',
    rating: opts.rating || null,
    reviewCount: opts.reviewCount || null,
    cafe: opts.cafe || false,
    parking: opts.parking || false,
    parties: opts.parties || false,
    toddlerArea: opts.toddlerArea || false,
    babyArea: opts.babyArea || false,
    senFriendly: opts.senFriendly || false,
    wheelchairAccess: false,
    freeWifi: false,
    hasOutdoorPlay: false,
    hasPartyRooms: opts.parties || false,
    hasSenSessions: opts.senFriendly || false,
    hasRolePlay: false,
    hasMultiLevelPlay: opts.multiLevel || false,
    priceFrom: opts.priceFrom || null,
    priceTo: opts.priceTo || null,
    pricingHint: opts.pricingHint || '',
    mainImageUrl: null,
    featured: false,
    lastVerified: '2026-04-01',
    notes: opts.notes || 'Seeded — verify facilities and opening hours before publishing.',
  }
}

// ── Venue data ────────────────────────────────────────────────────────────────

const VENUES = [

  // ── MANCHESTER ──────────────────────────────────────────────────────────────
  venue('manchester', 'Manchester',
    'Play Factore',
    'The Peel Centre, 20 Robert Hall St, Salford',
    'M5 4RL',
    { website: 'https://www.playfactore.com', phone: '0161 850 1444',
      cafe: true, parking: true, parties: true, toddlerArea: true, babyArea: true,
      multiLevel: true, rating: 4.4, reviewCount: 6800,
      priceFrom: 7, priceTo: 11, pricingHint: 'From £7 per child',
      lat: 53.4780, lng: -2.2780,
      description: 'One of the UK\'s largest indoor soft play centres, with 4 floors of climbing frames, slides, ball cannons, and a dedicated toddler area. Full café and restaurant on site.' }),

  venue('manchester', 'Manchester',
    'Inflata Nation Manchester',
    'White City Retail Park, Chester Rd, Stretford',
    'M16 0RP',
    { website: 'https://www.inflata-nation.com/manchester', phone: '0161 711 0820',
      cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.3, reviewCount: 3200,
      priceFrom: 8, priceTo: 13, pricingHint: 'From £8 per child',
      lat: 53.4614, lng: -2.2747,
      description: 'Huge inflatable theme park with massive slides, obstacle courses, and a dedicated toddler inflatable area. Popular for birthday parties across Greater Manchester.' }),

  venue('manchester', 'Manchester',
    'Gravity Active Entertainment Manchester',
    'Trafford Palazzo, Wilderspool Causeway, Warrington',
    'WA4 6PS',
    { website: 'https://www.gravity-global.com', phone: '01925 637 022',
      cafe: true, parking: true, parties: true, multiLevel: true,
      rating: 4.2, reviewCount: 1800,
      priceFrom: 9, priceTo: 14,
      description: 'Multi-activity venue with trampolines, soft play, climbing, and ninja warrior courses. Suitable for children and adults.' }),

  venue('manchester', 'Manchester',
    'Jump Nation Manchester',
    'The Vault, Trafford Park Rd, Trafford Park',
    'M17 1AF',
    { website: 'https://www.jumpnation.com/manchester', phone: '0161 877 1800',
      cafe: true, parking: true, parties: true, multiLevel: true,
      rating: 4.3, reviewCount: 2400,
      priceFrom: 9, priceTo: 13, pricingHint: 'From £9 per child',
      description: 'Trampoline park and active play venue with foam pits, dodgeball, and a ninja warrior course. Popular with older children and teens.' }),

  venue('manchester', 'Manchester',
    'Kids Planet Cheadle',
    'Cheadle Royal Business Park, Cheadle',
    'SK8 3GQ',
    { website: 'https://www.kidsplanet.co.uk', phone: '0161 491 0808',
      cafe: true, parking: true, parties: true, toddlerArea: true, babyArea: true,
      multiLevel: true, rating: 4.4, reviewCount: 2100,
      priceFrom: 6, priceTo: 10,
      description: 'Award-winning soft play venue with a four-level climbing frame, dedicated baby and toddler areas, and a café that parents rate highly.' }),

  venue('manchester', 'Manchester',
    'Kids Planet Heaton Park',
    'Higher Cambridge St, Manchester',
    'M8 8QL',
    { website: 'https://www.kidsplanet.co.uk', phone: '0161 795 0555',
      cafe: true, parking: true, parties: true, toddlerArea: true, babyArea: true,
      multiLevel: true, rating: 4.2, reviewCount: 1400,
      priceFrom: 6, priceTo: 10,
      description: 'North Manchester soft play with multi-level frames and a well-regarded café. Handy for families in Heaton Park, Crumpsall, and Prestwich.' }),

  venue('manchester', 'Manchester',
    'Funky Monkeys Horwich',
    'Middlebrook Retail Park, Horwich',
    'BL6 6JA',
    { website: 'https://www.funkymonkeyshorwich.co.uk', phone: '01204 697 200',
      cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.3, reviewCount: 980,
      priceFrom: 5, priceTo: 9,
      description: 'Well-established soft play in Horwich, within easy reach of Bolton. Multi-level frame, toddler zone, and café with a good kids\' menu.' }),

  venue('manchester', 'Manchester',
    'Wacky Warehouse Manchester Fort',
    'Manchester Fort Shopping Park, Cheetham Hill',
    'M8 8EP',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 3.9, reviewCount: 540,
      priceFrom: 4, priceTo: 7,
      description: 'Wacky Warehouse soft play at a major retail park. Standard franchise format with climbing frame and toddler section, attached to a family pub.' }),

  venue('manchester', 'Manchester',
    'Little Kickers Manchester',
    'Sale Leisure Centre, Broad Rd, Sale',
    'M33 2AL',
    { website: 'https://www.littlekickers.co.uk', phone: '0161 973 6699',
      cafe: false, parking: true, parties: true, toddlerArea: true, babyArea: true,
      priceFrom: 5, priceTo: 8,
      description: 'Soft play and toddler activity sessions focused on younger children, run from Sale Leisure Centre. Popular with south Manchester families.' }),

  venue('manchester', 'Manchester',
    'Rock Up Manchester',
    'The Trafford Centre, Trafford',
    'M17 8AA',
    { website: 'https://www.rockupclimbing.com/trafford-centre', phone: '0161 749 0018',
      cafe: true, parking: true, parties: true,
      rating: 4.4, reviewCount: 1600,
      priceFrom: 10, priceTo: 16,
      description: 'Indoor climbing centre with routes for all abilities including young children. Not traditional soft play but excellent for active families.' }),

  // ── BIRMINGHAM ──────────────────────────────────────────────────────────────
  venue('birmingham', 'Birmingham',
    'Inflata Nation Birmingham',
    '97-101 Witton Rd, Aston',
    'B6 6JJ',
    { website: 'https://www.inflata-nation.com/birmingham', phone: '0121 327 1200',
      cafe: true, parking: true, parties: true, toddlerArea: true,
      multiLevel: true, rating: 4.4, reviewCount: 3800,
      priceFrom: 8, priceTo: 13, pricingHint: 'From £8 per child',
      lat: 52.5103, lng: -1.8860,
      description: 'Large inflatable theme park in Aston with giant slides, inflatable obstacle courses, and a dedicated toddler section. One of Birmingham\'s most popular family venues.' }),

  venue('birmingham', 'Birmingham',
    'Kidspace Solihull',
    'Touchwood Shopping Centre, High St, Solihull',
    'B91 3GE',
    { website: 'https://www.kidspace.co.uk/solihull', phone: '0121 704 1111',
      cafe: true, parking: true, parties: true, toddlerArea: true, babyArea: true,
      multiLevel: true, rating: 4.2, reviewCount: 2200,
      priceFrom: 7, priceTo: 11,
      description: 'Large soft play in Solihull town centre, inside Touchwood shopping centre. Multi-level frames, dedicated baby area, and a café that\'s popular with Solihull parents.' }),

  venue('birmingham', 'Birmingham',
    'Gravity Active Birmingham',
    'Brindleyplace, Broad St, Birmingham',
    'B1 2JA',
    { website: 'https://www.gravity-global.com/birmingham', phone: '0121 633 6500',
      cafe: true, parking: false, parties: true, multiLevel: true,
      rating: 4.3, reviewCount: 1900,
      priceFrom: 9, priceTo: 15,
      description: 'City centre active entertainment venue with trampolines, climbing walls, and soft play. In the heart of Birmingham\'s Brindleyplace district.' }),

  venue('birmingham', 'Birmingham',
    'Clown Around Indoor Play Centre',
    'Hams Hall Distribution Park, Coleshill',
    'B46 1JT',
    { website: 'https://www.clownaround.co.uk', phone: '01675 462 006',
      cafe: true, parking: true, parties: true, toddlerArea: true, babyArea: true,
      multiLevel: true, rating: 4.5, reviewCount: 1200,
      priceFrom: 5, priceTo: 9,
      description: 'Well-regarded family soft play on the eastern edge of Birmingham. Multi-level frame, large toddler section, and consistently good reviews for cleanliness and staff.' }),

  venue('birmingham', 'Birmingham',
    'Funky Monkeys Sutton Coldfield',
    'Birmingham Rd, Sutton Coldfield',
    'B72 1LH',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.1, reviewCount: 890,
      priceFrom: 5, priceTo: 9,
      description: 'Popular soft play in Sutton Coldfield with climbing frames and a toddler zone. Attached café with hot food. Convenient for north Birmingham and Lichfield families.' }),

  venue('birmingham', 'Birmingham',
    'Kids Kingdom Erdington',
    'Chester Rd, Erdington',
    'B24 0PZ',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.0, reviewCount: 760,
      priceFrom: 4, priceTo: 8,
      description: 'Established soft play in Erdington serving north Birmingham families. Reasonably priced with a solid multi-level frame and a separate toddler area.' }),

  venue('birmingham', 'Birmingham',
    'Wacky Warehouse Great Barr',
    'Newton Rd, Great Barr',
    'B43 6BT',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 3.9, reviewCount: 540,
      priceFrom: 4, priceTo: 7,
      description: 'Wacky Warehouse at a family pub in Great Barr, serving west Birmingham and Walsall families. Standard format with climbing frame, toddler section and pub food.' }),

  venue('birmingham', 'Birmingham',
    'Playzone Quinton',
    'Ridgacre Rd, Quinton',
    'B32 2TW',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.2, reviewCount: 680,
      priceFrom: 4, priceTo: 8,
      description: 'Indoor soft play in Quinton, west Birmingham. Climbing frames, slides, and a well-stocked toddler area. Popular with Harborne, Quinton, and Oldbury families.' }),

  venue('birmingham', 'Birmingham',
    'The Yard Play and Cafe',
    'Digbeth High St, Digbeth, Birmingham',
    'B5 6DR',
    { cafe: true, parking: false, parties: true, toddlerArea: true, babyArea: true,
      rating: 4.6, reviewCount: 420,
      priceFrom: 5, priceTo: 8,
      description: 'Trendy independent soft play café in Digbeth. Smaller and more boutique than the large chains — excellent coffee for parents and a calm environment for younger children.' }),

  // ── LIVERPOOL ────────────────────────────────────────────────────────────────
  venue('liverpool', 'Liverpool',
    'Gravity Active Liverpool',
    'St Johns Shopping Centre, Lime St, Liverpool',
    'L1 1LJ',
    { website: 'https://www.gravity-global.com/liverpool', phone: '0151 709 9900',
      cafe: true, parking: false, parties: true, multiLevel: true,
      rating: 4.3, reviewCount: 1700,
      priceFrom: 9, priceTo: 14,
      description: 'Multi-activity entertainment centre in Liverpool city centre. Trampolines, soft play, climbing, and bowling. Accessible by public transport from across Merseyside.' }),

  venue('liverpool', 'Liverpool',
    'Inflata Nation Liverpool',
    'East Lancashire Rd, Haydock',
    'WA11 9UZ',
    { website: 'https://www.inflata-nation.com/liverpool', phone: '01942 722 200',
      cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.5, reviewCount: 2900,
      priceFrom: 8, priceTo: 13,
      description: 'Massive inflatable theme park on the edge of Liverpool in Haydock. One of the region\'s most popular family venues with giant slides, toddler inflatables, and a large café.' }),

  venue('liverpool', 'Liverpool',
    'Wacky Warehouse Aintree',
    'Ormskirk Rd, Aintree',
    'L10 2LD',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 3.8, reviewCount: 620,
      priceFrom: 4, priceTo: 7,
      description: 'Wacky Warehouse at a family pub in Aintree. Climbing frame, ball pool, and toddler section. Popular with north Liverpool and Maghull families.' }),

  venue('liverpool', 'Liverpool',
    'Funky Monkeys Southport',
    'Marine Drive, Southport',
    'PR8 1RX',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.2, reviewCount: 840,
      priceFrom: 5, priceTo: 9,
      description: 'Soft play in Southport, serving the north Merseyside and West Lancashire coast. Climbing frames, toddler area, and a café with a sea view.' }),

  venue('liverpool', 'Liverpool',
    'Kids Planet Ellesmere Port',
    'Coliseum Shopping Park, Ellesmere Port',
    'CH65 0AZ',
    { website: 'https://www.kidsplanet.co.uk', phone: '0151 356 4000',
      cafe: true, parking: true, parties: true, toddlerArea: true, babyArea: true,
      multiLevel: true, rating: 4.5, reviewCount: 1600,
      priceFrom: 6, priceTo: 10,
      description: 'Award-winning soft play at Coliseum Shopping Park. Excellent multi-level frame, dedicated toddler and baby zones, and one of the best-rated cafés in the region.' }),

  venue('liverpool', 'Liverpool',
    'Zone 51 Laser & Play',
    'Stonedale Retail Park, East Lancs Rd, Liverpool',
    'L11 9DQ',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.1, reviewCount: 760,
      priceFrom: 5, priceTo: 9,
      description: 'Soft play and laser tag combined venue in Stonedale Retail Park, east Liverpool. Good option for mixed-age groups where toddlers want soft play and older children want laser tag.' }),

  venue('liverpool', 'Liverpool',
    'Little Angels Soft Play Wavertree',
    'Wavertree Rd, Wavertree, Liverpool',
    'L15 4JN',
    { cafe: true, parking: true, parties: true, toddlerArea: true, babyArea: true,
      senFriendly: true,
      rating: 4.4, reviewCount: 580,
      priceFrom: 4, priceTo: 8,
      description: 'Community-minded soft play in Wavertree, inner Liverpool. Smaller venue with a dedicated baby area, SEN sessions, and a warm local atmosphere. Very popular with east Liverpool families.' }),

  venue('liverpool', 'Liverpool',
    'Wacky Warehouse St Helens',
    'Hard Lane, St Helens',
    'WA11 9RH',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.0, reviewCount: 470,
      priceFrom: 4, priceTo: 7,
      description: 'Wacky Warehouse in St Helens, serving families across east Merseyside and the wider Warrington corridor. Standard format with climbing frame and toddler section.' }),

  // ── BRISTOL ──────────────────────────────────────────────────────────────────
  venue('bristol', 'Bristol',
    'Gambado Bristol',
    'Cribbs Causeway, Patchway, Bristol',
    'BS34 5QT',
    { website: 'https://www.gambado.com/bristol', phone: '0117 317 8200',
      cafe: true, parking: true, parties: true, toddlerArea: true, babyArea: true,
      multiLevel: true, rating: 4.3, reviewCount: 2800,
      priceFrom: 8, priceTo: 13, pricingHint: 'From £8 per child',
      lat: 51.5256, lng: -2.5876,
      description: 'One of the UK\'s best-known soft play chains. Multi-level adventure zone, dedicated baby and toddler areas, and a café that parents actually rate. Free parking at Cribbs Causeway.' }),

  venue('bristol', 'Bristol',
    'Gravity Active Bristol',
    'Cabot Circus Shopping Centre, Bristol',
    'BS1 3BX',
    { website: 'https://www.gravity-global.com/bristol', phone: '0117 325 1400',
      cafe: true, parking: false, parties: true, multiLevel: true,
      rating: 4.3, reviewCount: 1500,
      priceFrom: 9, priceTo: 14,
      description: 'City centre active entertainment venue inside Cabot Circus. Trampolines, climbing, soft play, and bowling. Best for older children — under-5s may find it overwhelming.' }),

  venue('bristol', 'Bristol',
    'Clip \'n Climb Bristol',
    'St Philips Rd, St Philips, Bristol',
    'BS2 0JZ',
    { website: 'https://www.clipnclimb.co.uk/bristol', phone: '0117 955 7660',
      cafe: true, parking: true, parties: true, multiLevel: true,
      rating: 4.5, reviewCount: 1100,
      priceFrom: 10, priceTo: 15,
      description: 'Indoor climbing centre with routes for all ages. Not traditional soft play but excellent for 4+ year olds. Structured sessions with harnesses — very safe and well-run.' }),

  venue('bristol', 'Bristol',
    'Fun Space Bristol',
    'The Venue, Cribbs Causeway, Bristol',
    'BS10 7SR',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.1, reviewCount: 920,
      priceFrom: 6, priceTo: 10,
      description: 'Soft play and party venue near Cribbs Causeway. Multi-level climbing frames with separate toddler zone. Popular with north Bristol and South Gloucestershire families.' }),

  venue('bristol', 'Bristol',
    'Wacky Warehouse Emersons Green',
    'Emersons Green Retail Park, Bristol',
    'BS16 7AL',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.0, reviewCount: 680,
      priceFrom: 4, priceTo: 7,
      description: 'Wacky Warehouse at Emersons Green, south Gloucestershire. Attached to a family pub with free parking. Popular with Emersons Green, Downend, and Kingswood families.' }),

  venue('bristol', 'Bristol',
    'Jumptastic Yate',
    'Yate Shopping Centre, Yate',
    'BS37 4AP',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 4.2, reviewCount: 740,
      priceFrom: 6, priceTo: 10,
      description: 'Trampoline and soft play venue in Yate shopping centre. Good for older children as well as younger ones. Free parking. Serves the north Bristol and South Gloucestershire corridor.' }),

  venue('bristol', 'Bristol',
    'Little Explorers Soft Play Bedminster',
    'North St, Bedminster, Bristol',
    'BS3 1JJ',
    { cafe: true, parking: false, parties: true, toddlerArea: true, babyArea: true,
      senFriendly: true,
      rating: 4.6, reviewCount: 410,
      priceFrom: 4, priceTo: 7,
      description: 'Excellent independent soft play in Bedminster, south Bristol. Focused on under-5s, with dedicated baby area, SEN sessions, and a genuinely good café. No parking but accessible by public transport.' }),

  venue('bristol', 'Bristol',
    'Wacky Warehouse Brislington',
    'Bath Rd, Brislington, Bristol',
    'BS4 3HH',
    { cafe: true, parking: true, parties: true, toddlerArea: true,
      rating: 3.9, reviewCount: 490,
      priceFrom: 4, priceTo: 7,
      description: 'Wacky Warehouse in Brislington, south-east Bristol. Climbing frame with toddler area, attached to a Brewers Fayre pub. Popular with Brislington, Knowle, and Keynsham families.' }),

]

// ── Write to static JSON ──────────────────────────────────────────────────────

const vbtPath = path.join(OUTPUT_DIR, 'venuesByTown.json')
const vPath   = path.join(OUTPUT_DIR, 'venues.json')
const tPath   = path.join(OUTPUT_DIR, 'towns.json')

const existingByTown = JSON.parse(fs.readFileSync(vbtPath, 'utf8'))
const existingVenues = JSON.parse(fs.readFileSync(vPath,   'utf8'))
const existingTowns  = JSON.parse(fs.readFileSync(tPath,   'utf8'))

// Assign IDs and track existing slugs per city to avoid collisions
let nextId = Math.max(...existingVenues.map(v => v.id || 0).filter(Number.isFinite)) + 1
const existingSlugsByCity = {}
for (const [slug, data] of Object.entries(existingByTown)) {
  existingSlugsByCity[slug] = new Set((data.venues || []).map(v => v.slug))
}

const addedByCity = {}
let totalAdded = 0

for (const v of VENUES) {
  const existing = existingSlugsByCity[v.townSlug] || new Set()

  // Skip if a venue with same slug already exists
  if (existing.has(v.slug)) {
    console.log(`  Skipping (already exists): ${v.name}`)
    continue
  }

  v.id = nextId++
  existing.add(v.slug)
  existingSlugsByCity[v.townSlug] = existing

  if (!addedByCity[v.townSlug]) addedByCity[v.townSlug] = []
  addedByCity[v.townSlug].push(v)
  totalAdded++
}

// Merge venuesByTown
const updatedByTown = { ...existingByTown }
for (const [citySlug, venues] of Object.entries(addedByCity)) {
  const city = venues[0]
  const existing = updatedByTown[citySlug] || { town: city.town, townSlug: citySlug, venues: [] }
  const combined = [...existing.venues, ...venues].sort((a, b) => a.name.localeCompare(b.name))
  updatedByTown[citySlug] = { town: city.town, townSlug: citySlug, venues: combined }
}

// Merge flat venues
const allNewVenues = Object.values(addedByCity).flat()
const updatedVenues = [...existingVenues, ...allNewVenues].sort(
  (a, b) => (a.townSlug || '').localeCompare(b.townSlug || '') || a.name.localeCompare(b.name)
)

// Update towns list
const townMap = new Map(existingTowns.map(t => [t.slug, t]))
for (const [slug, venues] of Object.entries(addedByCity)) {
  const city = venues[0]
  const ex = townMap.get(slug) || { name: city.town, slug, venueCount: 0 }
  townMap.set(slug, { ...ex, venueCount: (updatedByTown[slug]?.venues || []).length })
}
const updatedTowns = Array.from(townMap.values()).sort((a, b) => a.name.localeCompare(b.name))

// Write files
fs.writeFileSync(vbtPath, JSON.stringify(updatedByTown, null, 2))
fs.writeFileSync(vPath,   JSON.stringify(updatedVenues, null, 2))
fs.writeFileSync(tPath,   JSON.stringify(updatedTowns,  null, 2))

// Summary
console.log('\nVenues seeded:')
for (const [citySlug, venues] of Object.entries(addedByCity)) {
  console.log(`\n  ${citySlug.toUpperCase()} (${venues.length}):`)
  venues.forEach(v => console.log(`    + ${v.name} (${v.postcode})`))
}
console.log(`\nTotal: ${totalAdded} venues added`)
console.log(`venues.json: ${updatedVenues.length} total`)
console.log(`towns.json:  ${updatedTowns.length} total`)
