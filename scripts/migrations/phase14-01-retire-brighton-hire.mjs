// Phase 14-01: retire 3-2-1 Fun Softplay & Inflatable hire (id 1612) from the Brighton hub.
//
// It is an equipment hire company (venue_type mobile-hire), not a venue anyone visits, so it
// should not have a listing page. is_active = false, and its URL 301s to /soft-play/brighton.
// Same pattern as phase8-01 (RETIRE).
//
//   node scripts/migrations/phase14-01-retire-brighton-hire.mjs            # dry run
//   node scripts/migrations/phase14-01-retire-brighton-hire.mjs --execute  # write
//
// --execute writes a backup of the row first (scripts/output/backups/phase14-01-<time>.json),
// matches the row by id AND slug AND city_slug, and also removes it from the static export
// (data/generated/venues.json, venuesByTown.json). Undo: set is_active = true for id 1612 and
// remove the redirect.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool, appendRedirects, EXECUTE } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TARGET = { id: 1612, slug: '3-2-1-fun-softplay-inflatable-hire', city: 'brighton' }
const REDIRECT = { source: `/soft-play/${TARGET.city}/${TARGET.slug}`, destination: `/soft-play/${TARGET.city}`, permanent: true }

const pool = await getPool()
const { rows } = await pool.query('SELECT * FROM venues WHERE id = $1 AND slug = $2 AND city_slug = $3', [TARGET.id, TARGET.slug, TARGET.city])
if (rows.length !== 1) {
  console.log('Row no longer matches (id/slug/city); nothing to do.')
  await pool.end()
  process.exit(0)
}
const row = rows[0]
console.log(`${EXECUTE ? 'RETIRING' : 'Would retire'}: #${row.id} ${row.name} (${row.venue_type}, active=${row.is_active})`)
console.log(`  301 ${REDIRECT.source} -> ${REDIRECT.destination}`)

if (EXECUTE) {
  const backupDir = path.join(ROOT, 'scripts/output/backups')
  fs.mkdirSync(backupDir, { recursive: true })
  const backup = path.join(backupDir, `phase14-01-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(backup, JSON.stringify({ rows: [row] }, null, 2))
  console.log(`  backup: ${path.relative(ROOT, backup)}`)
  await pool.query('UPDATE venues SET is_active = false, updated_at = NOW(), updated_by = $2 WHERE id = $1', [TARGET.id, 'phase14-01'])
}
await pool.end()

appendRedirects([REDIRECT])

// Static export: drop the entry so a DB-less build doesn't list it either.
const vFile = path.join(ROOT, 'data/generated/venues.json')
const bFile = path.join(ROOT, 'data/generated/venuesByTown.json')
const venues = JSON.parse(fs.readFileSync(vFile, 'utf8'))
const byTown = JSON.parse(fs.readFileSync(bFile, 'utf8'))
const keep = (v) => !(v.slug === TARGET.slug && v.townSlug === TARGET.city)
const removed = venues.length - venues.filter(keep).length
console.log(`  static export: ${removed} entr${removed === 1 ? 'y' : 'ies'} ${EXECUTE ? 'removed' : 'to remove'}`)
if (EXECUTE && removed) {
  fs.writeFileSync(vFile, JSON.stringify(venues.filter(keep), null, 2) + '\n')
  const town = byTown[TARGET.city]
  if (Array.isArray(town)) byTown[TARGET.city] = town.filter(keep)
  else if (town?.venues) town.venues = town.venues.filter(keep)
  fs.writeFileSync(bFile, JSON.stringify(byTown, null, 2) + '\n')
}
console.log(EXECUTE ? 'Done.' : 'Dry run: nothing written. Re-run with --execute.')
