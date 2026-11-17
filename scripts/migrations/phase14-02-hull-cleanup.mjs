// Phase 14-02: clean up the Hull hub's listings (checked against Google Places on 17 Nov 2026).
//
//   RETIRE (is_active = false, URL 301s to /soft-play/hull) — not a venue anyone visits:
//     5 bouncy castle / soft play hire companies, two children's party services (one now
//     permanently closed at its address), and a café with no play facilities listed.
//   RECLASSIFY (venue_type) — real places, but not soft play, so they move to the hub's
//     "other family activities" tab and out of the soft play count:
//     an amusement arcade, a go-karting centre, a community sports club.
//   POSTCODE — three venues with no postcode were counted as "in Hull" by default;
//     Google Places gives their addresses (one is in Hessle).
//
//   node scripts/migrations/phase14-02-hull-cleanup.mjs                # dry run
//   node scripts/migrations/phase14-02-hull-cleanup.mjs --write-files  # redirects (repo side)
//   node scripts/migrations/phase14-02-hull-cleanup.mjs --execute      # DB (backup first)
//
// Each row is matched by id AND slug AND city_slug; a row that no longer matches is skipped.
// After --execute: `npm run data:rebuild`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool, EXECUTE } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const WRITE_FILES = process.argv.includes('--write-files')
const HUB = 'hull'

export const RETIRE = [
  { id: 41, slug: 'airplay-bouncy-castles-hull', why: 'bouncy castle hire' },
  { id: 48, slug: 'bb-inflatables-hull', why: 'inflatable hire' },
  { id: 54, slug: 'bump-n-bounce-hull', why: 'inflatable hire' },
  { id: 60, slug: 'c-r-bouncy-castles-and-soft-play-hull', why: 'bouncy castle / soft play hire' },
  { id: 64, slug: 'fun4all-bouncy-castles-hull', why: 'bouncy castle hire' },
  { id: 50, slug: 'softplay-tots-hull', why: "children's party service, no address" },
  { id: 51, slug: 'the-curious-owl-hull', why: "children's party service; Google shows its address permanently closed" },
  { id: 82, slug: 'coffee-luxe-hull', why: 'café (Google: cafe), no play facilities listed' },
]
export const RECLASSIFY = [
  { id: 1174, slug: 'game-king-hull', to: 'family-attraction', why: 'amusement arcade on Withernsea pier' },
  { id: 58, slug: 'hull-adventure-hull', to: 'family-attraction', why: 'go-karting / adventure sports' },
  { id: 1170, slug: 'blackburn-leisure-sports-community-club-hull', to: 'leisure-centre', why: 'community sports club (Brough)' },
]
export const POSTCODES = [
  { id: 75, slug: 'all-saints-church-hall-hull', postcode: 'HU13 0RB' }, // 3 Southgate, Hessle
  { id: 83, slug: 'fuzzy-ed-s-hull', postcode: 'HU5 5JW' }, // 194 Willerby Rd
  { id: 66, slug: 'simsory-sensory-hull', postcode: 'HU7 3AZ' }, // Primrose Way
]
export const REDIRECTS = RETIRE.map((r) => ({ source: `/soft-play/${HUB}/${r.slug}`, destination: `/soft-play/${HUB}`, permanent: true }))

function writeRedirects() {
  const file = path.join(ROOT, 'data/redirects.json')
  const list = JSON.parse(fs.readFileSync(file, 'utf8'))
  const bySource = new Map(list.map((r) => [r.source, r]))
  let added = 0
  for (const r of REDIRECTS) if (!bySource.has(r.source)) { list.push(r); added++ }
  // an older redirect pointing at a retired URL now goes straight to the hub (no chains)
  const retired = new Set(REDIRECTS.map((r) => r.source))
  let repointed = 0
  for (const r of list) if (retired.has(r.destination)) { r.destination = `/soft-play/${HUB}`; repointed++ }
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n')
  console.log(`redirects: ${added} added, ${repointed} re-pointed`)
}

if (WRITE_FILES) {
  writeRedirects()
  process.exit(0)
}

const pool = await getPool()
const ids = [...RETIRE, ...RECLASSIFY, ...POSTCODES].map((r) => r.id)
const { rows } = await pool.query('SELECT * FROM venues WHERE id = ANY($1)', [ids])
const byId = new Map(rows.map((r) => [r.id, r]))
const ok = (r) => {
  const row = byId.get(r.id)
  const match = row && row.slug === r.slug && row.city_slug === HUB
  if (!match) console.log(`  SKIP #${r.id} ${r.slug}: no longer matches (id/slug/city)`)
  return match
}

const plan = {
  retire: RETIRE.filter(ok).filter((r) => byId.get(r.id).is_active),
  reclassify: RECLASSIFY.filter(ok).filter((r) => byId.get(r.id).venue_type !== r.to),
  postcode: POSTCODES.filter(ok).filter((r) => !byId.get(r.id).postcode),
}
for (const r of plan.retire) console.log(`RETIRE      #${r.id} ${byId.get(r.id).name} — ${r.why}`)
for (const r of plan.reclassify) console.log(`RECLASSIFY  #${r.id} ${byId.get(r.id).name}: ${byId.get(r.id).venue_type} -> ${r.to} — ${r.why}`)
for (const r of plan.postcode) console.log(`POSTCODE    #${r.id} ${byId.get(r.id).name}: -> ${r.postcode}`)

if (!EXECUTE) {
  console.log('\nDry run: nothing written. --write-files for redirects, --execute for the DB.')
  await pool.end()
  process.exit(0)
}

const backupDir = path.join(ROOT, 'scripts/output/backups')
fs.mkdirSync(backupDir, { recursive: true })
const backup = path.join(backupDir, `phase14-02-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
fs.writeFileSync(backup, JSON.stringify({ rows }, null, 2))
console.log(`backup: ${path.relative(ROOT, backup)}`)

const client = await pool.connect()
try {
  await client.query('BEGIN')
  for (const r of plan.retire) await client.query(`UPDATE venues SET is_active = false, updated_at = NOW(), updated_by = 'phase14-02' WHERE id = $1`, [r.id])
  for (const r of plan.reclassify) await client.query(`UPDATE venues SET venue_type = $2, updated_at = NOW(), updated_by = 'phase14-02' WHERE id = $1`, [r.id, r.to])
  for (const r of plan.postcode) await client.query(`UPDATE venues SET postcode = $2, updated_at = NOW(), updated_by = 'phase14-02' WHERE id = $1`, [r.id, r.postcode])
  await client.query('COMMIT')
  console.log('Committed. Now run: npm run data:rebuild')
} catch (e) {
  await client.query('ROLLBACK')
  throw e
} finally {
  client.release()
  await pool.end()
}
