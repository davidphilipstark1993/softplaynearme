// Home-town and nearby-town handling (data/postcode-localities.json) as seen
// through the location check script's CSV.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'loc-')), 'out.csv')
execFileSync('node', [path.join(ROOT, 'scripts/check-location-mismatches.mjs'), `--out=${out}`], { cwd: ROOT, stdio: 'pipe' })

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  const [head, ...body] = rows
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}
const rows = parseCsv(fs.readFileSync(out, 'utf8'))

test('Our Imagination Station is a Hessle (HU13) venue, listed as a Hull nearby town', () => {
  const r = rows.find((x) => x.name === 'Our Imagination Station' && x.issue === 'nearby_town')
  assert.ok(r, 'expected a nearby_town row')
  assert.equal(r.home_town, 'Hessle')
  assert.equal(r.district, 'HU13')
  assert.equal(r.hub, 'hull', 'URL stays under /soft-play/hull (URLs are stable)')
})

test('Cottingham and Anlaby venues are nearby towns of Hull, not Hull', () => {
  const towns = new Set(rows.filter((x) => x.hub === 'hull' && x.issue === 'nearby_town').map((x) => x.home_town))
  for (const t of ['Cottingham', 'Hessle', 'Anlaby']) assert.ok(towns.has(t), `${t} missing`)
})

test('Lincolnshire venues are no longer filed under a Yorkshire hub (Hull-area sweep, Nov 2026)', () => {
  // They used to sit under Doncaster/Hull and were flagged; they now live on Lincolnshire hubs
  // (Scunthorpe, Grimsby, Cleethorpes, Brigg), so the checker has nothing left to flag for them.
  const lincs = rows.filter((x) => x.issue === 'different_county' && /Lincolnshire/.test(x.suggested_action))
  assert.deepEqual(lincs.map((x) => `${x.hub}:${x.name}`), [])
})

test('the Hull page copy no longer lists Lincolnshire venues', () => {
  const src = fs.readFileSync(path.join(ROOT, 'data/hullCuratedVenues.ts'), 'utf8')
  const curated = src.slice(src.indexOf('export const HULL_CURATED_VENUES'))
  for (const name of ['Brigg', 'Cleethorpes', 'Grimsby']) assert.ok(!curated.includes(name), `${name} still in Hull curated venues`)
})

test('SO postcodes are not told to move to Southend', () => {
  for (const r of rows.filter((x) => /^SO\d/.test(x.district))) assert.doesNotMatch(r.suggested_action, /Reassign city_slug/)
})
