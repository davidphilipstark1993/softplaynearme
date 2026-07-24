// Strips the leaked-Google-Maps-status corruption ("Closed, · Opens 9 am
// Thu", literal "nan") out of the address field, salvaging whatever real
// address fragment precedes it. If nothing salvageable remains, sets
// address to NULL rather than leaving "nan" or an empty string — per the
// instruction to omit missing data rather than render it.
// See reports/data-quality-audit.md §4.1.
//
//   node scripts/migrations/phase2-06-clean-corrupted-addresses.mjs [--execute]

import { EXECUTE, loadFindings, loadVenuesJson, getPool, runBatched } from './_lib.mjs'

const findings = loadFindings()
const venuesJson = loadVenuesJson()
const bySlug = new Map(venuesJson.map((v) => [v.townSlug + '|' + v.slug, v]))

function cleanAddress(raw) {
  if (!raw) return null
  let s = raw
  s = s.replace(/,?\s*Closed\s*,?\s*·?\s*Opens?\s+\d{1,2}(:\d{2})?\s*(am|pm)?\s*[A-Za-z]*/gi, '')
  s = s.replace(/,?\s*Open\s+24\s+hours/gi, '')
  s = s.replace(/,?\s*Open\s+now/gi, '')
  s = s.replace(/,?\s*Opens?\s+\d{1,2}(:\d{2})?\s*(am|pm)?\s*[A-Za-z]*/gi, '')
  s = s.replace(/\bnan\b/gi, '')
  s = s.replace(/,\s*,/g, ',').replace(/^[\s,]+|[\s,]+$/g, '').trim()
  return s.length > 0 ? s : null
}

const targets = findings.brokenData
  .filter((b) => b.issues.some((i) => i.field === 'address' && i.issue !== 'empty address'))
  .map((b) => bySlug.get(b.town + '|' + b.slug))
  .filter(Boolean)
  .map((v) => ({ v, cleaned: cleanAddress(v.address) }))

console.log(`Found ${targets.length} venues with corrupted address fields to clean.`)
console.log(EXECUTE ? 'EXECUTING — this will UPDATE address (and set NULL where nothing salvageable remains).' : 'DRY RUN — no changes will be made.')

const pool = await getPool()
try {
  await runBatched(targets, async ({ v, cleaned }) => {
    const client = await pool.connect()
    try {
      const check = await client.query('SELECT id, name, address FROM venues WHERE id = $1', [v.id])
      if (check.rows.length === 0) {
        console.log(`  SKIP  id=${v.id} "${v.name}" — no longer in DB`)
        return 'skipped'
      }
      if (check.rows[0].address !== v.address) {
        console.log(`  SKIP  id=${v.id} "${v.name}" — address already changed since audit, re-check manually`)
        return 'skipped'
      }
      console.log(`  ${EXECUTE ? 'UPDATE' : 'would UPDATE'}  id=${v.id} "${v.name}": ${JSON.stringify(v.address)} -> ${JSON.stringify(cleaned)}`)
      if (EXECUTE) {
        await client.query('UPDATE venues SET address = $1 WHERE id = $2', [cleaned, v.id])
      }
    } finally {
      client.release()
    }
  })
} finally {
  await pool.end()
}
