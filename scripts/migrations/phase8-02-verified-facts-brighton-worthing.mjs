// Phase 8-02: record facts that were read off each venue's own website on 2026-10-25.
//
// Only facts stated on the venue's site are written, each with its source below. Flags are
// only ever set to true (a venue not mentioning parties is "unknown", never "no"), and an
// age range is only written when the column is empty; a conflicting existing value is
// reported and skipped. Prices are not written: they change too often to hold unverified.
//
//   node scripts/migrations/phase8-02-verified-facts-brighton-worthing.mjs             # dry run
//   node scripts/migrations/phase8-02-verified-facts-brighton-worthing.mjs --execute   # write (backs up first)
//   node scripts/migrations/phase8-02-verified-facts-brighton-worthing.mjs --rollback=<backup file> [--execute]
//
// Run after phase8-01. Then `npm run data:rebuild`.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const EXECUTE = process.argv.includes('--execute')
const rollbackArg = process.argv.find((a) => a.startsWith('--rollback='))?.slice('--rollback='.length)
const VERIFIED_DATE = '2026-10-25'

// id, slug, facts, source
const FACTS = [
  { id: 874, slug: 'space-station-soft-play-ltd', set: { parties: true, cafe: true, age_range_min: 0, age_range_max: 12 }, src: 'spacestationsoftplay.co.uk: "children 0–12", 2 party rooms, Space Station Café' },
  { id: 894, slug: 'the-lighthouse-soft-play-and-cafe', set: { parties: true, cafe: true, age_range_min: 0, age_range_max: 10 }, src: 'lighthousesoftplay.com: Party Bookings from £175, community café, entry prices for ages 0–9 months to 3–10 years' },
  { id: 899, slug: 'out-of-bounds', set: { parties: true }, src: 'out-of-bounds.co.uk: Parties menu' },
  { id: 866, slug: 'flying-fortress', set: { parties: true, cafe: true, age_range_min: 0, age_range_max: 13 }, src: 'flying-fortress.co.uk: Party Information, 300-seater café, child prices 0–2 to 5–13' },
  { id: 907, slug: 'harbour-park-indoor-soft-play', set: { parties: true, age_range_min: 0, age_range_max: 9 }, src: 'harbourpark.com/soft-play: "up to 9 years", Soft Play Parties' },
  { id: 901, slug: 'the-little-play-village', set: { parties: true }, src: 'thelittleplayvillage.co.uk: Party packages' },
  { id: 791, slug: 'monkey-bizness-lewes', set: { parties: true }, src: 'monkey-bizness.co.uk/lewes: party packages' },
  { id: 897, slug: 'sharkys', set: { parties: true, cafe: true, sen_friendly: true }, src: 'sharkysplay.co.uk: Parties, Café, SEN sessions first & third Thursday' },
  { id: 919, slug: 'the-doves-play-barn', set: { parties: true, cafe: true }, src: 'thedovesplaybarn.co.uk: Playbarn Parties, coffee and pastries' },
  { id: 903, slug: 'jumpin-fun-inflatable-park-burgess-hill', set: { parties: true }, src: 'jumpinfun.co.uk/burgess-hill: Parties' },
]
const BOOLS = new Set(['parties', 'cafe', 'sen_friendly'])

async function rollback(file) {
  const b = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  const pool = await getPool()
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    for (const r of b.rows) {
      console.log(`  restore id=${r.id} ${r.slug}`)
      if (EXECUTE) await c.query('UPDATE venues SET parties=$1, cafe=$2, sen_friendly=$3, age_range_min=$4, age_range_max=$5, last_verified_at=$6, updated_at=$7 WHERE id=$8',
        [r.parties, r.cafe, r.sen_friendly, r.age_range_min, r.age_range_max, r.last_verified_at, r.updated_at, r.id])
    }
    await c.query(EXECUTE ? 'COMMIT' : 'ROLLBACK')
    console.log(EXECUTE ? 'Restored.' : 'Dry run. Add --execute to restore.')
  } finally { c.release(); await pool.end() }
}

async function main() {
  if (rollbackArg) return rollback(rollbackArg)
  console.log(EXECUTE ? 'EXECUTE\n' : 'DRY RUN: nothing will be written. Re-run with --execute.\n')
  const pool = await getPool()
  const c = await pool.connect()
  try {
    const { rows } = await c.query('SELECT * FROM venues WHERE id = ANY($1::int[])', [FACTS.map((f) => f.id)])
    const byId = new Map(rows.map((r) => [r.id, r]))
    const plan = []
    for (const f of FACTS) {
      const row = byId.get(f.id)
      if (!row || row.slug !== f.slug) { console.log(`SKIP id=${f.id} ${f.slug}: not found / slug differs`); continue }
      const changes = {}
      for (const [k, v] of Object.entries(f.set)) {
        const cur = row[k]
        if (BOOLS.has(k)) { if (cur !== true) changes[k] = v }
        else if (cur === null || cur === undefined) changes[k] = v
        else if (Number(cur) !== v) console.log(`  CONFLICT id=${f.id} ${f.slug}: ${k} is ${cur}, site says ${v}: left as is`)
      }
      console.log(`${Object.keys(changes).length ? 'SET ' : 'ok  '} id=${f.id} ${f.slug} ${JSON.stringify(changes)}\n       source: ${f.src}`)
      plan.push({ f, row, changes })
    }
    if (!EXECUTE) { console.log('\nDry run complete. Nothing written.'); return }
    fs.mkdirSync(path.join(ROOT, 'scripts/output/backups'), { recursive: true })
    const file = path.join(ROOT, `scripts/output/backups/phase8-02-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.writeFileSync(file, JSON.stringify({ takenAt: new Date().toISOString(), rows: plan.map((p) => p.row) }, null, 2))
    console.log(`\nBackup written: ${path.relative(ROOT, file)}`)
    await c.query('BEGIN')
    try {
      for (const { f, changes } of plan) {
        const cols = Object.keys(changes)
        if (!cols.length) continue
        const sets = cols.map((k, i) => `${k}=$${i + 1}`).join(', ')
        await c.query(`UPDATE venues SET ${sets}, last_verified_at=$${cols.length + 1}, updated_at=CURRENT_TIMESTAMP WHERE id=$${cols.length + 2}`, [...cols.map((k) => changes[k]), VERIFIED_DATE, f.id])
      }
      await c.query('COMMIT')
    } catch (e) { await c.query('ROLLBACK'); throw e }
    console.log('Applied.')
  } finally { c.release(); await pool.end() }
}
main().catch((e) => { console.error(e); process.exit(1) })
