// Phase 16-01: merge four duplicate active listings into one row each (25 Nov 2026).
//
//   node scripts/migrations/phase16-01-merge-duplicate-venues.mjs                 # dry run
//   node scripts/migrations/phase16-01-merge-duplicate-venues.mjs --write-files   # add the 301s to data/redirects.json
//   node scripts/migrations/phase16-01-merge-duplicate-venues.mjs --execute       # DB: fill survivor, retire duplicate
//   node scripts/migrations/phase16-01-merge-duplicate-venues.mjs --rollback=<backup.json>
//
// Order: --write-files, deploy, then --execute. Either order is safe (the survivor
// URLs already render), but deploying first means the duplicate URL 301s the moment
// its row goes inactive instead of 404ing in between.
//
// Survivor choice: the row an owner has claimed (and, for Tiny Tykes, the URL Google
// already ranks). The duplicate is often the older Google-Places row with the hours,
// rating and place id, so every field the survivor lacks is copied across from it:
// null / '' / [] / {} / false on the survivor counts as missing. Identity, billing,
// claim and bookkeeping columns are never copied. Each pair is checked by id AND name
// before anything is written, and the full before-rows are backed up.
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool, EXECUTE } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WRITE_FILES = process.argv.includes('--write-files')
const ROLLBACK = process.argv.find((a) => a.startsWith('--rollback='))?.split('=')[1]

// [survivor id, duplicate id, name both rows carry]
const PAIRS = [
  [1927, 99, 'Tiny Tykes Play'], // 1927: verified claim, and the URL with GSC impressions
  [1928, 115, 'Jigsaw Gyms'], // 1928: verified claim
  [1933, 1934, 'Sense of Play Ltd'], // 1933: owner's edits and owner data live here
  [1340, 1894, 'Tumbles Play Place'], // 1340: verified claim #11
]

const NEVER_COPY = new Set([
  'id', 'name', 'slug', 'city_slug', 'created_at', 'updated_at', 'is_active',
  'plan', 'plan_status', 'plan_started_at', 'plan_renews_at', 'stripe_customer_id', 'stripe_subscription_id',
  'billing_interval', 'featured', 'featured_until', 'ad_placements', 'lead_notification_email',
  'claimed_by_owner', 'owner_submitted', 'owner_completeness', 'notified_at', 'last_slipping_reminder_at',
  'needs_review', 'dedupe_key', 'completeness_score', 'seo_title', 'meta_description', 'notes',
  // the survivor's own address/postcode/town are what its owner confirmed
  'address', 'postcode', 'city', 'town', 'county',
  // scrape-time snapshots ("Closed" = shut at the moment of the scrape), never read by the site
  'status', 'open_now',
])

const isEmpty = (v) =>
  v === null || v === undefined || v === '' || v === false ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && Object.keys(v).length === 0)

// Obvious typos in a copied value ("http:/www." on the Tumbles row).
const clean = (col, v) => (col === 'website' && typeof v === 'string' ? v.replace(/^(https?):\/(?!\/)/, '$1://') : v)
const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const url = (v) => `/soft-play/${v.city_slug}/${v.slug}`

const pool = await getPool()
const client = await pool.connect()
try {
  if (ROLLBACK) {
    const backup = JSON.parse(readFileSync(ROLLBACK, 'utf8'))
    await client.query('BEGIN')
    for (const row of backup.rows) {
      const cols = Object.keys(row).filter((c) => c !== 'id')
      await client.query(
        `UPDATE venues SET ${cols.map((c, i) => `"${c}" = $${i + 2}`).join(', ')} WHERE id = $1`,
        [row.id, ...cols.map((c) => (row[c] !== null && typeof row[c] === 'object' && !(row[c] instanceof Date) ? JSON.stringify(row[c]) : row[c]))],
      )
    }
    await client.query('COMMIT')
    console.log(`Restored ${backup.rows.length} rows from ${ROLLBACK}`)
    process.exit(0)
  }

  const ids = PAIRS.flatMap(([s, d]) => [s, d])
  const { rows } = await client.query('SELECT * FROM venues WHERE id = ANY($1)', [ids])
  const byId = new Map(rows.map((r) => [r.id, r]))
  const { rows: colInfo } = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'venues'`)
  const jsonCols = new Set(colInfo.filter((c) => c.data_type === 'jsonb' || c.data_type === 'json').map((c) => c.column_name))

  const plan = []
  for (const [sid, did, name] of PAIRS) {
    const s = byId.get(sid), d = byId.get(did)
    if (!s || !d) throw new Error(`pair ${sid}/${did}: row missing`)
    if (norm(s.name) !== norm(name) || norm(d.name) !== norm(name)) throw new Error(`pair ${sid}/${did}: names changed (${s.name} / ${d.name})`)
    if (!d.is_active) { console.log(`skip ${name}: ${did} already inactive`); continue }
    if (!s.is_active) throw new Error(`survivor ${sid} is inactive`)
    const fill = {}
    for (const col of Object.keys(d)) {
      if (NEVER_COPY.has(col) || isEmpty(d[col]) || !isEmpty(s[col])) continue
      fill[col] = clean(col, d[col])
    }
    if (!isEmpty(s.website) && /^https?:\/(?!\/)/.test(s.website)) fill.website = clean('website', s.website)
    plan.push({ s, d, fill, score: Math.max(s.completeness_score ?? 0, d.completeness_score ?? 0) })
    console.log(`\n${name}: keep ${sid} ${url(s)}  <-  retire ${did} ${url(d)}`)
    for (const [k, v] of Object.entries(fill)) console.log(`   fill ${k} = ${JSON.stringify(v).slice(0, 90)}`)
    console.log(`   completeness_score ${s.completeness_score} -> ${Math.max(s.completeness_score ?? 0, d.completeness_score ?? 0)}`)
  }

  if (WRITE_FILES) {
    const file = path.join(ROOT, 'data/redirects.json')
    const list = JSON.parse(readFileSync(file, 'utf8'))
    const have = new Set(list.map((e) => e.source))
    const add = PAIRS.map(([sid, did]) => ({ source: url(byId.get(did)), destination: url(byId.get(sid)), permanent: true })).filter((e) => !have.has(e.source))
    writeFileSync(file, JSON.stringify([...list, ...add], null, 2) + '\n')
    console.log(`\ndata/redirects.json: +${add.length} redirects`)
  }

  if (!EXECUTE) {
    console.log('\nDry run. Pass --execute to write to the DB.')
    process.exit(0)
  }

  const dir = path.join(ROOT, 'scripts/output/backups')
  mkdirSync(dir, { recursive: true })
  const backupFile = path.join(dir, `phase16-01-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(backupFile, JSON.stringify({ rows: plan.flatMap((p) => [p.s, p.d]) }, null, 2))
  console.log(`\nBackup: ${backupFile}`)

  await client.query('BEGIN')
  for (const { s, d, fill, score } of plan) {
    const cols = Object.keys(fill)
    const vals = cols.map((c) => (jsonCols.has(c) ? JSON.stringify(fill[c]) : fill[c]))
    await client.query(
      `UPDATE venues SET ${[...cols.map((c, i) => `"${c}" = $${i + 2}`), `completeness_score = $${cols.length + 2}`, 'updated_at = NOW()'].join(', ')} WHERE id = $1 AND is_active = true`,
      [s.id, ...vals, score],
    )
    const r = await client.query(
      `UPDATE venues SET is_active = false, updated_at = NOW(),
         notes = concat_ws(E'\\n', NULLIF(notes, ''), $2::text)
       WHERE id = $1 AND is_active = true`,
      [d.id, `Merged into venue ${s.id} (${url(s)}) on 25 Nov 2026, phase16-01: duplicate listing.`],
    )
    if (r.rowCount !== 1) throw new Error(`retire ${d.id}: ${r.rowCount} rows`)
  }
  await client.query('COMMIT')
  console.log(`Merged ${plan.length} pairs.`)
} catch (e) {
  await client.query('ROLLBACK').catch(() => {})
  throw e
} finally {
  client.release()
  await pool.end()
}
