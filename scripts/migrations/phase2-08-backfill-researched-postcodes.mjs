// Postcode backfill for a specific batch of venues individually verified
// against an authoritative source (business's own site, food-hygiene
// register, council/venue-hire listing) during manual resolution of
// name-only geo-mismatch signals — not reverse-geocoded from lat/lng like
// phase2-03. See phase2-04's MANUAL_OVERRIDES comments for the source of
// each.
//
//   node scripts/migrations/phase2-08-backfill-researched-postcodes.mjs [--execute]

import { EXECUTE, getPool, runBatched } from './_lib.mjs'

const POSTCODES = [
  { id: 117, postcode: 'BD8 0HR' },  // 5 Alive Bradford
  { id: 139, postcode: 'BD10 9TQ' }, // Infinity Bradford (Albion Mills)
  { id: 152, postcode: 'YO26 6RU' }, // Flip Out York
  { id: 300, postcode: 'S74 8HJ' },  // Playmania Barnsley (Elsecar)
  { id: 322, postcode: 'S9 2DD' },   // Monkey Bizness Sheffield (Valley Centertainment)
  { id: 340, postcode: 'S2 4QA' },   // Playroom Soft Play Centre Sheffield
  { id: 366, postcode: 'HD3 4TG' },  // Town Playcafé Huddersfield
  { id: 945, postcode: 'DN4 5JP' },  // Play Valley Doncaster
  { id: 1003, postcode: 'DN5 9PX' }, // Bounce Happy Doncaster
  { id: 1012, postcode: 'S71 1AN' }, // Barnsley Metrodome Waterpark
]

const pool = await getPool()
try {
  console.log(EXECUTE ? 'EXECUTING — this will UPDATE postcode.' : 'DRY RUN — no changes will be made.')
  await runBatched(POSTCODES, async ({ id, postcode }) => {
    const check = await pool.query('SELECT id, name, postcode FROM venues WHERE id = $1', [id])
    if (!check.rows.length) { console.log(`  SKIP id=${id} — no longer in DB`); return 'skipped' }
    if (check.rows[0].postcode) { console.log(`  SKIP id=${id} "${check.rows[0].name}" — already has a postcode ("${check.rows[0].postcode}")`); return 'skipped' }
    console.log(`  ${EXECUTE ? 'UPDATE' : 'would UPDATE'}  id=${id} "${check.rows[0].name}" -> postcode='${postcode}'`)
    if (EXECUTE) await pool.query('UPDATE venues SET postcode = $1 WHERE id = $2', [postcode, id])
  })
} finally {
  await pool.end()
}
