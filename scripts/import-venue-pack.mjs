#!/usr/bin/env node
/**
 * import-venue-pack.mjs
 *
 * Imports a curated "venue pack" (venues.json, generated 2026-10-07) into
 * the Neon `venues` table AND the static fallback exports in data/generated/
 * (production builds prerender from the static files; ISR then switches to
 * the DB, so both have to carry the venue).
 *
 * Rules (from the pack's CLAUDE_CODE_IMPORT.md):
 *   - Only venues with status "open" are imported. closing_*, verify_still_open
 *     and open_unverified_website are skipped unless --include-unverified.
 *   - Dedupe against the DB on (normalised postcode + name), and on slug.
 *   - Facility flags are written only when the pack says true/false. Null is
 *     stored as NULL (unknown), never false.
 *   - No photos are imported (the pack marks them unlicensed draft assets).
 *   - Public descriptions are hand-written below: the pack's own descriptions
 *     contain internal editorial notes ("verify before publish", etc).
 *
 * Usage:
 *   node scripts/import-venue-pack.mjs <venues.json>                     # dry run
 *   node scripts/import-venue-pack.mjs <venues.json> --execute           # write DB + static JSON
 *   node scripts/import-venue-pack.mjs <venues.json> --include-unverified
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const GEN = path.join(ROOT, 'data', 'generated')

const EXECUTE = process.argv.includes('--execute')
const INCLUDE_UNVERIFIED = process.argv.includes('--include-unverified')
const IMPORT_TAG = 'venue-pack-2026-10-07'
const PACK_PATH = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!PACK_PATH) {
  console.error('Usage: node scripts/import-venue-pack.mjs <venues.json> [--execute] [--include-unverified]')
  process.exit(1)
}

// ── Public copy (no internal notes) ─────────────────────────────────────────

const COPY = {
  'little-jungle-soft-play-coventry':
    'Jungle-themed indoor soft play on the first floor of Rialto Plaza in Coundon, a few minutes from Coventry city centre. There is a three-tier frame for ages 1-8, a separate two-tier structure for under-4s, a cafe and a private party pod. Pre-booking is recommended.',
  'jam-jam-boomerang-coventry':
    "Coventry's large indoor play and party centre for children up to 12, with a separate baby and toddler space, a cafe, and laser parties for ages 8-12 from 5.30pm. Walk-ins are accepted. Find it at Middlemarch Business Park, off the A45/A46. No outside food or drink is allowed.",
  'riverside-hub-northampton':
    'Large indoor play centre behind the Mercedes-Benz dealership at Riverside Park. One ticket covers the play frame, toddler village, sensory rooms, role-play villages, climbing trees, laser tag, go-karts and arcade games. Tickets and parking are pre-booked, the centre aims to be nut-free, and SEND-exclusive evening sessions are run on a monthly basis.',
  'roar-and-explore-dairy-farm-belfast':
    'Indoor soft play for under-10s inside Dairy Farm Shopping Centre in Dunmurry, Belfast. The bottom levels of both play areas are wheelchair accessible and there is a cafe on site. Toddler mornings run Monday to Friday 9.30-12 and include juice and toast. Closed on Tuesdays in term time.',
  'kidzworld-cornwall-st-austell':
    'Indoor adventure play at Stadium Retail Park in St Austell, with soft play plus trampolines and roller skating on some sessions (height 1m+). Sessions are timed and online booking is recommended. Free parking is available on site and socks are required.',
  'wild-things-play-project-plymouth':
    'City-centre play cafe on the upper level of Drake Circus, next to the car park entrance, for ages 0-7. Play is wooden and sensory rather than a classic plastic frame, with climbing, sand, a craft corner and an under-3s area. No booking is required, though phone bookings are taken. Freshly made food is served in the cafe.',
  'iplay-exeter':
    'Large indoor play centre in Marsh Barton with Jurassic and Ice Age zones, a mini-tot area for babies and toddlers up to 3, and a sensory room. An on-site trampoline park (iBounce) is available as an upgrade. A rainforest cafe overlooks the play frame. Baby and me sessions and private hire are offered.',
  'wonderland-play-exeter':
    'Session-based soft play in Marsh Barton, Exeter, open four days a week. Session times differ in school holidays, so check the venue page for the current timetable before you travel.',
  'fuzzy-eds-weavers-mill-dundee':
    'Soft play fun house attached to the Weavers Mill family pub at Camperdown Leisure Park in Dundee. A baby area for about 0-4s sits alongside an older section for about 5-12s, with a height limit of around 4ft 9in-4ft 10in. Parking is available on the leisure park. Tots sessions have been advertised, so check the venue for the current timetable.',
  'zippys-playworld-chester':
    'Family-run soft play and party centre in Chester, with parking at the front and a rear car park off Newry Park. Booking online is cheaper than paying at the door. Weekend sessions are timed, and hours can vary for cleaning and private events.',
  'infinity-parks-derby':
    'City-centre indoor play park at Riverlights, next to the bus station and Premier Inn. About 10,000 sq ft of play: an inflatable arena (about ages 4-14), a three-floor soft play frame (0-12), a football cage (5-14) and a toddler village (0-4). There is a cafe and party rooms. There is no on-site parking; the nearest is the Derbion basement car park.',
  'kidz-town-stirling':
    'Role-play town for children up to about 9, rather than a classic multi-level frame. There is a cafe and on-site parking, stay-and-play sessions on some term-time weekdays, and private party sessions. Closed on Mondays except in the Easter holidays.',
  '360-play-milton-keynes':
    'Large 360 Play indoor centre in Knowlhill with soft play, rides and party packages. Sessions are not time-capped and the venue is cashless. Parking is free on and around the site. Book five days ahead for 10% off general admission. Under-1s are free.',
  'little-sharks-soft-play-kings-lynn':
    'Underwater-themed soft play and sensory room for ages 0-12. There is a junior frame with a four-lane slide and a separate under-5s area. Sessions are 90-minute bookable slots with a maximum of 8 per booking. Free parking is available on the industrial estate.',
  'active-zone-leys-pools-oxford':
    'Soft play inside Leys Pools & Leisure Centre in Blackbird Leys, suitable for under-12s, alongside Tag-X and a climbing wall. Adults and spectators go free, with three hours of free parking. Under-1s are free. Stay and play groups run on Tuesdays and Fridays 9.30-12, with monthly messy play for under-5s.',
}

// Hours the pack itself flags as conflicting: leave these days/venues out
// rather than publishing a guess.
const SKIP_HOURS_DAYS = {}
// Little Jungle: listings disagree on Thursday close (17:00 vs 14:30). Publish the
// earlier time so nobody turns up after closing, and say so in session_info.
const HOURS_OVERRIDE = {
  'little-jungle-soft-play-coventry': { thursday: '09:00 - 14:30' },
}
const SESSION_INFO = {
  'little-jungle-soft-play-coventry':
    'Term-time opening is Monday, Thursday, Friday, Saturday and Sunday, with extra days in school holidays. Thursday closing time is unconfirmed (14:30 or 17:00), so check before you go.',
  'jam-jam-boomerang-coventry':
    'Toddler mornings run Monday to Friday in term time (listed as 9.30-11.30, and as 9.30-13.30 on the venue site). Laser parties for ages 8-12 run 17.30-19.30.',
  'riverside-hub-northampton':
    'SEND-exclusive evenings run monthly, 18:30-21:00. Weekday evening parties run 16:30-18:30. Check the booking calendar for current opening times.',
  'roar-and-explore-dairy-farm-belfast':
    'Closed on Tuesdays in term time; open every day in school holidays. Toddler mornings run Monday to Friday 9.30-12.',
  'kidzworld-cornwall-st-austell':
    'In term time the centre is closed Monday and Tuesday, with split sessions Wednesday to Friday. It opens seven days a week in local school holidays (10:00-13:00 and 14:00-17:00). Weekend sessions vary, so check the booking calendar.',
  'wild-things-play-project-plymouth':
    'Closing times can be earlier than the hours shown, so call ahead if you are visiting late in the day.',
  'iplay-exeter':
    'The trampoline upgrade is available Monday to Friday 9-3 (off-peak) only.',
  'wonderland-play-exeter':
    'Open four days a week, with a different timetable in school holidays. Check the venue page for the current days and session times.',
  'zippys-playworld-chester':
    'Weekend sessions are timed (for example 9:30-11:30, 12:00-14:00, 14:30-16:30 and 15:00-17:00). Holiday hours differ, so check the booking portal.',
  'infinity-parks-derby':
    'Closed Tuesday and Wednesday in term time. Open daily 9:00-18:00 in school holidays.',
  'kidz-town-stirling':
    'Closed on Mondays except during the Easter holidays.',
  '360-play-milton-keynes':
    'Opens at 9:30 in the February, October and Christmas school holidays. Closed on Christmas Eve, Christmas Day and Boxing Day.',
  'active-zone-leys-pools-oxford':
    'Stay and play groups run on Tuesdays and Fridays 9.30-12. Soft play follows the leisure centre opening hours; check the Oxford City Leisure site for the full timetable.',
}
const SKIP_ALL_HOURS = new Set(['wonderland-play-exeter'])

// Pack facility flags that its own notes say still need confirming.
const FORCE_UNKNOWN = {
  'fuzzy-eds-weavers-mill-dundee': ['sen_sessions'],
}

// Clean single child prices only (the pack gives ranges elsewhere).
const PRICE_FROM = {
  'little-jungle-soft-play-coventry': 8.95,
  'roar-and-explore-dairy-farm-belfast': 7.95,
  'kidz-town-stirling': 7.95,
  'active-zone-leys-pools-oxford': 5,
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const cap = (s) => s[0].toUpperCase() + s.slice(1)
const normPc = (p) => (p || '').replace(/\s+/g, '').toUpperCase()

function loadEnv() {
  const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  const m = env.match(/^DATABASE_URL=(.*)$/m)
  if (!m) throw new Error('DATABASE_URL not found in .env.local')
  return m[1].trim().replace(/^["']|["']$/g, '')
}

function hoursFor(v) {
  if (SKIP_ALL_HOURS.has(v.slug)) return { json: null, text: null }
  const skip = SKIP_HOURS_DAYS[v.slug] || []
  const json = {}
  const parts = []
  for (const d of DAYS) {
    const raw = v.hours?.[d]
    if (skip.includes(d)) continue
    if (raw === 'closed') { json[d] = 'closed'; parts.push(`${cap(d)}: Closed`); continue }
    const over = HOURS_OVERRIDE[v.slug]?.[d]
    if (over) { json[d] = over; parts.push(`${cap(d)}: ${over.replace(/ - /g, ' – ')}`); continue }
    if (raw === 'timed') { json[d] = 'Timed sessions'; parts.push(`${cap(d)}: Timed sessions`); continue }
    if (raw === 'varies') { json[d] = 'Varies, check booking calendar'; parts.push(`${cap(d)}: Varies`); continue }
    const m = typeof raw === 'string' && raw.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})(?:, (\d{2}:\d{2})-(\d{2}:\d{2}))?$/)
    if (!m) continue // "timed", "varies", null → leave out
    const val = m[3] ? `${m[1]} - ${m[2]}, ${m[3]} - ${m[4]}` : `${m[1]} - ${m[2]}`
    json[d] = val
    parts.push(`${cap(d)}: ${val.replace(/ - /g, ' – ')}`)
  }
  if (!parts.length) return { json: null, text: null }
  return { json, text: parts.join('; ') }
}

function flag(v, key) {
  if ((FORCE_UNKNOWN[v.slug] || []).includes(key)) return null
  const x = v.facilities?.[key]
  return x === true || x === false ? x : null
}

function toRow(v) {
  const h = hoursFor(v)
  const parking = flag(v, 'parking')
  return {
    name: v.name,
    slug: v.slug,
    city_slug: v.city_slug,
    city: v.city,
    town: v.city,
    county: v.county,
    region: v.region,
    country: 'UK',
    address: v.address_line,
    postcode: v.postcode ? v.postcode.toUpperCase() : null,
    phone: v.phone,
    email: v.email,
    website: v.website,
    description: COPY[v.slug],
    opening_hours: h.json,
    opening_hours_text: h.text,
    session_info: SESSION_INFO[v.slug] || null,
    cafe: flag(v, 'cafe'),
    parking,
    parties: flag(v, 'parties'),
    toddler_area: flag(v, 'toddler_area'),
    baby_area: flag(v, 'baby_area'),
    sen_friendly: flag(v, 'sen_sessions'),
    has_sen_sessions: flag(v, 'sen_sessions'),
    wheelchair_access: flag(v, 'wheelchair_access'),
    free_wifi: flag(v, 'wifi'),
    has_party_rooms: flag(v, 'parties'),
    has_under_1s: v.under_1s_free === true ? true : null,
    price_from: PRICE_FROM[v.slug] ?? null,
    pricing_hint: v.price_notes || null,
    rating: null,
    reviews_count: null,
    age_range_min: v.age_min,
    age_range_max: v.age_max,
    category: 'Indoor playground',
    venue_type: 'indoor',
    source_urls: JSON.stringify(v.source_urls || []),
    source_meta: JSON.stringify({
      import: IMPORT_TAG,
      pack_status: v.status,
      photo_source_url: v.photo_source_url || null,
      photo_note: v.photo_source_url ? 'Not imported: unlicensed. Prefer owner-supplied image on claim.' : null,
      parking_notes: v.facilities?.parking_notes || null,
      hours_notes: v.hours?.notes || null,
    }),
    needs_review: true,
    enrichment_notes: 'Imported from venue pack 2026-10-07. Hours, prices and facilities from third-party sources — confirm with venue.',
    updated_by: 'venue-pack-import',
  }
}

function toStatic(row, id) {
  return {
    id,
    town: row.town,
    townSlug: row.city_slug,
    name: row.name,
    slug: row.slug,
    address: row.address || '',
    postcode: row.postcode || '',
    lat: null,
    lng: null,
    phone: row.phone || '',
    website: row.website || '',
    mapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(`${row.name} ${row.postcode || row.town}`)}`,
    googlePlaceId: '',
    category: row.category,
    description: row.description,
    openingHoursText: row.opening_hours_text || '',
    rating: null,
    reviewCount: null,
    cafe: row.cafe,
    parking: row.parking,
    parties: row.parties,
    toddlerArea: row.toddler_area,
    babyArea: row.baby_area,
    senFriendly: row.sen_friendly,
    wheelchairAccess: row.wheelchair_access,
    freeWifi: row.free_wifi,
    hasOutdoorPlay: null,
    hasPartyRooms: row.has_party_rooms,
    hasSenSessions: row.has_sen_sessions,
    hasRolePlay: null,
    hasMultiLevelPlay: null,
    priceFrom: row.price_from,
    priceTo: null,
    pricingHint: row.pricing_hint || '',
    mainImageUrl: null,
    featured: false,
    venueType: 'indoor',
    lastVerified: '',
    notes: '',
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const pack = JSON.parse(fs.readFileSync(PACK_PATH, 'utf8'))
  const eligible = pack.venues.filter((v) => v.status === 'open' || INCLUDE_UNVERIFIED)
  const held = pack.venues.filter((v) => !eligible.includes(v))
  for (const v of eligible) if (!COPY[v.slug]) throw new Error(`No public copy written for ${v.slug}`)

  console.log(`=== Venue pack import (${EXECUTE ? 'EXECUTE' : 'DRY RUN'}) ===`)
  console.log(`Pack: ${pack.venues.length} venues; eligible: ${eligible.length}; held back: ${held.length}`)
  for (const v of held) console.log(`  held back: ${v.name} (${v.city}) — status ${v.status}`)

  const pool = new pg.Pool({ connectionString: loadEnv(), ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()
  const inserted = []
  try {
    const { rows: existing } = await client.query(
      `SELECT id, name, slug, city_slug, postcode, source_meta->>'import' AS import_tag, claimed_by_owner FROM venues`
    )
    const toInsert = []
    const toRefresh = [] // rows this same script imported earlier: re-apply our fields, never touch anyone else's
    for (const v of eligible) {
      const dupe = existing.find(
        (e) =>
          (e.slug === v.slug && e.city_slug === v.city_slug) ||
          (v.postcode && normPc(e.postcode) === normPc(v.postcode) && e.name.toLowerCase() === v.name.toLowerCase())
      )
      if (!dupe) toInsert.push(toRow(v))
      else if (dupe.import_tag === IMPORT_TAG && !dupe.claimed_by_owner) toRefresh.push({ id: dupe.id, row: toRow(v) })
      else console.log(`  SKIP duplicate: ${v.name} ↔ id ${dupe.id} ${dupe.name} (${dupe.city_slug})`)
    }
    console.log(`\nTo insert: ${toInsert.length}; to refresh (own earlier import): ${toRefresh.length}`)
    for (const r of toInsert) console.log(`  + ${r.name} — ${r.city_slug} ${r.postcode || '(no postcode)'}`)
    for (const r of toRefresh) console.log(`  ~ ${r.row.name} — id ${r.id}`)

    if (EXECUTE && (toInsert.length || toRefresh.length)) {
      await client.query('BEGIN')
      for (const { id, row } of toRefresh) {
        const cols = Object.keys(row).filter((c) => !['slug', 'city_slug'].includes(c))
        const jsonCols = ['opening_hours', 'source_urls', 'source_meta']
        const values = cols.map((c) => (c === 'opening_hours' && row[c] ? JSON.stringify(row[c]) : row[c]))
        await client.query(
          `UPDATE venues SET ${cols.map((c, i) => `${c} = $${i + 1}${jsonCols.includes(c) ? '::jsonb' : ''}`).join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1}`,
          [...values, id]
        )
        inserted.push({ id, row })
      }
      for (const r of toInsert) {
        const cols = Object.keys(r)
        const params = cols.map((_, i) => `$${i + 1}`)
        const casts = { opening_hours: '::jsonb', source_urls: '::jsonb', source_meta: '::jsonb' }
        const values = cols.map((c) => (c === 'opening_hours' && r[c] ? JSON.stringify(r[c]) : r[c]))
        const res = await client.query(
          `INSERT INTO venues (${cols.join(',')}) VALUES (${cols.map((c, i) => params[i] + (casts[c] || '')).join(',')})
           ON CONFLICT (city_slug, slug) DO NOTHING RETURNING id`,
          values
        )
        if (res.rows[0]) inserted.push({ id: res.rows[0].id, row: r })
      }
      await client.query('COMMIT')
      console.log(`\nWrote ${inserted.length} rows (${toInsert.length} new, ${toRefresh.length} refreshed): ids ${inserted.map((i) => i.id).join(', ')}`)
    }
  } catch (e) {
    if (EXECUTE) await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
    await pool.end()
  }

  if (!EXECUTE) { console.log('\nDry run only — nothing written. Re-run with --execute.'); return }
  if (!inserted.length) return

  // ── Static fallback exports (append only; no reformatting of existing data)
  const venuesPath = path.join(GEN, 'venues.json')
  const byTownPath = path.join(GEN, 'venuesByTown.json')
  const townsPath = path.join(GEN, 'towns.json')
  const venues = JSON.parse(fs.readFileSync(venuesPath, 'utf8'))
  const byTown = JSON.parse(fs.readFileSync(byTownPath, 'utf8'))
  const towns = JSON.parse(fs.readFileSync(townsPath, 'utf8'))

  for (const { id, row } of inserted) {
    const sv = toStatic(row, id)
    if (venues.some((x) => x.townSlug === sv.townSlug && x.slug === sv.slug)) continue // idempotent re-runs
    venues.push(sv)
    if (!byTown[sv.townSlug]) byTown[sv.townSlug] = { town: sv.town, townSlug: sv.townSlug, venues: [] }
    byTown[sv.townSlug].venues.push(sv)
    byTown[sv.townSlug].venues.sort((a, b) => a.name.localeCompare(b.name))
    let t = towns.find((x) => x.slug === sv.townSlug)
    if (!t) { t = { name: sv.town, slug: sv.townSlug, venueCount: 0, avgRating: null }; towns.push(t) }
    t.venueCount += 1
  }
  towns.sort((a, b) => a.name.localeCompare(b.name))

  fs.writeFileSync(venuesPath, JSON.stringify(venues, null, 2) + '\n')
  fs.writeFileSync(byTownPath, JSON.stringify(byTown, null, 2) + '\n')
  fs.writeFileSync(townsPath, JSON.stringify(towns, null, 2))
  fs.writeFileSync(
    path.join(ROOT, 'scripts', 'output', 'venue-pack-2026-10-07-inserted.json'),
    JSON.stringify(inserted.map((i) => ({ id: i.id, slug: i.row.slug, city_slug: i.row.city_slug })), null, 2) + '\n'
  )
  console.log('Static JSON updated (venues.json, venuesByTown.json, towns.json).')
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1) })
