// Phase 8-01: clean up the Brighton and Worthing hubs.
//
// The "city-stamping" import bug filed venues under the city that was searched
// rather than the town in their own address, so /soft-play/brighton listed
// Lewes, Eastbourne, Worthing and Bognor venues, outdoor playgrounds, leisure
// centres and hire companies. This script, using decisions confirmed from
// reports/brighton-worthing-phase0.csv:
//
//   MOVE    venue is real but filed under the wrong hub  -> UPDATE city_slug/city/county
//   RETIRE  not soft play / hire company / duplicate     -> is_active = false
//   Both write a 301 to data/redirects.json (old URL -> new URL, or the most
//   relevant hub page). Nothing is ever left to 404.
//
// Venues that are real but belong to a town with no hub of its own (Lewes,
// Henfield, Burgess Hill ...) are NOT touched here: they stay on their hub and are
// labelled with their true town via data/postcode-localities.json, which puts
// them in the hub's "Soft play near ..." section instead of its main list/count.
//
// SAFETY
//   * Dry run by default (--dry-run is accepted, and is the default). Prints every
//     change. Nothing is written without --execute.
//   * Each row is matched by id AND slug AND current city_slug; a row that no longer
//     matches is skipped, not guessed at.
//   * --execute takes a backup first: scripts/output/backups/phase8-01-<time>.json
//     holds the full pre-change rows plus the previous data/redirects.json. Every
//     DB write runs in one transaction, and a final check asserts the resulting
//     active-venue set for both hubs before COMMIT (otherwise it ROLLBACKs).
//   * Roll back with:  node scripts/migrations/phase8-01-clean-brighton-worthing.mjs \
//                        --rollback=scripts/output/backups/phase8-01-<time>.json [--execute]
//
//   node scripts/migrations/phase8-01-clean-brighton-worthing.mjs              # dry run
//   node scripts/migrations/phase8-01-clean-brighton-worthing.mjs --execute    # write
//
// After --execute: `npm run data:rebuild` (refreshes data/generated from the DB), then deploy.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool } from './_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const REDIRECTS = path.join(ROOT, 'data/redirects.json')
const EXECUTE = process.argv.includes('--execute')
const rollbackArg = process.argv.find((a) => a.startsWith('--rollback='))?.slice('--rollback='.length)

const cities = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cities.json'), 'utf8'))
const cityInfo = (slug) => cities.find((c) => c.slug === slug)

const B = '/soft-play/brighton'
const W = '/soft-play/worthing'
const H = '/soft-play/hastings'
const P = '/soft-play/portsmouth'

// Real venues filed under the wrong hub. URL slug is kept; only the hub changes.
const MOVES = [
  { id: 901, slug: 'the-little-play-village', from: 'brighton', to: 'worthing' }, // Goring-by-Sea BN12
  { id: 894, slug: 'the-lighthouse-soft-play-and-cafe', from: 'brighton', to: 'worthing' }, // Worthing BN14
  { id: 881, slug: 'hope-hive', from: 'brighton', to: 'worthing' }, // Worthing BN13
  { id: 902, slug: 'little-street-childrens-role-play', from: 'brighton', to: 'chichester' }, // Merston, Chichester (role play; reclassified in phase8-04)
  { id: 910, slug: 'shweet-soft-play', from: 'worthing', to: 'bognor-regis' }, // Barnham, Bognor
  { id: 906, slug: 'puppet-castle-and-softplay', from: 'worthing', to: 'bognor-regis' }, // Bognor Regis
  { id: 1591, slug: 'treasure-island-adventure-park-hastings', from: 'brighton', to: 'hastings' }, // Eastbourne
  { id: 1593, slug: 'knockhatch-adventure-park-hastings', from: 'brighton', to: 'hastings' }, // Hailsham
  { id: 1624, slug: 'sharnfold-farm-hastings', from: 'brighton', to: 'hastings' }, // Hailsham/Pevensey
]

// Not soft play, hire companies, duplicates, or unplaceable. is_active -> false, 301 to `dest`.
// (Rows that are already inactive only get their redirect.)
const RETIRES = [
  // Peacehaven / Newhaven / Lewes / Seaford: no soft play of their own -> Brighton hub
  { id: 809, slug: 'childrens-playground', from: 'brighton', dest: B },
  { id: 812, slug: 'the-hub-peacehaven', from: 'brighton', dest: B },
  { id: 1605, slug: 'peacehaven-leisure-centre-hastings', from: 'brighton', dest: B },
  { id: 1607, slug: 'lewes-leisure-centre-hastings', from: 'brighton', dest: B },
  { id: 1608, slug: 'the-downs-leisure-centre-hastings', from: 'brighton', dest: B },
  { id: 1614, slug: 'play-park-hastings', from: 'brighton', dest: B },
  { id: 803, slug: 'sky-high-trampoline-park', from: 'brighton', dest: B }, // Google: permanently closed
  { id: 808, slug: 'little-learners-lewes-and-brighton-messy-play-classes', from: 'brighton', dest: B },
  { id: 1601, slug: 'branching-out-adventures-hastings', from: 'brighton', dest: B },
  // Haywards Heath / Lindfield / Burgess Hill / Portslade / Hove
  { id: 1456, slug: 'bolnore-wood-woods-end-play-area-brighton', from: 'brighton', dest: B },
  { id: 1623, slug: 'forest-fields-play-area-hastings', from: 'brighton', dest: B },
  { id: 1469, slug: 'lindfield-common-play-area-brighton', from: 'brighton', dest: B },
  { id: 1459, slug: 'sky-lark-play-area-brighton', from: 'brighton', dest: B },
  { id: 1462, slug: 'the-dolphin-brighton', from: 'brighton', dest: B },
  { id: 1472, slug: 'the-triangle-brighton', from: 'brighton', dest: B },
  { id: 1460, slug: 'speedyinflatables-bouncy-castle-sussex-soft-play-hire-brighton', from: 'brighton', dest: B }, // hire
  { id: 1464, slug: 'king-alfred-leisure-centre-brighton', from: 'brighton', dest: B },
  { id: 1465, slug: 'playpark-brighton', from: 'brighton', dest: B },
  { id: 1466, slug: 'portslade-sports-centre-brighton', from: 'brighton', dest: B },
  { id: 1468, slug: 'henfield-leisure-centre-brighton', from: 'brighton', dest: `${B}/sharkys` }, // same site as Sharky's
  { id: 905, slug: 'wrap-play-event-space', from: 'brighton', dest: B }, // party-hire of a nursery room, not drop-in
  { id: 912, slug: 'play-dreams-soft-play', from: 'brighton', dest: B }, // no address/website/Places match: cannot be placed
  // Eastbourne / Hailsham / further east -> Hastings hub
  { id: 1609, slug: 'vancouver-road-play-area-hastings', from: 'brighton', dest: H },
  { id: 1610, slug: 'seaside-rec-playground-hastings', from: 'brighton', dest: H },
  { id: 1615, slug: 'samoa-way-play-area-hastings', from: 'brighton', dest: H },
  { id: 1616, slug: 'western-road-play-area-hastings', from: 'brighton', dest: H },
  { id: 1617, slug: 'battle-road-play-area-hastings', from: 'brighton', dest: H },
  { id: 1618, slug: 'family-amusements-hastings', from: 'brighton', dest: H },
  { id: 1619, slug: 'channel-view-road-play-area-hastings', from: 'brighton', dest: H },
  { id: 1620, slug: 'gardener-close-play-area-hastings', from: 'brighton', dest: H },
  { id: 1621, slug: 'shinewater-sports-centre-hastings', from: 'brighton', dest: H },
  { id: 1626, slug: 'the-sovereign-centre-hastings', from: 'brighton', dest: H }, // Eastbourne
  { id: 1627, slug: 'hampden-park-sports-centre-hastings', from: 'brighton', dest: H },
  { id: 1930, slug: 'missionfiit-activity-hub', from: 'brighton', dest: `${H}/kidzone-at-missionfiit-hailsham` }, // duplicate
  // Pagham amusements -> Portsmouth hub (existing Bognor/Chichester precedent)
  { id: 920, slug: 'the-family-fun-centre', from: 'brighton', dest: P },
  // Worthing-side playgrounds / leisure centre / hire filed under Brighton
  { id: 1471, slug: 'hill-barn-playground-brighton', from: 'brighton', dest: W },
  { id: 1470, slug: 'queens-street-playground-brighton', from: 'brighton', dest: W },
  { id: 1452, slug: 'waterwise-playground-brighton', from: 'brighton', dest: W },
  { id: 1461, slug: 'worthing-leisure-centre-brighton', from: 'brighton', dest: W },
  { id: 1473, slug: 'bounce-mania-ltd-brighton', from: 'brighton', dest: W }, // hire, Rustington
  // Under /worthing/
  { id: 1450, slug: 'bounce-about-sussex-bouncy-castle-soft-play-hire-brighton', from: 'worthing', dest: W }, // hire
  { id: 1454, slug: 'leisure-centre-playground-brighton', from: 'worthing', dest: W },
  { id: 917, slug: 'little-lions-active-play', from: 'worthing', dest: W }, // monthly pop-up in a school hall, not a venue
  { id: 904, slug: 'harbour-park-amusements', from: 'worthing', dest: `${W}/harbour-park-indoor-soft-play` },
  { id: 1892, slug: 'space-station-soft-play-ltd-2', from: 'worthing', dest: `${W}/space-station-soft-play-ltd` }, // duplicate
]

// Active venues each hub must have once this has run. If the DB differs, nothing is committed.
const EXPECT_ACTIVE = {
  brighton: [900, 1458, 886, 914, 791, 792, 897, 903, 908, 919, 1622, 1449],
  worthing: [881, 901, 894, 874, 866, 899, 907],
}

const url = (city, slug) => `/soft-play/${city}/${slug}`
const ts = () => new Date().toISOString().replace(/[:.]/g, '-')

function buildRedirects(existing) {
  const entries = [
    ...MOVES.map((m) => ({ source: url(m.from, m.slug), destination: url(m.to, m.slug) })),
    ...RETIRES.map((r) => ({ source: url(r.from, r.slug), destination: r.dest })),
  ]
  const changedSources = new Map(entries.map((e) => [e.source, e.destination]))
  const liveAfter = new Set(MOVES.map((m) => url(m.to, m.slug)))
  const notes = []
  let rules = existing.filter((r) => {
    if (liveAfter.has(r.source)) { notes.push(`dropped old rule ${r.source} -> ${r.destination} (that URL is live again)`); return false }
    return true
  })
  // Re-point older rules that landed on a URL we are now moving/retiring, so no chains form.
  rules = rules.map((r) => {
    const next = changedSources.get(r.destination)
    if (next && next !== r.destination) { notes.push(`re-pointed ${r.source}: ${r.destination} -> ${next}`); return { ...r, destination: next } }
    return r
  })
  const bySource = new Map(rules.map((r) => [r.source, r]))
  for (const e of entries) bySource.set(e.source, { source: e.source, destination: e.destination, permanent: true })
  // Safety: no self-redirects, no chains.
  const out = [...bySource.values()]
  const dests = new Map(out.map((r) => [r.source, r.destination]))
  for (const r of out) {
    if (r.source === r.destination) throw new Error(`self-redirect ${r.source}`)
    if (dests.has(r.destination)) throw new Error(`redirect chain ${r.source} -> ${r.destination} -> ${dests.get(r.destination)}`)
  }
  return { rules: out, notes, added: entries }
}

async function rollback(file) {
  const backup = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  console.log(`${EXECUTE ? 'ROLLING BACK' : 'DRY RUN rollback'} from ${file} (${backup.rows.length} rows, taken ${backup.takenAt})`)
  const pool = await getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const r of backup.rows) {
      console.log(`  restore id=${r.id} ${r.slug}: city_slug=${r.city_slug} is_active=${r.is_active}`)
      if (EXECUTE) {
        await client.query(
          'UPDATE venues SET city_slug=$1, city=$2, county=$3, is_active=$4, updated_at=$5 WHERE id=$6',
          [r.city_slug, r.city, r.county, r.is_active, r.updated_at, r.id]
        )
      }
    }
    if (EXECUTE) {
      fs.writeFileSync(REDIRECTS, backup.redirectsJson)
      await client.query('COMMIT')
      console.log('Restored DB rows and data/redirects.json. Re-run `npm run data:rebuild`.')
    } else {
      await client.query('ROLLBACK')
      console.log('Dry run only. Add --execute to restore.')
    }
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
    await pool.end()
  }
}

async function main() {
  if (rollbackArg) return rollback(rollbackArg)

  console.log(EXECUTE ? 'EXECUTE: this will write to the database and data/redirects.json.\n' : 'DRY RUN: nothing will be written. Re-run with --execute to apply.\n')
  const pool = await getPool()
  const client = await pool.connect()
  const touched = []
  try {
    const ids = [...MOVES, ...RETIRES].map((x) => x.id)
    const { rows } = await client.query('SELECT * FROM venues WHERE id = ANY($1::int[])', [ids])
    const byId = new Map(rows.map((r) => [r.id, r]))

    const check = (plan, label) => {
      const row = byId.get(plan.id)
      if (!row) { console.log(`  SKIP   id=${plan.id} ${plan.slug}: not in DB`); return null }
      if (row.slug !== plan.slug || row.city_slug !== plan.from) {
        console.log(`  SKIP   id=${plan.id} ${plan.slug}: DB now has ${row.city_slug}/${row.slug}`); return null
      }
      return row
    }

    console.log('--- MOVE ---')
    const moves = []
    for (const m of MOVES) {
      const row = check(m)
      if (!row) continue
      const clash = await client.query('SELECT id FROM venues WHERE city_slug=$1 AND slug=$2', [m.to, m.slug])
      if (clash.rows.length) { console.log(`  SKIP   id=${m.id} ${m.slug}: slug already exists under ${m.to}`); continue }
      const ci = cityInfo(m.to)
      console.log(`  MOVE   id=${m.id} "${row.name}": ${m.from} -> ${m.to}   ${url(m.from, m.slug)} -> ${url(m.to, m.slug)}`)
      moves.push({ m, row, ci })
    }

    console.log('\n--- RETIRE (is_active=false + 301) ---')
    const retires = []
    for (const r of RETIRES) {
      const row = check(r)
      if (!row) continue
      console.log(`  ${row.is_active ? 'RETIRE' : 'redirect-only (already inactive)'} id=${r.id} "${row.name}" [${row.address || 'no address'}]   ${url(r.from, r.slug)} -> ${r.dest}`)
      retires.push({ r, row })
    }

    const existing = JSON.parse(fs.readFileSync(REDIRECTS, 'utf8'))
    const { rules, notes, added } = buildRedirects(existing)
    console.log(`\n--- REDIRECTS: ${added.length} rules written for this change; file goes from ${existing.length} to ${rules.length} rules ---`)
    for (const n of notes) console.log(`  ${n}`)

    // What each hub should look like afterwards (computed from the current rows, not hard-coded).
    const after = (await client.query(
      `SELECT id, city_slug, is_active FROM venues WHERE city_slug IN ('brighton','worthing') AND is_active = true`
    )).rows
    const state = new Map(after.map((v) => [v.id, v.city_slug]))
    for (const { r, row } of retires) if (row.is_active) state.delete(r.id)
    for (const { m } of moves) if (state.has(m.id)) state.set(m.id, m.to)
    const issues = []
    for (const [hub, expected] of Object.entries(EXPECT_ACTIVE)) {
      const got = [...state].filter(([, c]) => c === hub).map(([id]) => id).sort((a, b) => a - b)
      const want = [...expected].sort((a, b) => a - b)
      const ok = got.join() === want.join()
      console.log(`\n${hub}: ${got.length} active venues after change (${ok ? 'matches expected set' : 'DIFFERS from expected set'})`)
      if (!ok) issues.push(`${hub}: got [${got}] expected [${want}]`)
    }
    if (issues.length) {
      console.log('\nExpected-set mismatch:\n  ' + issues.join('\n  '))
      if (EXECUTE) throw new Error('Refusing to write: resulting hubs differ from the reviewed plan (data changed since the audit).')
    }

    if (!EXECUTE) { console.log('\nDry run complete. Nothing written.'); return }

    // ---- write ----
    fs.mkdirSync(path.join(ROOT, 'scripts/output/backups'), { recursive: true })
    const backupFile = path.join(ROOT, `scripts/output/backups/phase8-01-${ts()}.json`)
    fs.writeFileSync(backupFile, JSON.stringify({
      takenAt: new Date().toISOString(),
      rows: [...moves.map((x) => x.row), ...retires.map((x) => x.row)],
      redirectsJson: fs.readFileSync(REDIRECTS, 'utf8'),
    }, null, 2))
    console.log(`\nBackup written: ${path.relative(ROOT, backupFile)}`)

    await client.query('BEGIN')
    try {
      for (const { m, ci } of moves) {
        await client.query(
          'UPDATE venues SET city_slug=$1, city=$2, county=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4 AND city_slug=$5 AND slug=$6',
          [m.to, ci?.name ?? null, ci?.county ?? null, m.id, m.from, m.slug]
        )
      }
      for (const { r, row } of retires) {
        if (row.is_active) await client.query('UPDATE venues SET is_active=false, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND slug=$2', [r.id, r.slug])
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
    fs.writeFileSync(REDIRECTS, JSON.stringify(rules, null, 2) + '\n')
    console.log(`Applied ${moves.length} moves, ${retires.filter((x) => x.row.is_active).length} retirements; wrote data/redirects.json.`)
    console.log('Next: npm run data:rebuild, then check the URLs in the Phase 1 checklist, then deploy.')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
