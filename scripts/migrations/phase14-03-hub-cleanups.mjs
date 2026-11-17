// Phase 14-03: per-hub listing clean-ups for the city-hub SEO work (Nottingham, Birmingham,
// Liverpool, Blackpool, Bristol, London). Decisions live in phase14-03-data.json, one block per
// hub, each checked against Google Places (type + business status + address) in Nov 2026:
//
//   retire      is_active = false; the URL 301s to the hub (closed, hire firms, not a venue)
//   reclassify  venue_type change (a leisure centre or attraction leaves the soft play count)
//   postcodes   fill an empty postcode from the venue's Google Places address
//
//   node scripts/migrations/phase14-03-hub-cleanups.mjs --hub=nottingham                # dry run
//   node scripts/migrations/phase14-03-hub-cleanups.mjs --hub=nottingham --write-files  # redirects
//   node scripts/migrations/phase14-03-hub-cleanups.mjs --hub=nottingham --execute      # DB, backup first
//
// Deploy the redirects (--write-files, committed) BEFORE --execute, so a retired URL never 404s.
// Every row is matched by id AND slug AND city_slug; one that no longer matches is skipped.
// After --execute: `npm run data:rebuild`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool, EXECUTE } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DATA = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'phase14-03-data.json'), 'utf8'))
const hub = process.argv.find((a) => a.startsWith('--hub='))?.slice(6)
if (!hub || !DATA[hub]) throw new Error(`--hub=<${Object.keys(DATA).join('|')}> required`)
const { retire = [], reclassify = [], postcodes = [] } = DATA[hub]
const WRITE_FILES = process.argv.includes('--write-files')

export function redirectsFor(h) {
  return (DATA[h].retire ?? []).map((r) => ({ source: `/soft-play/${h}/${r.slug}`, destination: `/soft-play/${h}`, permanent: true }))
}

if (WRITE_FILES) {
  const file = path.join(ROOT, 'data/redirects.json')
  const list = JSON.parse(fs.readFileSync(file, 'utf8'))
  const have = new Set(list.map((r) => r.source))
  const add = redirectsFor(hub).filter((r) => !have.has(r.source))
  list.push(...add)
  // an older redirect that pointed at a now-retired URL goes straight to the hub (no chains)
  const retired = new Set(redirectsFor(hub).map((r) => r.source))
  let repointed = 0
  for (const r of list) if (retired.has(r.destination)) { r.destination = `/soft-play/${hub}`; repointed++ }
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n')
  console.log(`${hub}: ${add.length} redirects added, ${repointed} re-pointed`)
  process.exit(0)
}

const pool = await getPool()
const ids = [...retire, ...reclassify, ...postcodes].map((r) => r.id)
const { rows } = await pool.query('SELECT * FROM venues WHERE id = ANY($1)', [ids])
const byId = new Map(rows.map((r) => [r.id, r]))
const matches = (r) => {
  const row = byId.get(r.id)
  const ok = row && row.slug === r.slug && row.city_slug === hub
  if (!ok) console.log(`  SKIP #${r.id} ${r.slug}: no longer matches (id/slug/city)`)
  return ok
}
const plan = {
  retire: retire.filter(matches).filter((r) => byId.get(r.id).is_active),
  reclassify: reclassify.filter(matches).filter((r) => byId.get(r.id).venue_type !== r.to),
  postcodes: postcodes.filter(matches).filter((r) => !String(byId.get(r.id).postcode ?? '').trim()),
}
for (const r of plan.retire) console.log(`RETIRE      #${r.id} ${byId.get(r.id).name} — ${r.why}`)
for (const r of plan.reclassify) console.log(`RECLASSIFY  #${r.id} ${byId.get(r.id).name}: ${byId.get(r.id).venue_type} -> ${r.to} — ${r.why}`)
for (const r of plan.postcodes) console.log(`POSTCODE    #${r.id} ${byId.get(r.id).name} -> ${r.postcode}`)

if (!EXECUTE) {
  console.log(`\n${hub}: dry run, nothing written.`)
  await pool.end()
  process.exit(0)
}

const backupDir = path.join(ROOT, 'scripts/output/backups')
fs.mkdirSync(backupDir, { recursive: true })
const backup = path.join(backupDir, `phase14-03-${hub}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
fs.writeFileSync(backup, JSON.stringify({ rows }, null, 2))
console.log(`backup: ${path.relative(ROOT, backup)}`)
const client = await pool.connect()
try {
  await client.query('BEGIN')
  const by = `phase14-03-${hub}`
  for (const r of plan.retire) await client.query('UPDATE venues SET is_active = false, updated_at = NOW(), updated_by = $2 WHERE id = $1', [r.id, by])
  for (const r of plan.reclassify) await client.query('UPDATE venues SET venue_type = $2, updated_at = NOW(), updated_by = $3 WHERE id = $1', [r.id, r.to, by])
  for (const r of plan.postcodes) await client.query('UPDATE venues SET postcode = $2, updated_at = NOW(), updated_by = $3 WHERE id = $1', [r.id, r.postcode, by])
  await client.query('COMMIT')
  console.log('Committed. Now run: npm run data:rebuild')
} catch (e) {
  await client.query('ROLLBACK')
  throw e
} finally {
  client.release()
  await pool.end()
}
