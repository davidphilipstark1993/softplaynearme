// HTTP check of the phase 13-01 city moves against a running site.
//   BASE_URL=http://localhost:3000 node --test scripts/city-redirects.e2e.test.mjs
//   BASE_URL=https://www.softplaynearme.co.uk node --test scripts/city-redirects.e2e.test.mjs
// Skipped when BASE_URL is not set (so `npm test` stays offline).
//
// For 10 sample old URLs: exactly one 301 straight to the new URL; the new URL is a
// 200 whose canonical is itself.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.BASE_URL?.replace(/\/$/, '')
const moves = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/migrations/phase13-01-data.json'), 'utf8'))
const redirects = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/redirects.json'), 'utf8')).map((r) => [r.source, r.destination]))

// 10 fixed samples: a spread across the list, plus GSC URLs whose 301 was re-pointed
// (older slug-fix URL -> moved venue) so the "no chain" case is covered.
const picks = [0, 16, 33, 50, 66, 83, 100, 116, 133, 150].map((i) => moves[i])
const SAMPLES = [
  ...picks.slice(0, 8).map((m) => [`/soft-play/${m.from_city}/${m.from_slug}`, `/soft-play/${m.to_city}/${m.to_slug}`]),
  ['/soft-play/southend/places-leisure-eastleigh-portsmouth', redirects.get('/soft-play/southend/places-leisure-eastleigh-portsmouth')],
  ['/soft-play/colchester/harwich-green-play-area-ipswich', redirects.get('/soft-play/colchester/harwich-green-play-area-ipswich')],
]

const canonicalOf = (html) =>
  html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1] ?? html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/)?.[1]

for (const [oldUrl, newUrl] of SAMPLES) {
  test(`${oldUrl} -> 301 -> ${newUrl} -> 200, self-canonical`, { skip: !BASE && 'set BASE_URL to run' }, async () => {
    assert.ok(newUrl, `no redirect configured for ${oldUrl}`)
    const hop = await fetch(BASE + oldUrl, { redirect: 'manual' })
    assert.equal(hop.status, 301, `${oldUrl} answered ${hop.status}`)
    const location = new URL(hop.headers.get('location'), BASE)
    assert.equal(location.pathname, newUrl, 'redirects straight to the final URL')

    const page = await fetch(BASE + newUrl, { redirect: 'manual' })
    assert.equal(page.status, 200, `${newUrl} answered ${page.status} (a 3xx here would be a chain)`)
    const canonical = canonicalOf(await page.text())
    assert.ok(canonical, 'no canonical tag')
    assert.equal(new URL(canonical).pathname, newUrl, 'canonical points at itself')
  })
}
