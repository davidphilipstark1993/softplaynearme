// Phase 9-03: set main_image_url from Google Places photos that were looked at and show the venue itself.
//   node scripts/migrations/phase9-03-brighton-photos.mjs [--execute] | --rollback=<file> [--execute]
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from './_lib.mjs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(DIR, '../..')
const EXECUTE = process.argv.includes('--execute')
const rb = process.argv.find((a) => a.startsWith('--rollback='))?.slice(11)
const PHOTOS = JSON.parse(fs.readFileSync(path.join(DIR, 'phase9-03-photos.json'), 'utf8'))

const pool = await getPool()
try {
  if (rb) {
    const b = JSON.parse(fs.readFileSync(path.resolve(rb), 'utf8'))
    console.log(`${EXECUTE ? 'Restoring' : 'DRY RUN restore'} ${b.length} rows`)
    if (EXECUTE) for (const r of b) await pool.query('UPDATE venues SET main_image_url=$2 WHERE id=$1', [r.id, r.main_image_url])
  } else {
    const backup = []
    for (const [id, p] of Object.entries(PHOTOS)) {
      const { rows } = await pool.query('SELECT id,name,main_image_url FROM venues WHERE id=$1', [id])
      console.log(`${p.slug} (id ${id}, "${rows[0]?.name}", photo by ${p.author}): ${(rows[0]?.main_image_url ?? '∅').slice(0, 60)} -> ${p.url.slice(0, 60)}`)
      backup.push({ id: Number(id), main_image_url: rows[0].main_image_url })
    }
    if (EXECUTE) {
      const file = path.join(ROOT, `scripts/output/backups/phase9-03-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
      fs.writeFileSync(file, JSON.stringify(backup, null, 1))
      for (const [id, p] of Object.entries(PHOTOS)) await pool.query('UPDATE venues SET main_image_url=$2, updated_at=now() WHERE id=$1', [id, p.url])
      console.log('Done. Undo file:', path.relative(ROOT, file))
    } else console.log('Dry run: nothing written.')
  }
} finally { await pool.end() }
