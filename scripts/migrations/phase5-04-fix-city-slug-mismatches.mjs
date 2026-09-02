// Regenerates `slug` in the database for venues whose slug still names a
// stale city from before an earlier geo reassignment corrected `city_slug`
// (e.g. a venue moved to Birmingham that still slugs as "...-glasgow" from
// when it was misclassified). The static JSON files were already fixed by
// scripts/fix-city-slug-mismatches.mjs --apply; this brings the DB in line
// so the next scripts/rebuild-static-json.mjs doesn't reintroduce the stale
// slugs. Also queues a 301 from the old (already Google-indexed) URL to the
// new one via data/redirects.json.
//
// Source list: scripts/output/city-slug-mismatches.json, filtered to the
// entries WITHOUT needsManualReview — 24 venues in that report are flagged
// as an actual wrong city_slug (Southampton postcodes filed under
// "southend"), not a stale slug, and are deliberately excluded here. Fixing
// those means reassigning city_slug, which is a separate decision.
//
//   node scripts/migrations/phase5-04-fix-city-slug-mismatches.mjs           (dry run)
//   node scripts/migrations/phase5-04-fix-city-slug-mismatches.mjs --execute (writes)

import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { EXECUTE, getPool, runBatched, appendRedirects } from './_lib.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const REPORT_PATH = path.join(ROOT, 'scripts/output/city-slug-mismatches.json')

const allFindings = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'))
const targets = allFindings.filter((f) => !f.needsManualReview)

console.log(`Loaded ${allFindings.length} findings from ${path.relative(ROOT, REPORT_PATH)}: ${targets.length} safe to fix, ${allFindings.length - targets.length} excluded (needs manual review).`)
console.log(EXECUTE ? '\nEXECUTING — this will UPDATE venues.slug and append to data/redirects.json.' : '\nDRY RUN — no changes will be made.')

const pool = await getPool()
const redirectsToAdd = []

try {
  await runBatched(targets, async (t) => {
    const client = await pool.connect()
    try {
      const check = await client.query('SELECT id, name, slug, city_slug FROM venues WHERE id = $1', [t.id])
      if (check.rows.length === 0) {
        console.log(`  SKIP  id=${t.id} "${t.name}" — no longer in DB`)
        return 'skipped'
      }
      const row = check.rows[0]
      if (row.city_slug !== t.townSlug) {
        console.log(`  SKIP  id=${t.id} "${t.name}" — city_slug is now "${row.city_slug}", expected "${t.townSlug}" (changed since scan, re-check manually)`)
        return 'skipped'
      }
      if (row.slug !== t.oldSlug) {
        console.log(`  SKIP  id=${t.id} "${t.name}" — slug is now "${row.slug}", expected "${t.oldSlug}" (already changed since scan)`)
        return 'skipped'
      }

      console.log(`  ${EXECUTE ? 'FIX' : 'would FIX'}  id=${t.id} "${t.name}" [${t.townSlug}]: ${t.oldSlug} -> ${t.newSlug}`)
      if (EXECUTE) {
        await client.query('UPDATE venues SET slug = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [t.newSlug, t.id])
      }
      redirectsToAdd.push({ source: t.oldUrl, destination: t.newUrl, permanent: true })
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
