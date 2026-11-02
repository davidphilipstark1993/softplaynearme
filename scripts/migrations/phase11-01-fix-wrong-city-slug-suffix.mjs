// Phase 11-01: remove the wrong-city suffix from venue slugs.
//
// Cause: the old importers built slug = `${name} ${searchCity}`, where searchCity was the
// town the venue was found *while searching*, not where it is. So a Birmingham venue found
// in a Glasgow search became /soft-play/birmingham/party-and-play-glasgow. The generators now
// use name-only slugs (scripts/lib/venue-slug.mjs); this migration repairs the rows already
// in the database. The URL is /soft-play/{city}/{slug}, so the city never belongs in the slug.
//
// Dry run (default): writes reports/slug-fixes.csv for review and changes nothing.
// --execute: backs up, UPDATEs venues.slug and appends 301s to data/redirects.json.
// --rollback=<backup file> [--execute]: restores old slugs and removes the redirects it added.
//
// ORDER WHEN EXECUTING: the redirects only exist once the code that carries data/redirects.json is
// deployed, and the new slugs only exist once this has run, so run --execute and deploy back to
// back. Until both are done an old URL is either live (not run yet) or a 404 (run, not deployed).
//
// City folder: this script only fixes the slug. A venue whose *folder* looks wrong (a long way
// from its own hub and closer to another) is listed with TODO(David): confirm city, not moved.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPool, EXECUTE, appendRedirects } from './_lib.mjs'
import { slugify, stripTrailingCity, RESERVED_VENUE_SLUGS } from '../lib/venue-slug.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BASE = '/soft-play'
const rb = process.argv.find((a) => a.startsWith('--rollback='))?.slice(11)
const REDIRECTS = path.join(ROOT, 'data/redirects.json')

function km(a, b) {
  const R = 6371, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

/** Source files that hold /soft-play/{city}/{slug} links (blog guides etc.) must point at the new URL, not at a redirect. */
function rewriteInternalLinks(fixes, write = EXECUTE) {
  const files = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name)
      if (e.isDirectory()) { if (!['node_modules', '.next', 'generated'].includes(e.name)) walk(f) }
      else if (/\.(tsx?|json)$/.test(e.name) && e.name !== 'redirects.json') files.push(f)
    }
  }
  for (const d of ['lib', 'app', 'components', 'data']) walk(path.join(ROOT, d))
  const byOld = fixes.map((f) => [`${BASE}/${f.city}/${f.oldSlug}`, `${BASE}/${f.city}/${f.newSlug}`])
  let count = 0
  for (const f of files) {
    let text = fs.readFileSync(f, 'utf8')
    if (!text.includes(`${BASE}/`)) continue
    let changed = text
    for (const [o, n] of byOld) {
      changed = changed.replace(new RegExp(o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9-])', 'g'), () => { count++; return n })
    }
    if (write && changed !== text) fs.writeFileSync(f, changed)
  }
  return count
}

const pool = await getPool()
try {
  if (rb) {
    const backup = JSON.parse(fs.readFileSync(rb, 'utf8'))
    console.log(`${EXECUTE ? 'ROLLBACK' : 'DRY RUN rollback'}: ${backup.length} venues`)
    if (EXECUTE) {
      for (const b of backup) await pool.query('UPDATE venues SET slug=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND slug=$3', [b.oldSlug, b.id, b.newSlug])
      const drop = new Set(backup.map((b) => `${BASE}/${b.city}/${b.oldSlug}`))
      const kept = JSON.parse(fs.readFileSync(REDIRECTS, 'utf8')).filter((r) => !drop.has(r.source))
      fs.writeFileSync(REDIRECTS, JSON.stringify(kept, null, 2) + '\n')
    }
    process.exit(0)
  }

  const { rows } = await pool.query(
    'SELECT id, name, slug, city_slug, address, postcode, lat, lng FROM venues WHERE is_active = true',
  )
  const allSlugs = await pool.query('SELECT city_slug, slug FROM venues')
  const taken = new Map() // city_slug -> Set(slug)
  for (const r of allSlugs.rows) (taken.get(r.city_slug) ?? taken.set(r.city_slug, new Set()).get(r.city_slug)).add(r.slug)

  const citySlugs = new Set(rows.map((r) => r.city_slug))
  // Hub centres (median of its venues' coordinates) for the "is the folder itself wrong?" check.
  const centres = {}
  for (const c of citySlugs) {
    const pts = rows.filter((r) => r.city_slug === c && r.lat != null && r.lng != null)
    if (pts.length >= 3) centres[c] = { lat: median(pts.map((p) => +p.lat)), lng: median(pts.map((p) => +p.lng)) }
  }

  const fixes = []
  for (const r of rows) {
    const nameSlug = slugify(r.name)
    let s = r.slug
    const removed = []
    for (let guard = 0; guard < 4; guard++) {
      if (s === nameSlug) break // what remains is the venue's own name
      const x = [...citySlugs].filter((c) => c !== r.city_slug && s.endsWith(`-${c}`) && s.length - c.length - 1 >= 3)
        .sort((a, b) => b.length - a.length)[0]
      if (!x) break
      s = s.slice(0, -(x.length + 1)); removed.push(x)
    }
    if (!removed.length) continue
    s = stripTrailingCity(s, r.city_slug)
    if (RESERVED_VENUE_SLUGS.has(s) || s.length < 3) continue
    let note = ''
    const set = taken.get(r.city_slug)
    let final = s
    if (final !== r.slug && set.has(final)) {
      let n = 2; while (set.has(`${s}-${n}`)) n++
      final = `${s}-${n}`; note = `slug ${s} already used in this city (possible duplicate listing)`
    }
    if (final === r.slug) continue
    set.add(final)

    // Is the city folder itself plausible?
    let cityCheck = ''
    const here = centres[r.city_slug]
    if (here && r.lat != null && r.lng != null) {
      const p = { lat: +r.lat, lng: +r.lng }
      const dHere = km(p, here)
      if (dHere > 30) {
        const [near, dNear] = Object.entries(centres).filter(([c]) => c !== r.city_slug)
          .map(([c, ctr]) => [c, km(p, ctr)]).sort((a, b) => a[1] - b[1])[0]
        cityCheck = dNear < dHere / 2
          ? `TODO(David): confirm city - ${Math.round(dHere)}km from ${r.city_slug}, ${Math.round(dNear)}km from ${near}`
          : `${Math.round(dHere)}km from ${r.city_slug} centre (no closer hub)`
      }
    }
    fixes.push({ id: r.id, name: r.name, city: r.city_slug, oldSlug: r.slug, newSlug: final, removed: removed.join('+'), address: r.address ?? '', postcode: r.postcode ?? '', cityCheck, note })
  }

  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = ['id,name,old_url,new_url,address,postcode,suffix_removed,city_check,note',
    ...fixes.map((f) => [f.id, f.name, `${BASE}/${f.city}/${f.oldSlug}`, `${BASE}/${f.city}/${f.newSlug}`, f.address, f.postcode, f.removed, f.cityCheck, f.note].map(q).join(','))].join('\n')
  fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, 'reports/slug-fixes.csv'), csv + '\n')
  console.log(`${fixes.length} venues have a wrong-city slug suffix; ${fixes.filter((f) => f.cityCheck.startsWith('TODO')).length} also have a doubtful city folder; reports/slug-fixes.csv written.`)

  if (EXECUTE) {
    const file = path.join(ROOT, `scripts/output/backups/phase11-01-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(fixes, null, 1))
    for (const f of fixes) await pool.query('UPDATE venues SET slug=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND slug=$3', [f.newSlug, f.id, f.oldSlug])
    const rewritten = rewriteInternalLinks(fixes)
    console.log(`Rewrote ${rewritten} internal link(s) in source files to the new URLs.`)
    const added = appendRedirects(fixes.map((f) => ({ source: `${BASE}/${f.city}/${f.oldSlug}`, destination: `${BASE}/${f.city}/${f.newSlug}`, permanent: true })))
    console.log(`APPLIED. ${added} redirects added. Undo: --rollback=${path.relative(ROOT, file)} --execute`)
  } else {
    console.log(`Internal links in source files that would be rewritten: ${rewriteInternalLinks(fixes, false)}`)
    console.log('DRY RUN: nothing written to the database or data/redirects.json. Re-run with --execute.')
  }
} finally {
  await pool.end()
}
