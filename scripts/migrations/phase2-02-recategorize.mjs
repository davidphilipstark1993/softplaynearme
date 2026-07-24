// Recategorises MEDIUM-confidence venues — legitimate family attractions
// that aren't soft play — by setting venue_type so they're excluded from
// city "Top Rated"/"Best for Toddlers" modules (see lib/venueTypes.ts and
// app/soft-play/[city]/page.tsx, already shipped and reading this column).
// Leisure-centre/events-venue entries are left untouched here — the audit
// flagged those as needing a manual look (some genuinely have a soft-play
// area attached), not a mechanical recategorisation.
// See reports/data-quality-audit.md §2.5.
//
//   node scripts/migrations/phase2-02-recategorize.mjs [--execute]

import { EXECUTE, loadFindings, loadVenuesJson, getPool, runBatched } from './_lib.mjs'

const findings = loadFindings()
const venuesJson = loadVenuesJson()
const bySlug = new Map(venuesJson.map((v) => [v.townSlug + '|' + v.slug, v]))

function classify(reasons) {
  const text = reasons.join(' ').toLowerCase()
  if (text.includes('trampoline')) return 'trampoline-park'
  if (text.includes('farm')) return 'play-farm'
  return null // leisure centre / events venue / amusement park — needs a human, skip
}

const candidates = findings.miscategorized
  .filter((m) => m.confidence === 'MEDIUM')
  .map((m) => ({ ...m, venueType: classify(m.reasons), full: bySlug.get(m.town + '|' + m.slug) }))
  .filter((m) => m.venueType && m.full)

const skippedForReview = findings.miscategorized.filter((m) => m.confidence === 'MEDIUM').length - candidates.length

console.log(`Found ${candidates.length} venues to recategorise (trampoline-park / play-farm). ${skippedForReview} left for manual review (leisure centres / events venues / amusement parks — not mechanically classifiable).`)
console.log(EXECUTE ? 'EXECUTING — this will UPDATE venue_type.' : 'DRY RUN — no changes will be made.')

const pool = await getPool()
try {
  await runBatched(candidates, async (m) => {
    const v = m.full
    const client = await pool.connect()
    try {
      const check = await client.query('SELECT id, name FROM venues WHERE id = $1', [v.id])
      if (check.rows.length === 0) {
        console.log(`  SKIP  id=${v.id} "${v.name}" — no longer in DB`)
        return 'skipped'
      }
      if (check.rows[0].name.trim().toLowerCase() !== v.name.trim().toLowerCase()) {
        console.log(`  SKIP  id=${v.id} — name changed since audit, needs manual review`)
        return 'skipped'
      }
      console.log(`  ${EXECUTE ? 'UPDATE' : 'would UPDATE'}  id=${v.id} "${v.name}" (${v.townSlug}) -> venue_type='${m.venueType}'`)
      if (EXECUTE) {
        await client.query('UPDATE venues SET venue_type = $1 WHERE id = $2', [m.venueType, v.id])
      }
    } finally {
      client.release()
    }
  })
} finally {
  await pool.end()
}
