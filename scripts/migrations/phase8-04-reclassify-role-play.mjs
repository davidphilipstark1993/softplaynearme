// Phase 8-04: The Little Play Village (901) and Little Street (902) are role-play villages, not
// conventional soft play centres. Reclassify them as 'family-attraction' so they drop out of soft play
// counts and "highest rated" rankings but stay visitable under "Other family activities".
//
//   node scripts/migrations/phase8-04-reclassify-role-play.mjs             # dry run
//   node scripts/migrations/phase8-04-reclassify-role-play.mjs --execute   # write (backs up first)
//   node scripts/migrations/phase8-04-reclassify-role-play.mjs --rollback=<backup file> [--execute]
//
// Run after phase8-01 (and before `npm run data:rebuild`).

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const EXECUTE = process.argv.includes('--execute')
const rollbackArg = process.argv.find((a) => a.startsWith('--rollback='))?.slice('--rollback='.length)
const TARGET = 'family-attraction'
const IDS = [
  { id: 901, slug: 'the-little-play-village' }, // role-play village, Goring-by-Sea
  { id: 902, slug: 'little-street-childrens-role-play' }, // role play, Merston
]

async function main() {
  const pool = await getPool()
  const c = await pool.connect()
  try {
    if (rollbackArg) {
      const b = JSON.parse(fs.readFileSync(path.resolve(rollbackArg), 'utf8'))
      await c.query('BEGIN')
      for (const r of b.rows) {
        console.log(`  restore id=${r.id} ${r.slug}: venue_type=${r.venue_type}`)
        if (EXECUTE) await c.query('UPDATE venues SET venue_type=$1, updated_at=$2 WHERE id=$3', [r.venue_type, r.updated_at, r.id])
      }
      await c.query(EXECUTE ? 'COMMIT' : 'ROLLBACK')
      console.log(EXECUTE ? 'Restored.' : 'Dry run. Add --execute to restore.')
      return
    }
    console.log(EXECUTE ? 'EXECUTE\n' : 'DRY RUN: nothing will be written. Re-run with --execute.\n')
    const { rows } = await c.query('SELECT id, slug, name, city_slug, venue_type, updated_at FROM venues WHERE id = ANY($1::int[])', [IDS.map((x) => x.id)])
    const todo = []
    for (const t of IDS) {
      const r = rows.find((x) => x.id === t.id)
      if (!r || r.slug !== t.slug) { console.log(`  SKIP id=${t.id} ${t.slug}: not found / slug differs`); continue }
      if (r.venue_type === TARGET) { console.log(`  SKIP id=${t.id} ${r.name}: already ${TARGET}`); continue }
      console.log(`  CHANGE id=${t.id} "${r.name}" (${r.city_slug}): venue_type ${r.venue_type} -> ${TARGET}`)
      todo.push(r)
    }
    if (!EXECUTE) { console.log('\nDry run complete. Nothing written.'); return }
    if (!todo.length) return
    fs.mkdirSync(path.join(ROOT, 'scripts/output/backups'), { recursive: true })
    const file = path.join(ROOT, `scripts/output/backups/phase8-04-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), rows: todo }, null, 2))
    console.log(`\nBackup written: ${path.relative(ROOT, file)}`)
    await c.query('BEGIN')
    for (const r of todo) await c.query('UPDATE venues SET venue_type=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [TARGET, r.id])
    await c.query('COMMIT')
    console.log(`Updated ${todo.length} venue(s). Next: npm run data:rebuild.`)
  } finally { c.release(); await pool.end() }
}
main().catch((e) => { console.error(e); process.exit(1) })
