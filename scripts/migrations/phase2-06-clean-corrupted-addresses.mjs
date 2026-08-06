// Strips corrupted content out of the address field: leaked Google Maps
// status text ("Closed, · Opens 9 am Thu"), the literal "nan", stray "·"
// separator characters left over after status-text stripping, and literal
// "null"/"None" tokens. Salvages whatever real address fragment precedes the
// corruption. If nothing salvageable remains, sets address to NULL rather
// than leaving junk — per the rule that missing data should be omitted, not
// rendered. See reports/data-quality-audit.md §4.1.
//
// Queries the database directly by pattern (not the static JSON export) so
// it catches everything currently live, not just what a past snapshot
// happened to record.
//
//   node scripts/migrations/phase2-06-clean-corrupted-addresses.mjs [--execute]

import { EXECUTE, getPool, runBatched } from './_lib.mjs'

// Google's scraped address field is comma-joined fragments (street, area,
// open/closed status, next-opening-time). Rather than regex-stripping status
// phrases out of the whole string (which can leave a bare "Closed" behind as
// a fake "address" when it isn't paired with an "Opens ..." clause), split on
// commas and drop any segment that IS pure status/noise, keeping only
// segments that look like real address fragments.
const STATUS_SEGMENT = /^(closed|open|open now|open 24 hours|opens?\s+(\d.*|soon)|closes?\s+(\d.*|soon)|closing soon|opening soon|nan|null|none)$/i

function cleanAddress(raw) {
  if (!raw) return null
  const kept = raw
    .split(',')
    .map((seg) => seg.replace(/·/g, '').trim())
    .filter((seg) => seg && !STATUS_SEGMENT.test(seg))
  const result = kept.join(', ').trim()
  return result.length > 0 ? result : null
}

const pool = await getPool()
try {
  // NOTE: Postgres's regex engine (Advanced Regular Expressions, not PCRE)
  // does NOT treat \b as a word boundary the way JS/PCRE does — \bnan\b
  // silently matches zero rows. \y is the Postgres/Tcl-ARE equivalent. This
  // bug meant the first run of this script missed standalone "nan"/"null"
  // not immediately adjacent to "Closed"/"Opens" text.
  const { rows } = await pool.query(
    `SELECT id, name, address FROM venues
     WHERE address IS NOT NULL AND (
       address ~* '\\ynan\\y' OR address ~* '\\ynull\\y' OR address ~ 'None' OR
       address ~ '·' OR
       address ~* '(am|pm)\\y.*(opens|closed|closes)' OR address ~* 'closed,\\s*·' OR address ~* 'opens\\s+\\d'
     )`
  )

  const targets = rows.map((v) => ({ v, cleaned: cleanAddress(v.address) }))

  console.log(`Found ${targets.length} venues with corrupted address fields to clean.`)
  console.log(EXECUTE ? 'EXECUTING — this will UPDATE address (and set NULL where nothing salvageable remains).' : 'DRY RUN — no changes will be made.')

  await runBatched(targets, async ({ v, cleaned }) => {
    const check = await pool.query('SELECT id, address FROM venues WHERE id = $1', [v.id])
    if (check.rows.length === 0) {
      console.log(`  SKIP  id=${v.id} "${v.name}" — no longer in DB`)
      return 'skipped'
    }
    if (check.rows[0].address !== v.address) {
      console.log(`  SKIP  id=${v.id} "${v.name}" — address already changed since scan, re-check manually`)
      return 'skipped'
    }
    console.log(`  ${EXECUTE ? 'UPDATE' : 'would UPDATE'}  id=${v.id} "${v.name}": ${JSON.stringify(v.address)} -> ${JSON.stringify(cleaned)}`)
    if (EXECUTE) {
      await pool.query('UPDATE venues SET address = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [cleaned, v.id])
    }
  })
} finally {
  await pool.end()
}
