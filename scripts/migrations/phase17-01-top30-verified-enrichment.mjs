#!/usr/bin/env node
/**
 * phase17-01: verified enrichment of the top venues by Search Console impressions
 * (SEO Phase 4 follow-up, 25 Nov 2026, approved by David).
 *
 * Every value below was read on the venue's (or operator's) own website on
 * 25 Nov 2026; the page is recorded in source_urls. Nothing comes from third-party
 * directories, Groupon, blogs or reviews.
 *
 * Rules:
 * - Facilities are only ever set to TRUE (stated by the site). A facility the site
 *   doesn't mention keeps its current value; we never write "no".
 * - prebooking_required is set only when the site says so either way
 *   ("NO NEED TO BOOK" -> false, "everyone books before visiting" -> true).
 * - Ages only when the site gives both ends of the range.
 * - Price breakdowns go in session_info (rendered as "Sessions" on the page) with
 *   the date they were checked; price_from / price_to drive Quick facts.
 *
 * Skipped, with reasons, in the Phase 4 follow-up report: CJ's Funhouse (site empty),
 * Round The Twist (site refuses fetches), Treetops (TLS fault), Cottingham Sports
 * Centre (404), and the nine venues with no website of their own.
 *
 *   node scripts/migrations/phase17-01-top30-verified-enrichment.mjs            # dry run
 *   node scripts/migrations/phase17-01-top30-verified-enrichment.mjs --execute  # write + backup
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'

const EXECUTE = process.argv.includes('--execute')
const CHECKED = '2026-11-25'
const TAG = 'phase17-01-top30-verified-enrichment'
const checkedLine = (what) => `${what} from the venue's website, checked 25 November 2026.`

/** @type {Array<{id:number,name:string,sources:string[],set:Record<string,any>,notes:string}>} */
const UPDATES = [
  {
    id: 799, name: 'Kids Play ESK Eastbourne',
    sources: ['https://www.eskevents.com/', 'https://www.eskevents.com/pages/birthday-parties'],
    set: { website: 'https://www.eskevents.com/', cafe: true, parties: true,
      session_info: `One adult per child is admitted free; additional adults £4. Parties: exclusive hire for 1 hour, £120 (minimum 10 children), food £6 per child. ${checkedLine('Prices')}` },
    notes: 'kidsplayesk.com now redirects to eskevents.com (same operator). Cafe "operated independently". No child entry price or Eastbourne hours stated.',
  },
  {
    id: 578, name: 'Rascal Ranch',
    sources: ['https://rascalranchgroup.com/', 'https://rascalranchgroup.com/leicester'],
    set: { price_from: 5, price_to: 6.5, cafe: true, parking: true, free_parking: true, parties: true, toddler_area: true, prebooking_required: false,
      session_info: `8–11 months £5; 12 months–3 years £5.50; 4 years and over £6.50; adults £2.75. Wednesday deal (term time, after 3pm): £10 for entry plus a kids' lunch. Sessions last 2 hours; no booking needed (walk-in, first come, first served). Socks required for children and adults; no outside food or drink. ${checkedLine('Prices and rules')}` },
    notes: 'No upper age stated, so ages left empty.',
  },
  {
    id: 553, name: 'The Square Play Cafe',
    sources: ['https://www.thesquareplaycafe.co.uk/', 'https://www.thesquareplaycafe.co.uk/rules-of-play'],
    set: { cafe: true, parties: true, baby_area: true,
      session_info: `Play sessions are booked online. Dedicated baby space for under 18 months. Party packages from £225 (exclusive hire, 90 minutes), usually weekends only. ${checkedLine('Details')}` },
    notes: 'Site says to reserve online but does not say walk-ins are refused, so prebooking_required not set. No entry prices on site.',
  },
  {
    id: 1006, name: 'Play Glossop',
    sources: ['http://www.playglossop.co.uk/', 'http://www.playglossop.co.uk/prices', 'http://www.playglossop.co.uk/opening-times', 'http://www.playglossop.co.uk/rules'],
    set: { age_range_min: 0, age_range_max: 7, price_from: 5, price_to: 7, cafe: true, parking: true, parties: true, toddler_area: true, baby_area: true, prebooking_required: false,
      session_info: `Term-time weekdays: £5 per child (£8 with a kids' meal), 2 hours of play. Weekends, bank and school holidays: £7 per child (£10 with a meal), 1 hour 45 minutes. Recommended for under 8s (under 148 cm). Separate under-2s area. No need to book. ${checkedLine('Prices')}` },
    notes: 'Rules page: "recommended under 8 years old". Free parking not stated.',
  },
  {
    id: 264, name: 'The Fun Jungle',
    sources: ['http://thefunjungle.com/', 'https://thefunjungle.com/washington/about-us/'],
    set: { age_range_min: 0, age_range_max: 12, cafe: true, parking: true, free_parking: true, parties: true, toddler_area: true, baby_area: true },
    notes: 'Washington branch (Sulgrave Road, NE37 3AZ). Site: "children 0-12 years old", "free car parking", "dedicated playzones for babies, toddlers and juniors". No prices on site (booking via Roller).',
  },
  {
    id: 97, name: 'The Play Lounge',
    sources: ['https://www.theplaylounge.co.uk/', 'https://www.theplaylounge.co.uk/faqs'],
    set: { parking: true, free_parking: true, parties: true, prebooking_required: false },
    notes: 'FAQ: walk-ins welcome "as long as we have space". Car park shared and limited. Site hours disagree about Wednesday, so hours not changed.',
  },
  {
    id: 1011, name: 'The Nook Saddleworth Play Cafe',
    sources: ['https://www.thenooksaddleworth.co.uk/stayplay', 'https://www.thenooksaddleworth.co.uk/faqs'],
    set: { age_range_min: 0, age_range_max: 8, price_from: 10, price_to: 10, cafe: true, parking: true, parties: true, prebooking_required: true,
      session_info: `Stay + Play: £10 per child (0–8 years); sibling discount; siblings under 3 months free. Everyone books before visiting. On-street parking outside the mill, with a car park two minutes' walk away in Delph. The premises is reached by several steps. ${checkedLine('Prices')}` },
    notes: 'FAQ suggests newborn-5 as a guide; price line says 0-8, used for the range.',
  },
  {
    id: 531, name: 'Fun Valley Nottingham',
    sources: ['https://funvalley.co.uk/fun-valley-nottingham/'],
    set: { price_from: 3, price_to: 11.9, cafe: true, parking: true, free_parking: true, parties: true, toddler_area: true,
      session_info: `Under 12 months £3 (free with a paying sibling); 0–4 years £9.40; 5 and over £11.90; adults £2.50. Members: 0–4 £7.50, 5+ £9.50. Parties £14 per child off-peak, £17 peak. ${checkedLine('Prices')}` },
    notes: 'Price bands are not stated age limits, so ages left empty.',
  },
  {
    id: 581, name: 'Fun Valley Leicester',
    sources: ['https://funvalley.co.uk/fun-valley-leicester/'],
    set: { price_from: 7.5, price_to: 8.5, cafe: true, parking: true, free_parking: true, parties: true, toddler_area: true,
      session_info: `0–3 years £7.50; 4 and over £8.50; adults £2; under 1s free with a paying sibling. Term-time weekdays: one free adult per paying child. Parties £13.20 per child off-peak, £16.50 peak. Closed Mondays except in school holidays. ${checkedLine('Prices')}` },
    notes: 'Price bands are not stated age limits, so ages left empty.',
  },
  {
    id: 445, name: 'Acorn and Oak Soft Play',
    sources: ['https://acornandoakplaycafe.co.uk/whitley-bay-soft-play/', 'https://acornandoakplaycafe.co.uk/book-soft-play/', 'https://acornandoakplaycafe.co.uk/contact-us/'],
    set: { age_range_min: 0, age_range_max: 8, price_from: 4.75, price_to: 7.75, cafe: true, parties: true, baby_area: true,
      session_info: `Under 12 months £4.75; 12 months and over £7.75; adults free. Sessions last 1 hour 45 minutes. Free 2-hour parking on the bridge towards the Broadway and on Whitley Road. ${checkedLine('Prices')}` },
    notes: 'Hours differ between the booking and contact pages, so not changed. Parking is on-street, so parking flag not set.',
  },
  {
    id: 409, name: 'Mini Minds Play Village',
    sources: ['https://www.minimindsplayvillage.co.uk/', 'https://www.minimindsplayvillage.co.uk/tcs/', 'https://www.minimindsplayvillage.co.uk/playtime-rules/'],
    set: { age_range_min: 0, age_range_max: 6, price_from: 5, price_to: 8.99, cafe: true, parking: true, free_parking: true, parties: true, baby_area: true, prebooking_required: true,
      session_info: `Under 12 months £5 (free with a full-paying child); over 12 months £8.99; adults £2. Tickets must be bought in advance online; sessions last 90 minutes. Baby area for under 18 months. Free on-site parking (limited). ${checkedLine('Prices')}` },
    notes: 'Designed for "children up to 6 years old".',
  },
  {
    id: 1993, name: 'Vikings Play Centre',
    sources: ['http://vikingsplay.co.uk/', 'https://vikingsplay.co.uk/?page_id=1861', 'https://vikingsplay.co.uk/?page_id=1862'],
    set: { age_range_min: 0, age_range_max: 11, price_from: 1, price_to: 7.5, cafe: true, parking: true, free_parking: true, parties: true, toddler_area: true, baby_area: true, sen_friendly: true, has_sen_sessions: true, prebooking_required: false,
      email: 'info@vikingsplay.co.uk',
      session_info: `Under 6 months £1; 6 months–3 years £6.50 (£6 online); 4–11 years £7.50 (£7 online); adults £1. Open 7 days, 9:30am–6pm. SEN and autism night on the first Wednesday of each month, 4pm–6pm. Walk-ins accepted unless at capacity. ${checkedLine('Prices')}` },
    notes: 'Unit 3, Viking Court, Shepshed Rd, Hathern.',
  },
  {
    id: 910, name: 'SHWEET SOFT PLAY',
    sources: ['https://shweet.co.uk/soft-play'],
    set: { age_range_min: 0, age_range_max: 6, parties: true, baby_area: true,
      session_info: `A two-tier dessert-themed soft play for 0–6 year olds, with a sensory area for babies and crawlers. Sessions are bookable online. ${checkedLine('Details')}` },
    notes: 'Site address is 2 Barnham Road, Barnham (near Bognor Regis). No prices on site.',
  },
  {
    id: 1967, name: 'The Little Luxe Soft Play Centre',
    sources: ['https://littleluxesoftplay.com/our-venue/', 'https://littleluxesoftplay.com/contact-us/'],
    set: { cafe: true, parties: true, sen_friendly: true, has_sen_sessions: true },
    notes: 'Site mentions "Group bookings and SEN sessions". No ages or entry prices.',
  },
  {
    id: 274, name: 'Super Tramp Sunderland Trampoline Park',
    sources: ['https://www.supertrampparks.co.uk/soft-play', 'https://www.supertrampparks.co.uk/all-session-prices', 'https://www.supertrampparks.co.uk/facilities'],
    set: { price_from: 7.5, price_to: 7.5, cafe: true, parties: true, sen_friendly: true, has_sen_sessions: true, prebooking_required: false,
      session_info: `Soft play: £7.50 per child for a 2-hour session, plus £2 per accompanying adult; for children from walking age to 11. SEND sessions £10.99 with one free carer. Bookings taken on arrival, but booking online is strongly recommended. ${checkedLine('Prices')}` },
    notes: 'Minimum age is "walking age", so ages left empty.',
  },
  {
    id: 1603, name: 'Bexhill Leisure Centre',
    sources: ['https://www.freedom-leisure.co.uk/centres/bexhill-leisure-centre/soft-play'],
    set: { website: 'https://www.freedom-leisure.co.uk/centres/bexhill-leisure-centre/soft-play', age_range_min: 0, age_range_max: 8, parties: true, prebooking_required: false,
      session_info: `Jumbo's soft play is currently closed for centre refurbishment, according to the operator (Freedom Leisure). When open it is for children aged 8 and under, in 1 hour 15 minute sessions; walk-ins accepted subject to availability. ${checkedLine('Status')}` },
    notes: 'Closed for refurbishment at 25 Nov 2026.',
  },
  {
    id: 1926, name: 'My Little World Play Centre',
    sources: [],
    set: { website: null },
    notes: 'mylittleworldroleplay.co.uk is a parked "domain may be for sale" page; link removed.',
  },
]

const url = process.env.DATABASE_URL ?? fs.readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^["']|["']$/g, '')
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

const cols = new Set((await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='venues'`)).rows.map((r) => r.column_name))
const touched = new Set(['source_urls', 'last_verified_at', 'enrichment_notes', 'updated_by', 'updated_at'])
for (const u of UPDATES) for (const k of Object.keys(u.set)) { if (!cols.has(k)) throw new Error(`unknown column ${k}`); touched.add(k) }

const ids = UPDATES.map((u) => u.id)
const before = (await client.query(`SELECT id, name, ${[...touched].join(', ')} FROM venues WHERE id = ANY($1)`, [ids])).rows
const byId = new Map(before.map((r) => [r.id, r]))

for (const u of UPDATES) {
  const row = byId.get(u.id)
  if (!row) throw new Error(`venue ${u.id} not found`)
  if (!row.name.toLowerCase().startsWith(u.name.toLowerCase().slice(0, 8))) throw new Error(`name mismatch for ${u.id}: ${row.name}`)
  const changes = Object.entries(u.set).filter(([k, v]) => String(row[k]) !== String(v)).map(([k, v]) => `${k}: ${JSON.stringify(row[k])} -> ${JSON.stringify(v)}`)
  console.log(`\n${u.id} ${row.name}\n  ${changes.join('\n  ') || '(no field changes)'}`)
}

if (!EXECUTE) { console.log('\nDry run. Re-run with --execute to write.'); await client.end(); process.exit(0) }

const backupDir = 'scripts/output/backups'
fs.mkdirSync(backupDir, { recursive: true })
const backupFile = path.join(backupDir, `${TAG}-${Date.now()}.json`)
fs.writeFileSync(backupFile, JSON.stringify(before, null, 1))
console.log(`\nBackup: ${backupFile}`)

await client.query('BEGIN')
try {
  for (const u of UPDATES) {
    const row = byId.get(u.id)
    const entries = Object.entries(u.set)
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`)
    const sources = [...new Set([...(Array.isArray(row.source_urls) ? row.source_urls : []), ...u.sources])]
    const notes = [row.enrichment_notes, `${CHECKED} (${TAG}): verified on the venue's own website. ${u.notes}`].filter(Boolean).join('\n')
    const n = entries.length
    await client.query(
      `UPDATE venues SET ${[...sets, `source_urls = $${n + 2}::jsonb`, `enrichment_notes = $${n + 3}`, `last_verified_at = $${n + 4}`, `updated_by = $${n + 5}`, 'updated_at = NOW()'].join(', ')} WHERE id = $1`,
      [u.id, ...entries.map(([, v]) => v), JSON.stringify(sources), notes, CHECKED, TAG],
    )
  }
  await client.query('COMMIT')
  console.log(`Updated ${UPDATES.length} venues.`)
} catch (e) {
  await client.query('ROLLBACK')
  throw e
}
await client.end()
