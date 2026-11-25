// Phase 17-01: fill missing postcodes from each venue's own Google listing (25 Nov 2026).
//
//   node scripts/migrations/phase17-01-fill-postcodes.mjs             # dry run: fetch + check, print
//   node scripts/migrations/phase17-01-fill-postcodes.mjs --execute   # write, with backup
//   node scripts/migrations/phase17-01-fill-postcodes.mjs --rollback=<backup.json>
//
// Why: ~350 indexable venues had no postcode, so their pages, schema (postalCode), hub
// guides and the nearby-towns split could not say where they are.
//
// Source: Google Places API (New) Place Details for the venue's stored place id, field mask
// addressComponents only (Essentials tier). The postcode is the venue's own listing's
// postal_code — not a guess from coordinates. A row is only written if ALL hold:
//   - Google returns a full UK postcode (outward + inward, e.g. "NE12 9SZ");
//   - postcodes.io knows that postcode;
//   - its centroid is within MAX_KM of the venue's stored lat/lng (guards against a wrong
//     place id, which has happened before), or the venue has no coordinates and the
//     postcode's district matches the venue's hub area (not used: such rows are skipped).
// Only the empty postcode column is written; nothing else changes. Results are cached in
// scripts/output/backups/ (gitignored) so a re-run does not re-bill the API.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool, EXECUTE } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'scripts/output/backups')
const CACHE = path.join(OUT, 'phase17-01-places-cache.json')
const ROLLBACK = process.argv.find((a) => a.startsWith('--rollback='))?.split('=')[1]
const MAX_KM = 3
const KEY = process.env.GOOGLE_PLACES_API_KEY ?? readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^GOOGLE_PLACES_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '')
const FULL_PC = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i

mkdirSync(OUT, { recursive: true })
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}
const km = (a, b, c, d) => {
  const r = (x) => (x * Math.PI) / 180
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

const pool = await getPool()
const client = await pool.connect()
try {
  if (ROLLBACK) {
    const { rows } = JSON.parse(readFileSync(ROLLBACK, 'utf8'))
    await client.query('BEGIN')
    for (const r of rows) await client.query('UPDATE venues SET postcode = $2 WHERE id = $1', [r.id, r.postcode])
    await client.query('COMMIT')
    console.log(`Restored postcode on ${rows.length} rows`)
    process.exit(0)
  }

  const { rows } = await client.query(`
    SELECT id, name, city_slug, slug, lat, lng, postcode, COALESCE(google_place_id, place_id) AS pid
    FROM venues WHERE is_active AND (postcode IS NULL OR postcode = '') AND COALESCE(google_place_id, place_id) IS NOT NULL
    ORDER BY id`)
  console.log(`${rows.length} active venues without a postcode but with a place id`)

  // 1. Google (cached)
  let fetched = 0
  for (const v of rows) {
    if (cache[v.pid]) continue
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(v.pid)}`, {
      headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'addressComponents' },
    })
    const j = await res.json()
    cache[v.pid] = res.ok ? { postcode: j.addressComponents?.find((c) => c.types?.includes('postal_code'))?.longText ?? null } : { error: j.error?.status ?? res.status }
    fetched++
    if (fetched % 50 === 0) writeFileSync(CACHE, JSON.stringify(cache))
  }
  writeFileSync(CACHE, JSON.stringify(cache))
  console.log(`fetched ${fetched} from Google (rest cached)`)

  // 2. postcodes.io (bulk, 100 per call)
  const candidates = rows.map((v) => ({ v, pc: cache[v.pid]?.postcode?.toUpperCase().replace(/\s+/g, ' ').trim() ?? null }))
  const full = [...new Set(candidates.map((c) => c.pc).filter((pc) => pc && FULL_PC.test(pc)))]
  const geo = new Map()
  for (let i = 0; i < full.length; i += 100) {
    const r = await fetch('https://api.postcodes.io/postcodes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postcodes: full.slice(i, i + 100) }) })
    for (const x of (await r.json()).result ?? []) if (x.result) geo.set(x.query.toUpperCase(), x.result)
  }

  // 3. checks
  const ok = [], skipped = {}
  const skip = (why, c) => { (skipped[why] ??= []).push(`${c.v.id} ${c.v.name} ${c.pc ?? ''}`) }
  for (const c of candidates) {
    if (cache[c.v.pid]?.error) { skip(`google error ${cache[c.v.pid].error}`, c); continue }
    if (!c.pc) { skip('no postcode on Google listing', c); continue }
    if (!FULL_PC.test(c.pc)) { skip('partial postcode', c); continue }
    const g = geo.get(c.pc)
    if (!g) { skip('unknown to postcodes.io (terminated?)', c); continue }
    if (!(Number(c.v.lat) && Number(c.v.lng))) { skip('no coordinates to cross-check', c); continue }
    const d = km(Number(c.v.lat), Number(c.v.lng), g.latitude, g.longitude)
    if (d > MAX_KM) { skip(`> ${MAX_KM} km from venue`, { ...c, pc: `${c.pc} (${d.toFixed(1)} km)` }); continue }
    ok.push({ id: c.v.id, name: c.v.name, url: `/soft-play/${c.v.city_slug}/${c.v.slug}`, postcode: g.postcode, km: d.toFixed(2), district: g.admin_district })
  }
  console.log(`\nwill write ${ok.length} postcodes`)
  for (const o of ok.slice(0, 15)) console.log(`  ${o.id} ${o.name} -> ${o.postcode} (${o.km} km, ${o.district})`)
  for (const [why, list] of Object.entries(skipped)) console.log(`skipped ${list.length}: ${why}${list.length <= 8 ? '\n    ' + list.join('\n    ') : ''}`)
  writeFileSync(path.join(OUT, 'phase17-01-plan.json'), JSON.stringify({ ok, skipped }, null, 1))

  if (!EXECUTE) { console.log('\nDry run. Pass --execute to write.'); process.exit(0) }
  const backup = path.join(OUT, `phase17-01-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(backup, JSON.stringify({ rows: ok.map((o) => ({ id: o.id, postcode: null })) }, null, 1))
  await client.query('BEGIN')
  let n = 0
  for (const o of ok) n += (await client.query(`UPDATE venues SET postcode = $2, updated_at = NOW() WHERE id = $1 AND (postcode IS NULL OR postcode = '')`, [o.id, o.postcode])).rowCount
  await client.query('COMMIT')
  console.log(`\nWrote ${n} postcodes. Backup: ${backup}`)
} catch (e) {
  await client.query('ROLLBACK').catch(() => {})
  throw e
} finally {
  client.release()
  await pool.end()
}
