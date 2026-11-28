#!/usr/bin/env node
/**
 * phase18-01: fill missing street addresses from Google Places.
 *
 * Scope: active venues with an empty `address`, excluding the noindex
 * non-venue types (park-playground, mobile-hire, retail).
 *
 * An address is written only when ALL of these hold:
 *   - Google's result has a street (a `route` component). Service-area businesses
 *     often show only a town; that is not an address, so it's skipped.
 *   - Google's postcode equals the postcode we already hold (spaces and case ignored).
 *   - The place isn't CLOSED_PERMANENTLY (reported for review, not written).
 *   - Venues with no google_place_id are looked up by "name postcode" (Find Place),
 *     and the result's name must share a significant word with ours.
 * The stored address is the street part of Google's formatted_address, minus the
 * "Town POSTCODE, UK" tail, so it matches the existing format ("Unit 3, Foo Rd").
 *
 * Two steps, so what's written is exactly what was reviewed:
 *   node scripts/migrations/phase18-01-address-fill.mjs            # calls Places, writes the plan
 *   node scripts/migrations/phase18-01-address-fill.mjs --execute  # applies the plan, with a backup
 *
 * Needs DATABASE_URL and GOOGLE_PLACES_API_KEY (read from .env.local if not set).
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'

const TAG = 'phase18-01-address-fill'
const EXECUTE = process.argv.includes('--execute')
const OUT_DIR = 'scripts/output/backups' // gitignored
const PLAN = path.join(OUT_DIR, `${TAG}-plan.json`)
const TODAY = new Date().toISOString().slice(0, 10)

if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const i = line.indexOf('=')
    if (i > 0 && !process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, '')
  }
}
const KEY = process.env.GOOGLE_PLACES_API_KEY
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()

// Held for a human look, not written: names suggest a mobile/hire business and the
// Google address reads like a private house, which we shouldn't publish on a guess.
const HOLD = new Map([
  [267, 'Little Stars Soft Play Limited: hire company? 12 Morland Ave looks residential'],
  [428, 'Little play barn: 79 Thornbridge Ave looks residential'],
  [507, 'SoftPlay Toys4kids Ltd: equipment supplier/hire?'],
  [569, 'Awesome Softplays: hire company at a farm address?'],
  [574, 'Pop and Play by Holly: hire/pop-up business?'],
  [590, 'Soft Play Parties: hire company, 9 Ferndown Cl looks residential'],
  [939, 'Soft Play Party Hire: hire company, 5 David\'s Ln looks residential'],
])
// Google's own text is garbled for a few; the street facts are the same.
const FIX = new Map([[1367, 'Funtastics Playcentre, Kenyon St, Radcliffe']])

const normPc = (s) => (s || '').replace(/\s+/g, '').toUpperCase()
const STOP = new Set(['soft', 'play', 'softplay', 'centre', 'center', 'the', 'and', 'kids', 'childrens', 'children', 'ltd', 'limited', 'cafe', 'café', 'area', 'zone', 'indoor', 'of', 'at', 'for'])
const words = (s) => new Set((s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))
const sharesWord = (a, b) => { const B = words(b); return [...words(a)].some((w) => B.has(w)) }

/** "Unit 3, Foo Park, Bar Rd, Derby DE6 3GB, UK" → "Unit 3, Foo Park, Bar Rd" */
function streetPart(formatted, postcode) {
  const parts = formatted.split(',').map((p) => p.trim()).filter(Boolean)
  if (/^(UK|United Kingdom)$/i.test(parts.at(-1) || '')) parts.pop()
  const pc = normPc(postcode)
  while (parts.length && normPc(parts.at(-1)).includes(pc)) parts.pop()
  return parts.join(', ')
}

async function details(placeId) {
  const fields = 'name,formatted_address,address_components,business_status'
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&language=en&key=${KEY}`)
  const j = await r.json()
  return j.status === 'OK' ? j.result : { error: j.status }
}
async function findPlace(text) {
  const r = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(text)}&inputtype=textquery&fields=place_id,name&region=uk&key=${KEY}`)
  const j = await r.json()
  return j.status === 'OK' ? j.candidates : []
}

if (!EXECUTE) {
  if (!KEY) throw new Error('GOOGLE_PLACES_API_KEY missing')
  const { rows } = await db.query(
    `SELECT id, name, city_slug, slug, postcode, google_place_id, venue_type FROM venues
      WHERE is_active = true AND (address IS NULL OR btrim(address) = '')
        AND COALESCE(venue_type, 'indoor') NOT IN ('park-playground', 'mobile-hire', 'retail')
      ORDER BY id`,
  )
  const plan = []
  const skipped = []
  for (const v of rows) {
    let placeId = v.google_place_id
    let via = 'place_id'
    if (!placeId) {
      if (!v.postcode) { skipped.push({ ...v, reason: 'no place_id and no postcode' }); continue }
      const cands = await findPlace(`${v.name} ${v.postcode}`)
      const c = cands.find((x) => sharesWord(v.name, x.name))
      if (!c) { skipped.push({ ...v, reason: `no name match (${cands.map((x) => x.name).join(' | ') || 'no results'})` }); continue }
      placeId = c.place_id
      via = 'find_place'
    }
    const d = await details(placeId)
    if (d.error) { skipped.push({ ...v, reason: `details ${d.error}` }); continue }
    const comp = (t) => d.address_components?.find((c) => c.types.includes(t))?.long_name
    const gPc = comp('postal_code')
    const row = { id: v.id, name: v.name, url: `/soft-play/${v.city_slug}/${v.slug}`, our_postcode: v.postcode, google_name: d.name, google_postcode: gPc, formatted: d.formatted_address, business_status: d.business_status, via, place_id: placeId }
    if (d.business_status === 'CLOSED_PERMANENTLY') { skipped.push({ ...row, reason: 'Google says permanently closed' }); continue }
    if (!comp('route')) { skipped.push({ ...row, reason: 'no street in Google result (service-area or town only)' }); continue }
    if (!gPc || normPc(gPc) !== normPc(v.postcode)) { skipped.push({ ...row, reason: `postcode mismatch (ours ${v.postcode}, Google ${gPc ?? 'none'})` }); continue }
    if (HOLD.has(v.id)) { skipped.push({ ...row, reason: `held for review: ${HOLD.get(v.id)}` }); continue }
    const address = FIX.get(v.id) ?? streetPart(d.formatted_address, gPc)
    if (!address) { skipped.push({ ...row, reason: 'empty street part' }); continue }
    plan.push({ ...row, address, set_place_id: !v.google_place_id })
    await new Promise((r) => setTimeout(r, 120))
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(PLAN, JSON.stringify({ created: new Date().toISOString(), plan, skipped }, null, 2))
  console.log(`candidates ${rows.length} | will fill ${plan.length} | skipped ${skipped.length}`)
  const why = {}
  for (const s of skipped) { const k = s.reason.replace(/\(.*\)/, '').trim(); why[k] = (why[k] || 0) + 1 }
  console.log('skip reasons', why)
  console.log(`plan written to ${PLAN}; review, then re-run with --execute`)
} else {
  const { plan } = JSON.parse(fs.readFileSync(PLAN, 'utf8'))
  const ids = plan.map((p) => p.id)
  const { rows: before } = await db.query('SELECT id, address, google_place_id, source_urls, enrichment_notes, updated_by FROM venues WHERE id = ANY($1)', [ids])
  const backup = path.join(OUT_DIR, `${TAG}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(backup, JSON.stringify(before, null, 2))
  console.log(`backup ${backup} (${before.length} rows)`)
  await db.query('BEGIN')
  let n = 0
  try {
    for (const p of plan) {
      const src = `https://www.google.com/maps/place/?q=place_id:${p.place_id}`
      const res = await db.query(
        `UPDATE venues SET
            address = $2,
            google_place_id = CASE WHEN $3::boolean THEN $4::text ELSE google_place_id END,
            source_urls = CASE WHEN COALESCE(source_urls, '[]'::jsonb) @> jsonb_build_array($5::text) THEN source_urls
                               ELSE COALESCE(source_urls, '[]'::jsonb) || jsonb_build_array($5::text) END,
            enrichment_notes = concat_ws(E'\\n', NULLIF(enrichment_notes, ''), $6::text),
            updated_by = $7,
            updated_at = NOW()
          WHERE id = $1 AND (address IS NULL OR btrim(address) = '')`,
        [p.id, p.address, p.set_place_id, p.place_id, src, `${TODAY}: street address from Google Places (postcode matched ${p.google_postcode}).`, TAG],
      )
      n += res.rowCount
    }
    await db.query('COMMIT')
  } catch (e) {
    await db.query('ROLLBACK')
    throw e
  }
  console.log(`updated ${n} of ${plan.length}`)
}
await db.end()
