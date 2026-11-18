// Owner edits and photo uploads must require an approved claim (the access token is issued
// as soon as anyone submits a claim form).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

for (const f of ['app/api/dashboard/[token]/update/route.ts', 'app/api/dashboard/[token]/upload/route.ts']) {
  test(`${f} rejects claims that are not approved`, () => {
    const src = fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.match(src, /SELECT city_slug, venue_slug, status FROM venue_claims/)
    assert.match(src, /if \(status !== 'approved'\) \{\s*return NextResponse\.json\([\s\S]*?status: 403/)
    assert.ok(src.indexOf("status !== 'approved'") < src.indexOf('UPDATE venues') || !src.includes('UPDATE venues'), 'gate runs before any write')
  })
}
