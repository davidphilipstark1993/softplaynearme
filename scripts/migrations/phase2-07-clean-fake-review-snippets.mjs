// The `review_snippet` column — trusted by scripts/enrich-seo-all.mjs as
// "authentic user voice" and quoted directly into venue descriptions — turns
// out to contain a leaked internal QA note for some venues instead of a real
// review: "Information verified from the venue website for X, address."
// This isn't a customer review at all, so it gets nulled rather than shown
// as one. Re-run scripts/enrich-seo-all.mjs --commit afterwards to
// regenerate descriptions for the affected venues without it.
//
//   node scripts/migrations/phase2-07-clean-fake-review-snippets.mjs [--execute]

import { EXECUTE, getPool, runBatched } from './_lib.mjs'

const pool = await getPool()
try {
  const { rows } = await pool.query(
    `SELECT id, name, review_snippet FROM venues WHERE review_snippet ILIKE '%information verified from the venue website for%'`
  )
  console.log(`Found ${rows.length} venues with a fake QA-note "review_snippet".`)
  console.log(EXECUTE ? 'EXECUTING — this will NULL review_snippet for these rows.' : 'DRY RUN — no changes will be made.')

  await runBatched(rows, async (v) => {
    const check = await pool.query('SELECT id, review_snippet FROM venues WHERE id = $1', [v.id])
    if (!check.rows.length) { console.log(`  SKIP id=${v.id} "${v.name}" — no longer in DB`); return 'skipped' }
    if (check.rows[0].review_snippet !== v.review_snippet) { console.log(`  SKIP id=${v.id} "${v.name}" — snippet already changed`); return 'skipped' }
    console.log(`  ${EXECUTE ? 'CLEAR' : 'would CLEAR'}  id=${v.id} "${v.name}"`)
    if (EXECUTE) await pool.query('UPDATE venues SET review_snippet = NULL WHERE id = $1', [v.id])
  })
} finally {
  await pool.end()
}
