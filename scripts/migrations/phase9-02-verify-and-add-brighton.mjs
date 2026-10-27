// Phase 9-02: fix and extend Brighton-hub venues after a second round of verification (2026-10-27).
//
// Every value was read on 2026-10-26/27 from the venue's own website (listed per venue) or from Google Places
// (coordinates, postcode, business status). Anything a venue does not state is left alone or null.
//
//   node scripts/migrations/phase9-02-verify-and-add-brighton.mjs             # dry run (default)
//   node scripts/migrations/phase9-02-verify-and-add-brighton.mjs --execute   # write (backs up the old rows first)
//   node scripts/migrations/phase9-02-verify-and-add-brighton.mjs --rollback=<backup file> [--execute]
//
// Updates: Doves Play Barn, Funplex, Palace Play, Washbrooks, Barney's Play, Two by Two (postcode only).
// Reclassifies (venue_type): FunPlay Leisure and Playcafe -> family-attraction, Beechwood Hall -> park-playground.
// Inserts: Goddenwick Farm Play Barn (indoor), Blackberry Farm Park (play-farm).

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const EXECUTE = process.argv.includes('--execute')
const rollbackArg = process.argv.find((a) => a.startsWith('--rollback='))?.slice('--rollback='.length)
const VERIFIED = '2026-10-27'

const day = (open, close) => ({ open, close })
const daily = (o, c) => Object.fromEntries(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, day(o, c)]))

// id -> { expect: name the row must have, set: columns to change }
const UPDATES = [
  {
    id: 919, expect: 'The Doves Play Barn',
    src: 'https://www.thedovesplaybarn.co.uk/about-indoor-play',
    set: {
      address: 'Heaven Farm, Furners Green, Uckfield', postcode: 'TN22 3RG',
      email: 'thedovesplaybarn@gmail.com', contact_email: 'thedovesplaybarn@gmail.com',
      age_range_min: 0, age_range_max: 5, price_from: 5.95,
      pricing_hint: 'Children (crawling to 5 years) £5.95; adults £1.25; babies in arms free; annual membership £160 per child including 2 adults',
      membership_available: true, cafe: true, parties: true,
      party_info: 'Playbarn and inflatable parties are listed on the venue website; it gives no prices or packages.',
      description:
        'The Doves Play Barn is an indoor play barn at Heaven Farm, Furners Green, near Uckfield, for babies up to 5-year-olds. Built from sustainable wood, it has hidden spaces, rope bridges, slides and a toddler-safe area. There is a café serving cakes, bakes and coffee, and playbarn and inflatable parties are offered. Children from crawling to 5 years are £5.95, adults £1.25 and babies in arms are free. The venue website says it is open seven days a week, 9am to 5pm. Checked against the venue’s website on 27 October 2026.',
      meta_description: 'The Doves Play Barn near Uckfield is an indoor play barn for babies to 5-year-olds: £5.95 per child, café and parties.',
    },
  },
  {
    id: 900, expect: 'Funplex.',
    src: 'https://funplex.co.uk/play-area/',
    set: {
      postcode: 'BN2 4JE', email: 'info@funplex.co.uk', contact_email: 'info@funplex.co.uk',
      price_from: 7.45,
      pricing_hint: 'Children £9.95 at peak (weekends, inset days, school holidays) or £7.45 off-peak in term time; adults £2.25',
      parties: true, toddler_area: true, multi_level_play: true, has_multi_level_play: true,
      party_info: 'Private hire and VIP party packages are available; prices are given on request.',
      description:
        'Funplex is an indoor play centre at Unit 2b, The Hyde Business Park, Auckland Drive, Brighton. It has multi-level play frames that parents can join children on, three slides, a four-cannon soft ball area and a two-level area for smaller children. Child entry is £9.95 at peak times (weekends, inset days and school holidays) and £7.45 in term time; adults pay £2.25. Private hire and VIP party packages are available. Checked against the venue’s website on 27 October 2026.',
      meta_description: 'Funplex is an indoor play centre in Brighton with multi-level frames, three slides, a ball cannon area and a toddler area. From £7.45 per child.',
    },
  },
  {
    id: 886, expect: 'Palace Play',
    src: 'https://www.brightonpier.co.uk/explore/palace-play/',
    set: {
      postcode: 'BN2 1TW', price_from: 6.5,
      pricing_hint: '£6.50 for children under 0.9m and £9 for children over 0.9m, all day; wristband options also offered',
      parties: true, cafe: true, toddler_area: true,
      party_info: 'Birthday parties are offered; enquire through the pier’s Kids’ Parties page.',
      description:
        'Palace Play is the children’s soft play on Brighton Palace Pier, Madeira Drive. Children under 0.9m use the toddler area downstairs and must be accompanied; children over 0.9m can use the upper floors, and no one over 1.5m is allowed in. All-day entry is £6.50 under 0.9m and £9 over 0.9m. Palace Play Café is opposite the entrance, and birthday parties are offered. There are no toilets in the play area at present; the nearest are in the pier’s rides area, about 20 metres away. Checked against the pier’s website on 27 October 2026.',
      meta_description: 'Palace Play on Brighton Palace Pier: all-day soft play from £6.50, a toddler area, café and parties. Height limit 1.5m.',
    },
  },
  {
    id: 1449, expect: 'Washbrooks Family Farm',
    src: 'https://washbrooks.co.uk/admission-prices/ and https://washbrooks.co.uk/opening-hours/',
    set: {
      address: 'Brighton Road, Hurstpierpoint', postcode: 'BN6 9EF',
      phone: '01273 832201', email: 'info@washbrooks.co.uk', contact_email: 'info@washbrooks.co.uk',
      website: 'https://washbrooks.co.uk/',
      price_from: 9.5,
      pricing_hint: '£9.50 (ages 3–59), £8.50 over-60s, £34 for a group of four; under-3s free',
      membership_available: true, cafe: true,
      opening_hours: JSON.stringify(daily('09:30', '17:00')),
      opening_hours_text: 'Open every day 9:30am–5pm; tearoom 9:30am–4pm. Christmas Eve: tearoom closes 2pm, farm 3pm; reopens 2 January.',
      description:
        'Washbrooks Family Farm is a family farm at Brighton Road, Hurstpierpoint, with a tearoom. Admission is £9.50 for ages 3 to 59, £8.50 for over-60s and £34 for a group of four; children under 3 are free, and a paying disabled visitor’s carer (16 or over) is admitted free with a DLA or PIP letter. Annual membership for an individual aged 3 or over is £90. It is open every day, 9:30am to 5pm (tearoom 9:30am to 4pm). Checked against the farm’s website on 27 October 2026.',
      meta_description: 'Washbrooks Family Farm, Hurstpierpoint: £9.50 entry, under-3s free, open daily 9:30am–5pm, with a tearoom.',
    },
  },
  {
    id: 792, expect: "Barney's Play",
    src: 'https://barneysplay.co.uk/ and Google Places',
    set: { email: 'info@barneysplay.co.uk', contact_email: 'info@barneysplay.co.uk' },
  },
  {
    id: 908, expect: 'Two by Two softplay',
    src: 'Google Places (address 1-5 Roman Cres, Southwick BN42 4TY)',
    set: { postcode: 'BN42 4TY' },
  },
  {
    id: 1622, expect: 'Beechwood Hall & Rural Park',
    src: 'https://www.beechwoodhall.org/facilities (play area in a community park; no indoor soft play stated)',
    set: {
      venue_type: 'park-playground', postcode: 'BN7 3QG', website: 'https://www.beechwoodhall.org/',
      description:
        'Beechwood Hall & Rural Park is a village hall with a four-acre community park at Beechwood Lane, Cooksbridge, near Lewes. The park has a children’s play area and outdoor gym equipment; the hall seats up to 100 and has parking for up to 30 cars. The venue does not list indoor soft play. Checked against the venue’s website on 27 October 2026.',
    },
  },
  {
    id: 914, expect: 'FunPlay Leisure',
    src: 'https://www.brightonmarina.co.uk/whats-here/entertainment/funplay-leisure/ (operator lists no soft play)',
    set: { venue_type: 'family-attraction', phone: '07957 574380' },
  },
  {
    id: 1458, expect: 'Playcafe',
    src: 'https://www.stmatthiasbrighton.org/playcafe',
    set: {
      venue_type: 'family-attraction', email: 'playcafe@stmatthiasbrighton.org', contact_email: 'playcafe@stmatthiasbrighton.org',
      website: 'https://www.stmatthiasbrighton.org/playcafe',
      opening_hours_text: 'Monday to Friday 9:30am–12pm, school term times only',
      pricing_hint: 'No set charge; visitors are asked to buy a drink or snack',
      description:
        'Playcafé is a not-for-profit community café run by St Matthias Church in Brighton for parents, carers and pre-school children, with toys, coffee and snacks. It runs Monday to Friday, 9:30am to 12pm, in school term time only. It is a toddler café rather than a soft play centre. Checked against the church’s website on 27 October 2026.',
    },
  },
  // Updates for 919's coordinates are already correct (51.0193, 0.0035 per Google Places).
]

const INSERTS = [
  {
    slug: 'goddenwick-farm-play-barn', name: 'Goddenwick Farm Play Barn',
    city: 'Lindfield', county: 'West Sussex',
    address: 'Goddenwick Farm, Ardingly Road, Lindfield', postcode: 'RH16 2QX',
    lat: 51.03612, lng: -0.0580842,
    phone: null, email: null, website: 'https://goddenwickfarm.co.uk/the-play-barn/',
    category: 'Indoor Soft Play', venue_type: 'indoor',
    description:
      'The Play Barn at Goddenwick Farm, Lindfield, is an indoor play barn for ages 2 to 10 with a climbing castle (Goatsville), racer slides, a ball pit, climbing tunnels with nets, ropes and rope bridges, and a ride-on tractor and digger area. Sessions last 90 minutes and cost £7 for ages 3 to 10 and £4 for under-3s, with half price for a third child. A kiosk serves coffee, hot and cold drinks, ice cream and light bites. Birthday parties are £12 per child plus £50 room hire. It is open every day: Monday to Friday 9am–4pm, Saturday 9am–4:30pm and Sunday 10am–4pm. During the Pumpkin Festival (10–31 October) every visit must be booked online. Checked against the venue’s website on 27 October 2026.',
    meta_description: 'Goddenwick Farm Play Barn in Lindfield: indoor play for ages 2–10 with a climbing castle, slides and ball pit. £7 (£4 under-3s), open daily.',
    party_info: 'Birthday party: £12 per child plus £50 room hire. Includes 2 hours in the private Castle Room, 2 hours of play in the barn, a lunchbox per child, bunting, a King or Queen’s chair and crown, and a portable speaker.',
    hours: { monday: day('09:00', '16:00'), tuesday: day('09:00', '16:00'), wednesday: day('09:00', '16:00'), thursday: day('09:00', '16:00'), friday: day('09:00', '16:00'), saturday: day('09:00', '16:30'), sunday: day('10:00', '16:00') },
    hours_text: 'Monday to Friday 9am–4pm; Saturday 9am–4:30pm; Sunday 10am–4pm',
    flags: { cafe: true, parties: true },
    age_range_min: 2, age_range_max: 10,
    pricing_hint: '90-minute session: £7 for ages 3–10, £4 for under-3s; half price for the third child', price_from: 4,
    rating: 4.6, reviews_count: 114,
    google_place_id: 'ChIJO0mVlQn1dUgRWCCcr6FEDvY', google_maps_url: 'https://maps.google.com/?cid=17730184244230889560',
    sources: ['https://goddenwickfarm.co.uk/the-play-barn/'],
  },
  {
    slug: 'blackberry-farm-park', name: 'Blackberry Farm Park',
    city: 'Whitesmith', county: 'East Sussex',
    address: 'Blackberry Farm Park, Whitesmith', postcode: 'BN8 6JD',
    lat: 50.9107941, lng: 0.1615251,
    phone: '01825 872912', email: 'info@blackberry-farm.co.uk', website: 'https://blackberry-farm.co.uk/',
    category: 'Play farm', venue_type: 'play-farm',
    description:
      'Blackberry Farm Park, near Lewes, is a family farm park with two covered indoor play barns. Clucky’s Play Barn has a tube slide, a supervised drop slide that runs three times a day, ball cannons, indoor zip wires, a ball crawl, web climbs, a sensory area with strobe lighting and an area exclusively for babies; the area is covered but not heated, and socks must be worn. Chirpy’s Play Barn is aimed at toddlers, with giant Connect 4 and Jenga, see-saws, building blocks and small ride-on tractors. Admission for ages 2 and over is £16 off-peak or £18 at peak times (over-60s £15 and £16), and under-2s are free. The park is open 10am–5pm, or 10am–4pm in winter. Checked against the venue’s website on 27 October 2026.',
    meta_description: 'Blackberry Farm Park near Lewes: a family farm with two indoor play barns (Clucky’s and Chirpy’s). £16–£18 entry, under-2s free.',
    party_info: null,
    hours: daily('10:00', '17:00'),
    hours_text: 'Open every day 10am–5pm; winter 10am–4pm (bad weather can mean earlier closing)',
    flags: { cafe: true, toddler_area: true, baby_area: true },
    age_range_min: null, age_range_max: null,
    pricing_hint: 'Admission (age 2+): £16 off-peak, £18 peak; over-60s £15 / £16; under-2s free. The venue does not state on its site whether play barn access is included.', price_from: 16,
    rating: 4.5, reviews_count: 1162,
    google_place_id: 'ChIJP2YDt-xl30cRvtQa0GNAbgQ', google_maps_url: 'https://maps.google.com/?cid=319263421027243198',
    sources: ['https://blackberry-farm.co.uk/', 'https://blackberry-farm.co.uk/indoor-play-areas/', 'https://blackberry-farm.co.uk/opening-times/'],
  },
]

const dedupeKey = (v) => `${v.name}|${v.address}|${v.city}`.toLowerCase()
function completeness(v) {
  let s = 20
  if (v.phone) s += 10
  if (v.website) s += 10
  if (v.description) s += 15
  if (v.hours || v.hours_text) s += 10
  if (v.price_from) s += 10
  if (Object.values(v.flags).some(Boolean)) s += 10
  if (v.email) s += 5
  s += 5
  return Math.min(s, 100)
}

async function main() {
  const pool = await getPool()
  const c = await pool.connect()
  try {
    if (rollbackArg) {
      const b = JSON.parse(fs.readFileSync(path.resolve(rollbackArg), 'utf8'))
      console.log(`${EXECUTE ? 'ROLLING BACK' : 'DRY RUN rollback'}: restore ${b.rows.length} rows, delete ${b.insertedIds.length} inserted`)
      if (!EXECUTE) return
      await c.query('BEGIN')
      for (const row of b.rows) {
        const cols = Object.keys(row).filter((k) => k !== 'id')
        const vals = cols.map((k) => (row[k] !== null && typeof row[k] === 'object' ? JSON.stringify(row[k]) : row[k]))
        await c.query(`UPDATE venues SET ${cols.map((k, i) => `"${k}"=$${i + 2}`).join(',')} WHERE id=$1`, [row.id, ...vals])
      }
      if (b.insertedIds.length) await c.query('DELETE FROM venues WHERE id = ANY($1::int[]) AND slug = ANY($2::text[])', [b.insertedIds, b.insertedSlugs])
      await c.query('COMMIT')
      console.log('Restored.')
      return
    }
    console.log(EXECUTE ? 'EXECUTE\n' : 'DRY RUN: nothing will be written. Re-run with --execute.\n')

    const backupRows = []
    const plan = []
    for (const u of UPDATES) {
      const cols = Object.keys(u.set)
      const { rows } = await c.query(`SELECT id, name, ${cols.map((k) => `"${k}"`).join(',')} FROM venues WHERE id=$1`, [u.id])
      if (!rows[0] || rows[0].name !== u.expect) throw new Error(`id ${u.id}: expected "${u.expect}", found "${rows[0]?.name}"`)
      const old = rows[0]
      const changed = cols.filter((k) => JSON.stringify(old[k] ?? null) !== JSON.stringify(typeof u.set[k] === 'string' && (k === 'opening_hours') ? JSON.parse(u.set[k]) : u.set[k]))
      console.log(`UPDATE ${u.id} ${u.expect}  (${u.src})`)
      for (const k of changed) {
        const show = (x) => (x === null || x === undefined ? '∅' : String(typeof x === 'object' ? JSON.stringify(x) : x).replace(/\s+/g, ' ').slice(0, 110))
        console.log(`    ${k}: ${show(old[k])}  ->  ${show(u.set[k])}`)
      }
      const backup = { id: u.id }
      for (const k of cols) backup[k] = old[k]
      backupRows.push(backup)
      plan.push(u)
    }

    const ins = []
    for (const v of INSERTS) {
      const clash = await c.query('SELECT id, slug, is_active FROM venues WHERE slug=$1 OR (google_place_id=$2 AND is_active)', [v.slug, v.google_place_id])
      console.log(`${clash.rows.length ? 'SKIP  ' : 'INSERT'} ${v.slug} "${v.name}" [${v.address}, ${v.postcode}] type=${v.venue_type} completeness=${completeness(v)}`)
      console.log(`         price=${v.pricing_hint}  hours=${v.hours_text}`)
      if (clash.rows.length) console.log('         blocked by', JSON.stringify(clash.rows))
      else ins.push(v)
    }
    if (!EXECUTE) { console.log(`\nDry run: ${plan.length} updates, ${ins.length} inserts. Nothing written.`); return }

    fs.mkdirSync(path.join(ROOT, 'scripts/output/backups'), { recursive: true })
    await c.query('BEGIN')
    try {
      for (const u of plan) {
        const cols = Object.keys(u.set)
        const vals = cols.map((k) => u.set[k])
        await c.query(`UPDATE venues SET ${cols.map((k, i) => `"${k}"=$${i + 2}${k === 'opening_hours' ? '::jsonb' : ''}`).join(',')}, last_verified_at=$${cols.length + 2}, updated_by='phase9-02', updated_at=now() WHERE id=$1`, [u.id, ...vals, VERIFIED])
      }
      const ids = []
      for (const v of ins) {
        const f = v.flags
        const { rows } = await c.query(
          `INSERT INTO venues (name, slug, city_slug, city, county, region, country, address, postcode, lat, lng, phone, email, contact_email, website,
             description, meta_description, party_info, opening_hours, opening_hours_text, category, venue_type, indoor_or_outdoor,
             cafe, parties, toddler_area, baby_area, age_range_min, age_range_max, pricing_hint, price_from, rating, reviews_count,
             google_place_id, place_id, google_maps_url, facilities, tags, source_urls, dedupe_key, completeness_score, last_verified_at,
             needs_review, is_active, plan, plan_status, enrichment_notes, updated_by)
           VALUES ($1,$2,'brighton',$3,$4,'South East','United Kingdom',$5,$6,$7,$8,$9,$10,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,'indoor',
             $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$29,$30,$31::jsonb,$32::text[],$33::jsonb,$34,$35,$36,false,true,'free','inactive',$37,'phase9-02')
           RETURNING id`,
          [v.name, v.slug, v.city, v.county, v.address, v.postcode, v.lat, v.lng, v.phone, v.email, v.website,
            v.description, v.meta_description, v.party_info, JSON.stringify(v.hours), v.hours_text, v.category, v.venue_type,
            f.cafe ?? null, f.parties ?? null, f.toddler_area ?? null, f.baby_area ?? null, v.age_range_min, v.age_range_max, v.pricing_hint, v.price_from, v.rating, v.reviews_count,
            v.google_place_id, v.google_maps_url, JSON.stringify(f), ['soft-play', 'indoor-play', 'kids-activities', 'brighton'], JSON.stringify(v.sources), dedupeKey(v), completeness(v), VERIFIED,
            `Added ${VERIFIED} from the venue's own website; see source_urls.`]
        )
        ids.push({ id: rows[0].id, slug: v.slug })
        console.log(`  inserted id=${rows[0].id} ${v.slug}`)
      }
      const file = path.join(ROOT, `scripts/output/backups/phase9-02-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
      fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), rows: backupRows, insertedIds: ids.map((x) => x.id), insertedSlugs: ids.map((x) => x.slug) }, null, 2))
      await c.query('COMMIT')
      console.log(`\nDone. Undo file: ${path.relative(ROOT, file)}\nids: ${JSON.stringify(ids)}`)
    } catch (e) { await c.query('ROLLBACK'); throw e }
  } finally { c.release(); await pool.end() }
}
main().catch((e) => { console.error(e); process.exit(1) })
