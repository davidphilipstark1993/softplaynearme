// Writes data/venue-towns.json: { venueId: "Town" } — the town each venue is really in,
// from its own postcode (or lat/lng) via postcodes.io's built-up area (bua), falling
// back to a named parish. Used by lib/localities.ts after the hand-curated
// postcode-localities.json, so the venue page's title, H1 and meta name a real town
// (Shipley, Tipton, Eastbourne) instead of the hub the URL is filed under.
//
// Read-only on the DB. Re-run after adding venues:
//   DATABASE_URL=... node scripts/build-venue-towns.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './migrations/_lib.mjs'
import { lookupLocations, loadHubs, normName, OS_NAME } from './lib/derive-city.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = path.join(ROOT, 'seo-data/.postcodes-cache.json')
const OUT = path.join(ROOT, 'data/venue-towns.json')

// postcodes.io / ONS names -> the name the site uses for that place.
const RENAME = {
  'kingston upon hull': 'Hull',
  'newcastle upon tyne': 'Newcastle',
  'brighton and hove': 'Brighton',
  'royal sutton coldfield': 'Sutton Coldfield',
  'city of westminster': 'Westminster',
  'city of london': 'City of London',
}
// Joint names that are the place's real name; any other "X and Y" / "X with Y" built-up
// area or parish is two towns merged by the ONS, and the first is the one people say.
const KEEP_JOINT = new Set(['barking and dagenham', 'hammersmith and fulham', 'kensington and chelsea', 'richmond upon thames', 'kingston upon thames'])

/** "Newport (Newport)" -> "Newport"; ONS hub aliases -> the site's hub name. */
export function cleanTown(name, hubNames) {
  if (!name) return null
  let n = String(name).replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!n || /unparished area/i.test(n)) return null
  const key = normName(n)
  if (RENAME[key]) return RENAME[key]
  if (hubNames.has(key)) return hubNames.get(key)
  if (!KEEP_JOINT.has(key)) n = n.split(/ (?:and|with) /)[0]
  return hubNames.get(normName(n)) ?? n
}

const hubs = loadHubs(ROOT)
const hubNames = new Map([...hubs.values()].map((h) => [normName(h.name), h.name]))
for (const [slug, os] of Object.entries(OS_NAME)) if (hubs.has(slug)) hubNames.set(normName(os), hubs.get(slug).name)
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : { pc: {}, rev: {} }
const pool = await getPool()
const { rows } = await pool.query('SELECT id, name, postcode, lat, lng FROM venues WHERE is_active = true ORDER BY id')
await pool.end()
const locs = await lookupLocations(rows, cache, () => fs.writeFileSync(CACHE, JSON.stringify(cache)))
fs.mkdirSync(path.dirname(CACHE), { recursive: true })
fs.writeFileSync(CACHE, JSON.stringify(cache))

const out = {}
const how = { bua: 0, parish: 0, none: 0 }
rows.forEach((v, i) => {
  const g = locs[i].pc ?? locs[i].rev
  const bua = cleanTown(g?.bua, hubNames)
  const parish = bua ? null : cleanTown(g?.parish, hubNames)
  const town = bua ?? parish
  how[bua ? 'bua' : parish ? 'parish' : 'none']++
  if (town) out[v.id] = town
})
fs.writeFileSync(OUT, JSON.stringify(out, null, 0).replace(/,"/g, ',\n"').replace(/^\{/, '{\n').replace(/\}$/, '\n}') + '\n')
console.log(`${rows.length} active venues: ${how.bua} by built-up area, ${how.parish} by parish, ${how.none} unknown -> ${path.relative(ROOT, OUT)}`)
