// Merges duplicate venues (same phone number = same physical premises).
// Only auto-merges HIGH-confidence groups (name similarity backs up the
// phone match too). MEDIUM-confidence groups are listed but NOT auto-merged
// — the audit flagged those as needing a manual look (e.g. two different
// attractions that happen to share a building's reception phone line).
// Keeps whichever venue in a group has the most complete data (non-empty
// field count), removes the other(s), and queues a 301 to the survivor.
// See reports/data-quality-audit.md §5.
//
//   node scripts/migrations/phase2-05-merge-duplicates.mjs [--execute]

import { EXECUTE, loadFindings, loadVenuesJson, getPool, runBatched, appendRedirects } from './_lib.mjs'

const findings = loadFindings()
const venuesJson = loadVenuesJson()
const byNameTown = new Map(venuesJson.map((v) => [v.townSlug + '|' + v.name, v]))

const FIELDS_FOR_COMPLETENESS = [
  'address', 'postcode', 'website', 'phone', 'description', 'openingHoursText',
  'rating', 'reviewCount', 'mainImageUrl', 'pricingHint',
]
function completeness(v) {
  if (!v) return -1
  return FIELDS_FOR_COMPLETENESS.reduce((n, f) => n + (v[f] ? 1 : 0), 0)
}

const highGroups = findings.duplicates.filter((d) => d.confidence === 'HIGH')
const mediumGroups = findings.duplicates.filter((d) => d.confidence === 'MEDIUM')

console.log(`Found ${highGroups.length} HIGH-confidence duplicate groups (auto-merge) and ${mediumGroups.length} MEDIUM-confidence groups (manual review only):`)
for (const g of mediumGroups) {
  console.log(`  MANUAL  ${g.town}: ${g.venues.map((v) => v.name).join(' <-> ')}`)
}

console.log(EXECUTE ? '\nEXECUTING — this will DELETE the less-complete duplicate(s) and append to data/redirects.json.' : '\nDRY RUN — no changes will be made.')

const pool = await getPool()
const redirectsToAdd = []

try {
  await runBatched(highGroups, async (g) => {
    const full = g.venues.map((v) => byNameTown.get(g.town + '|' + v.name)).filter(Boolean)
    if (full.length < 2) {
      console.log(`  SKIP  ${g.town} group — couldn't resolve all venues in venues.json`)
      return 'skipped'
    }
    const ranked = [...full].sort((a, b) => completeness(b) - completeness(a))
    const keep = ranked[0]
    const remove = ranked.slice(1)

    const client = await pool.connect()
    try {
      const keepCheck = await client.query('SELECT id, name FROM venues WHERE id = $1', [keep.id])
      if (keepCheck.rows.length === 0) {
        console.log(`  SKIP  ${g.town} group — survivor id=${keep.id} "${keep.name}" no longer in DB`)
        return 'skipped'
      }
      for (const r of remove) {
        const rCheck = await client.query('SELECT id, name FROM venues WHERE id = $1', [r.id])
        if (rCheck.rows.length === 0) {
          console.log(`  SKIP  id=${r.id} "${r.name}" — already gone`)
          continue
        }
        console.log(`  ${EXECUTE ? 'MERGE' : 'would MERGE'}  "${r.name}" (id=${r.id}) -> "${keep.name}" (id=${keep.id}), ${g.town}`)
        if (EXECUTE) {
          await client.query('DELETE FROM venues WHERE id = $1', [r.id])
        }
        redirectsToAdd.push({
          source: `/soft-play/${g.town}/${r.slug}`,
          destination: `/soft-play/${g.town}/${keep.slug}`,
          permanent: true,
        })
      }
    } finally {
      client.release()
    }
  })
} finally {
  await pool.end()
}

if (redirectsToAdd.length) {
  const added = appendRedirects(redirectsToAdd)
  console.log(`\n${EXECUTE ? 'Added' : 'Would add'} ${added} new redirect(s) to data/redirects.json`)
}
