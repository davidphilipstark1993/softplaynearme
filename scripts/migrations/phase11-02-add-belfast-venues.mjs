// Phase 11-02: add the Belfast-area venues found by scripts/discover-google-places-venues.mjs --city=belfast.
//
// Only fields Google Places returned are stored (name, address, postcode, coordinates, rating, review count,
// place id, status OPERATIONAL on 2026-11-03). Nothing else is claimed: no hours, prices, facilities or website.
// Venues with 0-1 Google reviews (Altan Drive, Avoniel Play Centre, Rosstulla) and Bangor/Craigavon are not added.
// TODO(David): add website, hours and facilities for these from each venue's own site, then drop needs_review.
//
//   node scripts/migrations/phase11-02-add-belfast-venues.mjs             # dry run
//   node scripts/migrations/phase11-02-add-belfast-venues.mjs --execute    # insert (writes an undo file)
//   node scripts/migrations/phase11-02-add-belfast-venues.mjs --rollback=<file> [--execute]
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool, EXECUTE } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const rb = process.argv.find((a) => a.startsWith('--rollback='))?.slice(11)
const CHECKED = '2026-11-03'

const VENUES = [
  { name: 'Airtastic Entertainment Centre Belfast', slug: 'airtastic-entertainment-centre', city: 'Newtownabbey', address: '38 Mill Rd, Belfast, Newtownabbey BT36 7BE', postcode: 'BT36 7BE',
    lat: 54.6520365, lng: -5.9217834, rating: 4.3, reviews: 1265, place: 'ChIJp9YOaVanYUgR0ta1BL7y7-s', type: 'indoor', cafe: null },
  { name: 'Happy Littles Play Cafe', slug: 'happy-littles-play-cafe', city: 'Newtownabbey', address: 'Unit 3, Building, 10 Central Park, Mallusk, Newtownabbey BT36 4FS', postcode: 'BT36 4FS',
    lat: 54.6746762, lng: -5.986663, rating: 4.8, reviews: 173, place: 'ChIJD1HnL-anYUgRisu_Tw1bJMg', type: 'indoor', cafe: true },
]

const pool = await getPool()
try {
  if (rb) {
    const ids = JSON.parse(fs.readFileSync(rb, 'utf8')).insertedIds
    console.log(`${EXECUTE ? 'ROLLBACK' : 'DRY RUN rollback'}: delete ${ids.length} venues`)
    if (EXECUTE) await pool.query('DELETE FROM venues WHERE id = ANY($1) AND city_slug=$2', [ids, 'belfast'])
    process.exit(0)
  }
  const ids = []
  for (const v of VENUES) {
    const dupe = await pool.query('SELECT id FROM venues WHERE google_place_id=$1 OR (city_slug=$2 AND slug=$3)', [v.place, 'belfast', v.slug])
    if (dupe.rows.length) { console.log(`skip ${v.name}: already present (id ${dupe.rows[0].id})`); continue }
    const description = `${v.name} is a soft play and family entertainment venue at ${v.address}, in the Belfast area. It is rated ${v.rating} from ${v.reviews.toLocaleString('en-GB')} Google reviews (checked ${CHECKED}). We have not yet verified its opening times, prices or facilities, so check with the venue before you go.`
    console.log(`${EXECUTE ? 'insert' : 'would insert'} /soft-play/belfast/${v.slug}  (${v.rating}★, ${v.reviews} reviews)`)
    if (!EXECUTE) continue
    const { rows } = await pool.query(
      `INSERT INTO venues (name, slug, city_slug, city, county, region, country, address, postcode, lat, lng, description, meta_description, category, venue_type, indoor_or_outdoor,
         cafe, rating, reviews_count, google_place_id, place_id, tags, last_verified_at, needs_review, is_active, plan, plan_status, enrichment_notes, updated_by)
       VALUES ($1,$2,'belfast',$3,'Antrim','Northern Ireland','United Kingdom',$4,$5,$6,$7,$8,$9,'Indoor playground',$10,'indoor',$11,$12,$13,$14,$14,$15::text[],$16,true,true,'free','inactive',$17,'phase11-02') RETURNING id`,
      [v.name, v.slug, v.city, v.address, v.postcode, v.lat, v.lng, description,
        `${v.name} in the Belfast area: rated ${v.rating} from ${v.reviews.toLocaleString('en-GB')} Google reviews. Address and contact details.`.slice(0, 155),
        v.type, v.cafe, v.rating, v.reviews, v.place, ['soft-play', 'indoor-play', 'belfast'], CHECKED,
        `Added ${CHECKED} from Google Places only (existence, address, rating). Needs website, hours and facilities from the venue's own site.`])
    ids.push(rows[0].id)
  }
  if (EXECUTE && ids.length) {
    const file = path.join(ROOT, `scripts/output/backups/phase11-02-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ insertedIds: ids }, null, 1))
    console.log(`APPLIED ${ids.length}. Undo: --rollback=${path.relative(ROOT, file)} --execute`)
  } else if (!EXECUTE) console.log('DRY RUN: nothing written. Re-run with --execute.')
} finally { await pool.end() }
