// Removes HIGH-confidence miscategorised venues (not soft play at all):
// aquariums, bowling alleys, escape rooms, climbing gyms, toy shops,
// adventure golf, pubs, bouncy-castle-hire companies — plus public park
// playgrounds and B2B soft-play equipment suppliers found during the sweep.
// See reports/data-quality-audit.md §2.1–2.4.
//
//   node scripts/migrations/phase2-01-remove-miscategorized.mjs [--execute]

import { EXECUTE, loadFindings, loadVenuesJson, getPool, runBatched } from './_lib.mjs'

const findings = loadFindings()
const venuesJson = loadVenuesJson()
const bySlug = new Map(venuesJson.map((v) => [v.townSlug + '|' + v.slug, v]))

// HIGH-confidence miscategorised — findings entries don't carry `id`, so
// look each one back up in the full venues.json export to get it.
const highConfidence = findings.miscategorized
  .filter((m) => m.confidence === 'HIGH')
  .map((m) => bySlug.get(m.town + '|' + m.slug))
  .filter(Boolean)

// Public park playgrounds — same heuristic used in the audit script.
// These are already full venues.json records (have `id`), used directly.
const parkPlaygrounds = venuesJson.filter(
  (x) =>
    /\b(playground|play area|children.?s play)\b/i.test(x.name) &&
    !/soft play|play centre|play zone|indoor/i.test(x.name)
)

// B2B equipment suppliers
const equipmentSuppliers = venuesJson.filter((x) =>
  /manufactur|design and install|we design|equipment (supplier|manufactur)/i.test(x.name + ' ' + (x.description || ''))
)

const seen = new Set()
const toRemove = []
for (const list of [highConfidence, parkPlaygrounds, equipmentSuppliers]) {
  for (const v of list) {
    const key = v.townSlug + '|' + v.slug
    if (seen.has(key)) continue
    seen.add(key)
    toRemove.push(v)
  }
}

console.log(`Found ${toRemove.length} venues to remove (${highConfidence.length} miscategorised + ${parkPlaygrounds.length} park playgrounds + ${equipmentSuppliers.length} equipment suppliers, deduped).`)
console.log(EXECUTE ? 'EXECUTING — this will DELETE rows.' : 'DRY RUN — no changes will be made.')

const pool = await getPool()
try {
  await runBatched(toRemove, async (v) => {
    const client = await pool.connect()
    try {
      const check = await client.query('SELECT id, name FROM venues WHERE id = $1', [v.id])
      if (check.rows.length === 0) {
        console.log(`  SKIP  id=${v.id} "${v.name}" — no longer in DB`)
        return 'skipped'
      }
      if (check.rows[0].name.trim().toLowerCase() !== v.name.trim().toLowerCase()) {
        console.log(`  SKIP  id=${v.id} — name changed since audit ("${v.name}" -> "${check.rows[0].name}"), needs manual review`)
        return 'skipped'
      }
      console.log(`  ${EXECUTE ? 'DELETE' : 'would DELETE'}  id=${v.id} "${v.name}" (${v.townSlug}) — ${v.category ?? 'no category'}`)
      if (EXECUTE) {
        await client.query('DELETE FROM venues WHERE id = $1', [v.id])
      }
    } finally {
      client.release()
    }
  })
} finally {
  await pool.end()
}
