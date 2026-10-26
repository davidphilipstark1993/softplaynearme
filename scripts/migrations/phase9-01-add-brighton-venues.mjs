// Phase 9-01: add soft play venues in and around Brighton that were missing from the directory.
//
// Every value below was read on 2026-10-26 from the venue's/operator's own website (source listed
// per venue) or, for coordinates and phone numbers of the host building, Google Places. Anything not
// stated by the venue is left null: no prices, ages or facilities are estimated. Photos are Google
// Places photos that were looked at and show the venue itself; venues with no suitable photo have none.
//
//   node scripts/migrations/phase9-01-add-brighton-venues.mjs             # dry run
//   node scripts/migrations/phase9-01-add-brighton-venues.mjs --execute   # insert (writes a backup/undo file first)
//   node scripts/migrations/phase9-01-add-brighton-venues.mjs --rollback=<backup file> [--execute]  # delete what this run inserted
//
// Then: add the printed ids to data/postcode-localities.json venueOverrides if needed, and `npm run data:rebuild`.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const EXECUTE = process.argv.includes('--execute')
const rollbackArg = process.argv.find((a) => a.startsWith('--rollback='))?.slice('--rollback='.length)
const VERIFIED = '2026-10-26'
const PHOTOS = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'phase9-01-photos.json'), 'utf8'))

const day = (open, close) => ({ open, close })
const MAP = (cid) => `https://maps.google.com/?cid=${cid}`

const VENUES = [
  {
    slug: 'meridian-mayhem',
    name: 'Meridian Mayhem',
    city: 'Peacehaven', county: 'East Sussex',
    address: 'Meridian Industrial Estate, Meridian Way, Peacehaven', postcode: 'BN10 8JQ',
    lat: 50.7943258, lng: 0.0033005,
    phone: '01273 580029', email: 'enquiries@meridianmayhem.co.uk', website: 'https://meridianmayhem.co.uk/',
    category: 'Indoor Soft Play', venue_type: 'indoor',
    description:
      'Meridian Mayhem is a new multi-level indoor play and soft play centre in Peacehaven for babies up to 12-year-olds, with a baby and toddler zone, an interactive MultiBall wall, a first-floor café and party rooms. It also runs SEND sessions with reduced capacity and no background music.',
    meta_description:
      'Meridian Mayhem is a multi-level indoor play and soft play centre in Peacehaven for babies to 12-year-olds, with a baby and toddler zone, café and parties.',
    tips_before_visiting:
      '1. Everyone entering the play frames, adults included, must wear socks.\n2. Booking online in advance is recommended, especially at weekends and in school holidays; walk-ins depend on availability.\n3. Each booking includes a minimum of 90 minutes, and late arrival does not extend the session.\n4. The café is on the first floor with no lift access.\n5. Outside food and drink are not allowed except baby food and specific dietary or medical needs.',
    party_info:
      'Four party options for ages 12 and under: Mini Mayhem from £16.95 per child (1 hour play, self-catered party area), Mighty Mayhem from £25.95 per child (dedicated party room, pizza), Maximum Mayhem from £32.95 per child (dedicated party room, hot buffet), and Mega Mania Exclusive Mayhem at £729 private hire for up to 60 children. A 50% deposit is due at booking and the balance at least 14 days before the party. Prices as listed on the venue website on 26 October 2026.',
    hours: { monday: day('09:00', '17:00'), tuesday: day('09:00', '17:00'), wednesday: day('09:00', '17:00'), thursday: day('09:00', '17:00'), friday: day('09:00', '17:00'), saturday: day('09:00', '16:00'), sunday: day('10:00', '17:00') },
    hours_text: 'Monday to Friday 9am–5pm; Saturday 9am–4pm; Sunday 10am–5pm',
    flags: { cafe: true, parties: true, party_rooms: true, toddler_area: true, baby_area: true, sen_friendly: true, has_sen_sessions: true, baby_change: true, parking: true, multi_level_play: true, has_multi_level_play: true, toilets: true },
    age_range_min: 0, age_range_max: 12,
    pricing_hint: null, price_from: null,
    image: PHOTOS['meridian-mayhem']?.url ?? null,
    google_place_id: 'ChIJ6dt2IwB930cRshDFpT-Oq9I', google_maps_url: MAP('15180383372997628082'),
    sources: ['https://meridianmayhem.co.uk/', 'https://meridianmayhem.co.uk/faqs/', 'https://meridianmayhem.co.uk/plan-your-visit/', 'https://meridianmayhem.co.uk/contact-us/', 'https://meridianmayhem.co.uk/parties-events/'],
  },
  {
    slug: 'level-up-soft-play',
    name: 'Level Up Soft Play',
    city: 'Brighton', county: 'East Sussex',
    address: 'Withdean Sports Complex, Tongdean Lane, Withdean, Brighton', postcode: 'BN1 5JD',
    lat: 50.8527297, lng: -0.1603724,
    phone: '01273 542100', email: 'Levelupenquiries@freedom-leisure.co.uk', website: 'https://www.freedom-leisure.co.uk/centres/withdean-sports-complex/level-up-soft-play/',
    category: 'Indoor Soft Play', venue_type: 'indoor',
    description:
      'Level Up is the soft play at Withdean Sports Complex in Brighton, designed for babies up to 12 years. It has a main play frame with slides, rope bridges, climbers and bash bags, a sensory toddler zone for ages 0–3, an optional LED tag wristband game, Party Zone rooms, and SEN sessions with reduced capacity.',
    meta_description:
      'Level Up is the soft play at Withdean Sports Complex, Brighton, for babies to 12-year-olds, with a sensory toddler zone, tag game and party rooms.',
    tips_before_visiting:
      '1. Socks must be worn in soft play; they are sold at reception or bring your own.\n2. Sessions last 1 hour 30 minutes.\n3. Children must be supervised by a responsible adult unless booked into the supervised under-5s sessions.\n4. Phone and reception bookings carry no booking charge; the venue lists a 50p online booking charge.',
    party_info: 'Birthday parties are booked by completing the party booking form and speaking to the Level Up team. Catered and self-catered food options are available in the Party Zone rooms on the lower ground floor.',
    hours: { monday: day('09:00', '19:30'), tuesday: day('09:00', '19:30'), wednesday: day('09:00', '19:30'), thursday: day('09:00', '19:30'), friday: day('09:00', '19:30'), saturday: day('09:00', '18:00') },
    hours_text: 'Monday to Friday 9am–7:30pm; Saturday 9am–6pm. Sessions last 1 hour 30 minutes. Sunday hours are not listed on the venue page.',
    flags: { parties: true, party_rooms: true, toddler_area: true, sen_friendly: true, has_sen_sessions: true, baby_change: true, disabled_access: true, wheelchair_access: true, toilets: true, multi_level_play: true, has_multi_level_play: true, sensory_area: true },
    age_range_min: 0, age_range_max: 12,
    membership_available: true,
    pricing_hint: 'Play is paid for per session; the venue also sells tag credits (£5 for 5) and a 3-month Level Up Play Pass.', price_from: null,
    image: null,
    google_place_id: 'ChIJMTRlI42PdUgRoEJ_vmcfIFc', google_maps_url: MAP('6278052410992575136'),
    sources: ['https://www.freedom-leisure.co.uk/centres/withdean-sports-complex/level-up-soft-play/'],
  },
  {
    slug: 'magic-castle-soft-play-peacehaven',
    name: 'Magic Castle Soft Play, Peacehaven Leisure Centre',
    city: 'Peacehaven', county: 'East Sussex',
    address: 'Peacehaven Leisure Centre, Greenwich Way, Peacehaven', postcode: 'BN10 8BB',
    lat: 50.7955215, lng: 0.0030433,
    phone: '01273 588858', email: null, website: 'https://waveactive.org/locations/lewes-district/peacehaven-leisure-centre/',
    category: 'Indoor Soft Play', venue_type: 'indoor',
    description:
      'Magic Castle is the soft play at Peacehaven Leisure Centre in Peacehaven. The centre’s website lists it as open every day, 9am–6pm, with free on-site parking including disabled bays, and says the centre hosts children’s activities including parties.',
    meta_description:
      'Magic Castle is the soft play at Peacehaven Leisure Centre, open every day 9am–6pm, with free on-site parking.',
    tips_before_visiting: null,
    party_info: null,
    hours: Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, day('09:00', '18:00')])),
    hours_text: 'Open every day 9am–6pm',
    flags: { parking: true, free_parking: true },
    age_range_min: null, age_range_max: null,
    pricing_hint: null, price_from: null,
    image: null,
    google_place_id: 'ChIJzeJPz4d930cRWyADl3bW-M4', google_maps_url: MAP('14913905970865447003'),
    sources: ['https://waveactive.org/locations/lewes-district/peacehaven-leisure-centre/'],
  },
  {
    slug: 'hangleton-community-centre-soft-play',
    name: 'Soft Play at Hangleton Community Centre',
    city: 'Hove', county: 'East Sussex',
    address: 'Hangleton Community Centre, Harmsworth Crescent, Hove', postcode: 'BN3 8BW',
    lat: 50.8520136, lng: -0.1951012,
    phone: '01273 292962', email: null, website: null,
    category: 'Indoor Soft Play', venue_type: 'indoor',
    description:
      'Hangleton Community Centre in Hove runs a children’s soft play open 9:30am to 2pm, Monday to Friday, at £2 per family, according to Brighton & Hove City Council’s directory. The centre has an accessible entrance, lifts, accessible toilets and baby changing facilities.',
    meta_description:
      'Children’s soft play at Hangleton Community Centre, Hove: open 9:30am–2pm Monday to Friday, £2 per family.',
    tips_before_visiting: null,
    party_info: null,
    hours: Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((d) => [d, day('09:30', '14:00')])),
    hours_text: 'Soft play open 9:30am–2pm, Monday to Friday',
    flags: { baby_change: true, disabled_access: true, wheelchair_access: true, toilets: true },
    age_range_min: null, age_range_max: null,
    pricing_hint: '£2 per family', price_from: null,
    image: PHOTOS['hangleton-community-centre-soft-play']?.url ?? null,
    google_place_id: 'ChIJF8zbiwWQdUgRgs7C4Md066E', google_maps_url: MAP('11667547661451579010'),
    sources: ['https://www.brighton-hove.gov.uk/cost-living-support/directories/warm-welcome-directory-indoor-activities-and-places-go/hangleton-community-centre'],
  },
  {
    slug: 'old-boat-corner-soft-play',
    name: 'Soft Play at Old Boat Corner Community Centre',
    city: 'Brighton', county: 'East Sussex',
    address: 'Old Boat Corner Community Centre, Carden Hill, Hollingbury, Brighton', postcode: 'BN1 8GN',
    lat: 50.8653268, lng: -0.1267765,
    phone: '01273 540779', email: null, website: 'http://www.theoldboat.co.uk/',
    category: 'Indoor Soft Play', venue_type: 'indoor',
    description:
      'Old Boat Corner Community Centre in Hollingbury, Brighton, runs weekly soft play sessions for little ones in its main hall, listed on its under-5s events page at £3.50. Tuesday and Wednesday sessions run 9:30am to 12pm; a Monday soft play, arts and crafts session is also listed.',
    meta_description:
      'Weekly soft play sessions at Old Boat Corner Community Centre, Hollingbury, Brighton: Tuesday and Wednesday mornings, £3.50.',
    tips_before_visiting: null,
    party_info: null,
    hours: { tuesday: day('09:30', '12:00'), wednesday: day('09:30', '12:00') },
    hours_text: 'Soft play: Tuesday and Wednesday 9:30am–12pm. A Monday soft play, arts and crafts session is also listed (its start time is given as 9am in one place and 9:30am in another).',
    flags: {},
    age_range_min: null, age_range_max: null,
    pricing_hint: '£3.50 per session', price_from: null,
    image: PHOTOS['old-boat-corner-soft-play']?.url ?? null,
    google_place_id: 'ChIJt6qTaXGPdUgRnS4fo7AM6k8', google_maps_url: MAP('5758429026337107613'),
    sources: ['https://theoldboat.co.uk/events/category/under-5s/list/'],
  },
  {
    slug: 'king-alfred-soft-play-sessions',
    name: 'Soft Play Sessions at King Alfred Leisure Centre',
    city: 'Hove', county: 'East Sussex',
    address: 'King Alfred Leisure Centre, Kingsway, Hove', postcode: 'BN3 2WW',
    lat: 50.8251286, lng: -0.1792097,
    phone: '01273 290290', email: null, website: 'https://www.freedom-leisure.co.uk/centres/king-alfred-leisure-centre/kids-activities-in-brighton-and-hove/',
    category: 'Indoor Soft Play', venue_type: 'indoor',
    description:
      'King Alfred Leisure Centre in Hove runs soft play sessions on Tuesdays (9am–12:30pm) and Fridays (8am–12:30pm and 1:30pm–4pm), with prices from £5.25 for one child, paid on arrival at reception.',
    meta_description:
      'Soft play sessions at King Alfred Leisure Centre, Hove: Tuesdays and Fridays, from £5.25 for one child, pay on arrival.',
    tips_before_visiting: 'Pay on arrival at reception; the venue page does not mention booking.',
    party_info: null,
    hours: null,
    hours_text: 'Tuesday 9am–12:30pm; Friday 8am–12:30pm and 1:30pm–4pm',
    flags: {},
    age_range_min: null, age_range_max: null,
    pricing_hint: 'From £5.25 for one child', price_from: 5.25,
    image: null,
    google_place_id: 'ChIJt68Hh0qFdUgRKgv3HJ5Z1WE', google_maps_url: MAP('7049639327344036650'),
    sources: ['https://www.freedom-leisure.co.uk/centres/king-alfred-leisure-centre/kids-activities-in-brighton-and-hove/'],
  },
  {
    slug: 'paradise-park-newhaven',
    name: 'Paradise Park',
    city: 'Newhaven', county: 'East Sussex',
    address: 'Avis Road, Newhaven', postcode: 'BN9 0DH',
    lat: 50.8023065, lng: 0.0543185,
    phone: '01273 512123', email: 'help@paradisepark.co.uk', website: 'https://www.paradisepark.co.uk/',
    category: 'Family attraction', venue_type: 'family-attraction',
    description:
      'Paradise Park in Newhaven is a family attraction with gardens, museums and an indoor soft play area called the Playzone, open Monday to Sunday 9am–6pm (holiday times differ). It has an on-site coffee shop and runs children’s parties from £15.99 per head, with free entry for the birthday child.',
    meta_description:
      'Paradise Park, Newhaven: gardens, museums and an indoor Playzone soft play area, open daily 9am–6pm, with café and parties.',
    tips_before_visiting: 'Standard hours are 9am–6pm daily; check the venue’s holiday times page for seasonal changes.',
    party_info: 'Children’s parties start at £15.99 per head, with free entry for the birthday child; each package includes a private room, buffet and goody bag (as listed on the venue website, 26 October 2026).',
    hours: Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, day('09:00', '18:00')])),
    hours_text: 'Monday to Sunday 9am–6pm (holiday times differ)',
    flags: { cafe: true, parties: true },
    age_range_min: null, age_range_max: null,
    pricing_hint: 'Day pass £12.99 for over-3s; children aged 0–2 free; family of 2 £25.98', price_from: 12.99,
    rating: 4.4, reviews_count: 4295,
    image: PHOTOS['paradise-park-newhaven']?.url ?? null,
    google_place_id: 'ChIJdZX9S1Z830cRQ0YqjoP6h4U', google_maps_url: MAP('9621934571833148995'),
    sources: ['https://www.paradisepark.co.uk/', 'https://www.paradisepark.co.uk/tickets-prices/'],
  },
]

const dedupeKey = (v) => `${v.name}|${v.address}|${v.city}`.toLowerCase()

function completeness(v) {
  let s = 10 + 10 // name, address
  if (v.phone) s += 10
  if (v.website) s += 10
  if (v.description) s += 15
  if (v.hours || v.hours_text) s += 10
  if (v.price_from) s += 10
  if (Object.values(v.flags).some(Boolean)) s += 10
  if (v.image) s += 5
  if (v.email) s += 5
  s += 5 // lat/lng
  return Math.min(s, 100)
}

async function main() {
  const pool = await getPool()
  const c = await pool.connect()
  try {
    if (rollbackArg) {
      const b = JSON.parse(fs.readFileSync(path.resolve(rollbackArg), 'utf8'))
      console.log(`${EXECUTE ? 'ROLLING BACK' : 'DRY RUN rollback'}: delete ${b.ids.length} venue rows inserted at ${b.takenAt}`)
      if (EXECUTE) {
        await c.query('BEGIN')
        await c.query('DELETE FROM venues WHERE id = ANY($1::int[]) AND slug = ANY($2::text[])', [b.ids, b.slugs])
        await c.query('COMMIT')
        console.log('Deleted.')
      }
      return
    }
    console.log(EXECUTE ? 'EXECUTE\n' : 'DRY RUN: nothing will be written. Re-run with --execute.\n')
    const todo = []
    for (const v of VENUES) {
      const clash = await c.query(
        'SELECT id, city_slug, slug, is_active FROM venues WHERE (city_slug=$1 AND slug=$2) OR place_id=$3 OR google_place_id=$3',
        ['brighton', v.slug, v.google_place_id]
      )
      // Meridian Mayhem and the leisure-centre entries share a Google place with retired rows; only a row with this
      // exact slug, or an ACTIVE row on the same place, blocks the insert.
      const blocking = clash.rows.filter((r) => r.slug === v.slug || r.is_active)
      const score = completeness(v)
      console.log(`${blocking.length ? 'SKIP  ' : 'INSERT'} ${v.slug}  "${v.name}"  [${v.address}, ${v.postcode}]  type=${v.venue_type} completeness=${score}`)
      console.log(`         phone=${v.phone ?? '-'} email=${v.email ?? '-'} hours=${v.hours_text ? 'yes' : '-'} photo=${v.image ? 'yes' : '-'} price=${v.pricing_hint ?? '-'}`)
      console.log(`         sources: ${v.sources.join(', ')}`)
      if (blocking.length) console.log(`         blocked by existing: ${JSON.stringify(blocking)}`)
      else todo.push({ v, score })
    }
    if (!EXECUTE) { console.log(`\nDry run complete: ${todo.length} venue(s) would be inserted. Nothing written.`); return }
    if (!todo.length) return

    await c.query('BEGIN')
    const ids = []
    try {
      for (const { v, score } of todo) {
        const f = v.flags
        const facilities = { ...f }
        const tags = ['soft-play', 'indoor-play', 'kids-activities', 'brighton']
        const { rows } = await c.query(
          `INSERT INTO venues (
             name, slug, city_slug, city, county, region, country, address, postcode, lat, lng,
             phone, email, contact_email, website, description, meta_description, tips_before_visiting, party_info,
             opening_hours, opening_hours_text, category, venue_type, indoor_or_outdoor,
             cafe, parties, party_rooms, has_party_rooms, toddler_area, baby_area, sen_friendly, has_sen_sessions,
             baby_change, parking, free_parking, multi_level_play, has_multi_level_play, toilets, disabled_access,
             wheelchair_access, sensory_area, membership_available,
             age_range_min, age_range_max, pricing_hint, price_from, rating, reviews_count,
             main_image_url, google_place_id, place_id, google_maps_url, facilities, tags, source_urls, dedupe_key,
             completeness_score, last_verified_at, needs_review, is_active, plan, plan_status, enrichment_notes, updated_by)
           VALUES ($1,$2,'brighton',$3,$4,'South East','United Kingdom',$5,$6,$7,$8,
                   $9,$10,$10,$11,$12,$13,$14,$15,
                   $16,$17,$18,$19,'indoor',
                   $20,$21,$22,$22,$23,$24,$25,$26,
                   $27,$28,$29,$30,$30,$31,$32,
                   $33,$34,$35,
                   $36,$37,$38,$39,$40,$41,
                   $42,$43,$43,$44,$45::jsonb,$46::text[],$47::jsonb,$48,
                   $49,$50,false,true,'free','inactive',$51,'phase9-01')
           RETURNING id`,
          [
            v.name, v.slug, v.city, v.county, v.address, v.postcode, v.lat, v.lng,
            v.phone, v.email, v.website, v.description, v.meta_description, v.tips_before_visiting, v.party_info,
            v.hours ? JSON.stringify(v.hours) : null, v.hours_text, v.category, v.venue_type,
            f.cafe ?? null, f.parties ?? null, f.party_rooms ?? null, f.toddler_area ?? null, f.baby_area ?? null, f.sen_friendly ?? null, f.has_sen_sessions ?? null,
            f.baby_change ?? null, f.parking ?? null, f.free_parking ?? null, f.multi_level_play ?? null, f.toilets ?? null, f.disabled_access ?? null,
            f.wheelchair_access ?? null, f.sensory_area ?? null, v.membership_available ?? null,
            v.age_range_min, v.age_range_max, v.pricing_hint, v.price_from, v.rating ?? null, v.reviews_count ?? null,
            v.image, v.google_place_id, v.google_maps_url, JSON.stringify(facilities), tags, JSON.stringify(v.sources), dedupeKey(v),
            score, VERIFIED, `Added ${VERIFIED} from the venue's own website; see source_urls.`,
          ]
        )
        ids.push({ id: rows[0].id, slug: v.slug })
        console.log(`  inserted id=${rows[0].id} ${v.slug}`)
      }
      fs.mkdirSync(path.join(ROOT, 'scripts/output/backups'), { recursive: true })
      const file = path.join(ROOT, `scripts/output/backups/phase9-01-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
      fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), ids: ids.map((x) => x.id), slugs: ids.map((x) => x.slug) }, null, 2))
      await c.query('COMMIT')
      console.log(`\nInserted ${ids.length} venues. Undo file: ${path.relative(ROOT, file)}`)
      console.log('ids:', JSON.stringify(ids))
    } catch (e) {
      await c.query('ROLLBACK')
      throw e
    }
  } finally {
    c.release()
    await pool.end()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
