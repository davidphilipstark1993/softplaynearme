// Moves venues to the city their postcode actually belongs to, and queues
// a 301 from the old URL to the new one via data/redirects.json (read by
// next.config.ts). Only auto-moves cases with exactly one unambiguous
// expected city — postcode areas that map to more than one declared city
// (e.g. HU -> Hull or Beverley) are left for manual placement.
//
// Covers BOTH the 57 venues found in the original Phase 1 audit (already
// had a postcode) AND ~160 additional cases surfaced by backfilling
// postcodes in phase2-03 — several entire city batches turned out to be
// mislabelled (most "Doncaster" venues are actually Sheffield/Barnsley by
// postcode; a large chunk of "Glasgow" venues are actually Birmingham).
// RUN phase2-03-backfill-postcodes.mjs FIRST.
// See reports/data-quality-audit.md §3 and the Phase 2 summary.
//
//   node scripts/migrations/phase2-04-move-wrong-city.mjs [--execute]

import { readFileSync } from 'fs'
import { EXECUTE, loadFindings, loadVenuesJson, getPool, runBatched, appendRedirects } from './_lib.mjs'

const POSTCODE_TO_CITIES = {
  AB: ['aberdeen'], IV: ['inverness'], B: ['birmingham'], BL: ['bolton'], BN: ['brighton'], BS: ['bristol'],
  BD: ['bradford'], HX: ['halifax'], HD: ['huddersfield'], CF: ['cardiff'], SA: ['swansea'],
  CO: ['colchester'], IP: ['ipswich'], DN: ['doncaster'], S: ['sheffield', 'barnsley'],
  EH: ['edinburgh'], G: ['glasgow'], FY: ['blackpool'], PR: ['bolton'],
  HU: ['hull', 'beverley'], YO: ['york', 'bridlington'], L: ['liverpool'], M: ['manchester'],
  LE: ['leicester'], LN: ['lincoln'], NG: ['nottingham'], LS: ['leeds'],
  E: ['london'], EC: ['london'], N: ['london'], NW: ['london'], SE: ['london'], SW: ['london'], W: ['london'], WC: ['london'],
  NE: ['newcastle'], SR: ['sunderland'], NR: ['norwich'], PO: ['portsmouth'], SO: ['southend'], SS: ['southend'],
  ST: ['stoke'], TN: ['hastings'],
}
function postcodeArea(pc) {
  const m = String(pc).trim().toUpperCase().match(/^([A-Z]{1,2})\d/)
  return m ? m[1] : null
}

const findings = loadFindings()
const venuesJson = loadVenuesJson()
const bySlug = new Map(venuesJson.map((v) => [v.townSlug + '|' + v.slug, v]))

// Original Phase 1 findings (already had a postcode)
const original = findings.wrongCity.map((w) => ({
  name: w.name, slug: w.slug, assignedTo: w.assignedTo, postcode: w.postcode, expectedCities: w.expectedCities,
}))

// New cases surfaced by the postcode backfill (phase2-03)
let fromBackfill = []
try {
  const backfill = JSON.parse(readFileSync('data/_postcode_backfill.json', 'utf-8')).filter((b) => b.postcode)
  fromBackfill = backfill
    .map((b) => {
      const area = postcodeArea(b.postcode)
      const expected = POSTCODE_TO_CITIES[area]
      if (!expected || expected.includes(b.townSlug)) return null
      return { name: b.name, slug: b.slug, assignedTo: b.townSlug, postcode: b.postcode, expectedCities: expected }
    })
    .filter(Boolean)
} catch {
  console.log('NOTE: data/_postcode_backfill.json not found — only processing the original 57 findings. Run phase2-03 first for full coverage.')
}

const all = [...original, ...fromBackfill]
const unambiguous = all.filter((w) => w.expectedCities.length === 1)
const ambiguous = all.filter((w) => w.expectedCities.length !== 1)

console.log(`Found ${all.length} wrong-city venues total (${original.length} original + ${fromBackfill.length} from postcode backfill): ${unambiguous.length} unambiguous (auto-movable), ${ambiguous.length} need manual placement.`)
if (ambiguous.length) {
  console.log('\nManual placement needed:')
  for (const a of ambiguous) {
    console.log(`  MANUAL  "${a.name}" (${a.slug}) currently on ${a.assignedTo}, postcode ${a.postcode} could be ${a.expectedCities.join(' or ')}`)
  }
}

console.log(EXECUTE ? '\nEXECUTING — this will UPDATE city_slug and append to data/redirects.json.' : '\nDRY RUN — no changes will be made.')

const pool = await getPool()
const redirectsToAdd = []

try {
  await runBatched(unambiguous, async (w) => {
    const v = bySlug.get(w.assignedTo + '|' + w.slug)
    if (!v) {
      console.log(`  SKIP  "${w.name}" — not found in venues.json export, needs manual lookup`)
      return 'skipped'
    }
    const client = await pool.connect()
    try {
      const check = await client.query('SELECT id, name, city_slug FROM venues WHERE id = $1', [v.id])
      if (check.rows.length === 0) {
        console.log(`  SKIP  id=${v.id} "${v.name}" — no longer in DB`)
        return 'skipped'
      }
      if (check.rows[0].name.trim().toLowerCase() !== v.name.trim().toLowerCase()) {
        console.log(`  SKIP  id=${v.id} — name changed since audit, needs manual review`)
        return 'skipped'
      }
      if (check.rows[0].city_slug !== w.assignedTo) {
        console.log(`  SKIP  id=${v.id} — city_slug already changed to "${check.rows[0].city_slug}" since audit, re-check manually`)
        return 'skipped'
      }
      const newCity = w.expectedCities[0]
      const oldPath = `/soft-play/${w.assignedTo}/${v.slug}`
      const newPath = `/soft-play/${newCity}/${v.slug}`
      console.log(`  ${EXECUTE ? 'MOVE' : 'would MOVE'}  id=${v.id} "${v.name}": ${w.assignedTo} -> ${newCity}  (redirect ${oldPath} -> ${newPath})`)
      if (EXECUTE) {
        await client.query('UPDATE venues SET city_slug = $1 WHERE id = $2', [newCity, v.id])
      }
      redirectsToAdd.push({ source: oldPath, destination: newPath, permanent: true })
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
