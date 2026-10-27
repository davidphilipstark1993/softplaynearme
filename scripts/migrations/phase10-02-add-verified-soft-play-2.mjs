// Phase 10-02: second batch from the Grok research lists. Each venue's own page was read on 2026-10-27 and the facts below
// (prices, ages, parties, sessions) are only what that page states; address/phone/coordinates/rating come from Google Places.
// Role-play venues are typed family-attraction. Venues whose soft play is part of a leisure centre have no hours or rating stored.
//   node scripts/migrations/phase10-02-add-verified-soft-play-2.mjs [--execute] | --rollback=<file> [--execute]
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from './_lib.mjs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(DIR, '../..')
const EXECUTE = process.argv.includes('--execute')
const rb = process.argv.find((a) => a.startsWith('--rollback='))?.slice(11)
const VERIFIED = '2026-10-27'
const DATA = JSON.parse(fs.readFileSync(path.join(DIR, 'phase10-02-data.json'), 'utf8'))
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function to24(t) {
  const m = t.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)?$/i)
  if (!m) return null
  let h = Number(m[1]); const mi = m[2] ?? '00'
  if (m[3]) { const pm = m[3].toUpperCase() === 'PM'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0 }
  return `${String(h).padStart(2, '0')}:${mi}`
}
function parseHours(lines) {
  if (!lines) return { json: null, text: null }
  const obj = {}
  for (const l of lines) {
    const m = l.replace(/ | /g, ' ').match(/^(\w+):\s*(.+)$/)
    if (!m) continue
    const d = m[1].toLowerCase()
    if (/closed/i.test(m[2])) continue
    const parts = m[2].split(/\s*[–-]\s*/)
    if (parts.length !== 2) return { json: null, text: lines.join('; ') } // split shifts etc: keep text only
    const o = to24(parts[0].replace(/\s*(AM|PM)$/i, (x) => x)), c = to24(parts[1])
    if (!o || !c) return { json: null, text: lines.join('; ') }
    obj[d] = { open: o, close: c }
  }
  return { json: Object.keys(obj).length ? obj : null, text: lines.join('; ').replace(/ | /g, ' ') }
}
const cleanAddr = (a) => a.replace(/,\s*(UK|United Kingdom)$/i, '')
const hoursOf = (v) => (v.hours_override ? { json: v.hours_override.json, text: v.hours_override.text } : parseHours(v.gh))

function describeOld(v) {
  const bits = []
  if (v.flags.cafe) bits.push('a café')
  if (v.flags.parties) bits.push('birthday parties')
  if (v.flags.toddler_area) bits.push('a toddler area')
  const feat = bits.length ? ` Its website mentions ${bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits.at(-1) : bits[0]}.` : ''
  const rating = v.rating ? ` It is rated ${v.rating} out of 5 from ${v.n} Google reviews.` : ''
  return `${v.name} is a soft play venue at ${cleanAddr(v.addr)}.${feat}${rating} Prices, ages and session times are on the venue’s own website; check them before you visit. Details checked against Google and the venue’s website on 27 October 2026.`
}
function completeness(v, hours) {
  let s = 20
  if (v.phone) s += 10
  if (v.website) s += 10
  s += 15 // description
  if (hours.text) s += 10
  if (Object.values(v.flags).some(Boolean)) s += 10
  if (v.email) s += 5
  return Math.min(s + 5, 100)
}

const pool = await getPool()
const c = await pool.connect()
try {
  if (rb) {
    const b = JSON.parse(fs.readFileSync(path.resolve(rb), 'utf8'))
    console.log(`${EXECUTE ? 'Deleting' : 'DRY RUN: would delete'} ${b.ids.length} rows`)
    if (EXECUTE) await c.query('DELETE FROM venues WHERE id = ANY($1::int[]) AND slug = ANY($2::text[])', [b.ids, b.slugs])
  } else {
    console.log(EXECUTE ? 'EXECUTE\n' : 'DRY RUN: nothing will be written.\n')
    const todo = []
    for (const v of DATA) {
      const clash = await c.query('SELECT id,slug,city_slug,is_active FROM venues WHERE (slug=$1 AND city_slug=$2) OR (google_place_id=$3) OR (lower(name)=lower($4) AND postcode=$5)', [v.slug, v.city_slug, v.pid, v.name, v.postcode])
      const h = hoursOf(v)
      console.log(`${clash.rows.length ? 'SKIP  ' : 'INSERT'} ${v.city_slug}/${v.slug} "${v.name}" [${cleanAddr(v.addr)}] phone=${v.phone ?? '-'} email=${v.email ?? '-'} hours=${h.json ? Object.keys(h.json).length + 'd' : h.text ? 'text' : '-'} flags=${Object.entries(v.flags).filter(([, x]) => x).map(([k]) => k).join(',') || '-'}`)
      if (clash.rows.length) console.log('        blocked by', JSON.stringify(clash.rows))
      else todo.push(v)
    }
    if (EXECUTE && todo.length) {
      await c.query('BEGIN')
      const done = []
      try {
        for (const v of todo) {
          const h = hoursOf(v)
          const reg = (await c.query(`SELECT region, country FROM venues WHERE city_slug=$1 AND region IS NOT NULL GROUP BY 1,2 ORDER BY count(*) DESC LIMIT 1`, [v.city_slug])).rows[0] ?? {}
          const f = v.flags
          const county = (await c.query(`SELECT county FROM venues WHERE city_slug=$1 AND county IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`, [v.city_slug])).rows[0]?.county ?? null
          const fa = v.venue_type === 'family-attraction'
          const { rows } = await c.query(
            `INSERT INTO venues (name, slug, city_slug, city, county, region, country, address, postcode, lat, lng, phone, email, contact_email, website,
               description, opening_hours, opening_hours_text, category, venue_type, indoor_or_outdoor, cafe, parties, party_rooms, has_party_rooms, toddler_area, baby_area,
               sen_friendly, sensory_area, multi_level_play, has_multi_level_play, role_play, has_role_play, parking, free_parking,
               age_range_min, age_range_max, pricing_hint, price_from, party_info, rating, reviews_count, google_place_id, place_id, facilities, tags, source_urls, dedupe_key,
               completeness_score, last_verified_at, needs_review, is_active, plan, plan_status, enrichment_notes, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14,$15,$16::jsonb,$17,$18,$19,'indoor',$20,$21,$22,$22,$23,$24,
               $25,$26,$27,$27,$28,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$38,$39::jsonb,$40::text[],$41::jsonb,$42,$43,$44,false,true,'free','inactive',$45,'phase10-02') RETURNING id`,
            [v.name, v.slug, v.city_slug, v.town, county, reg.region ?? null, reg.country ?? 'United Kingdom', cleanAddr(v.addr), v.postcode, v.lat, v.lng, v.phone, v.email, v.website,
              v.description, h.json ? JSON.stringify(h.json) : null, h.text, fa ? 'Family attraction' : 'Indoor Soft Play', v.venue_type, f.cafe || null, f.parties || null, f.party_rooms || null, f.toddler_area || null, f.baby_area || null,
              f.sen_friendly || null, f.sensory_area || null, f.multi_level_play || null, f.role_play || null, f.parking || null, f.free_parking || null,
              v.age_min, v.age_max, v.pricing_hint, v.price_from, v.party_info, v.rating, v.n, v.pid, JSON.stringify(f), fa ? ['family-attraction', 'indoor-play'] : ['soft-play', 'indoor-play'], JSON.stringify([...v.sources, `https://www.google.com/maps/place/?q=place_id:${v.pid}`]),
              `${v.name}|${cleanAddr(v.addr)}|${v.town}`.toLowerCase(), completeness(v, h), VERIFIED,
              `Added ${VERIFIED}: venue's own page read; confirmed OPERATIONAL on Google Places; see source_urls.`]
          )
          done.push({ id: rows[0].id, slug: v.slug })
        }
        const file = path.join(ROOT, `scripts/output/backups/phase10-02-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
        fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), ids: done.map((x) => x.id), slugs: done.map((x) => x.slug) }, null, 1))
        await c.query('COMMIT')
        console.log(`\nInserted ${done.length}. Undo file: ${path.relative(ROOT, file)}`)
      } catch (e) { await c.query('ROLLBACK'); throw e }
    } else console.log(`\nDry run: ${todo.length} would be inserted.`)
  }
} finally { c.release(); await pool.end() }
