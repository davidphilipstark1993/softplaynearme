// phase18-01 (AdSense clean-up): the plan's safety rules, and the 410s it produces.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerTsResolver } from './ts-resolve-hook.mjs'
import { buildPlan, isJunk, PLACEHOLDER_IMAGE } from './migrations/phase18-01-adsense-cleanup.mjs'

registerTsResolver()
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))

const row = (over) => ({ id: 1, name: 'X', slug: 'x', city_slug: 'hull', venue_type: 'indoor', is_active: true, claimed_by_owner: false, plan: 'free', ...over })

test('playground/hire/retail rows are retired, unless an owner claimed or pays for them', () => {
  const p = buildPlan([
    row({ id: 9001, venue_type: 'park-playground' }),
    row({ id: 9002, venue_type: 'mobile-hire', claimed_by_owner: true }),
    row({ id: 9003, venue_type: 'retail', plan: 'premium' }),
    row({ id: 9004, venue_type: 'park-playground', is_active: false }),
  ])
  assert.deepEqual(p.retire.map((x) => x.row.id), [9001])
  assert.deepEqual(p.heldForOwner.map((r) => r.id).sort(), [9002, 9003])
})

test('a hand-reviewed row is only touched if its name still matches', () => {
  const plan = read('scripts/migrations/phase18-01-data.json')
  const d = plan.deactivate[0]
  const ok = buildPlan([row({ id: d.id, name: d.name })])
  assert.ok(ok.retire.some((x) => x.row.id === d.id))
  const renamed = buildPlan([row({ id: d.id, name: 'Something Else Entirely' })])
  assert.ok(!renamed.retire.some((x) => x.row.id === d.id))
  assert.ok(renamed.missing.some((m) => m.startsWith(`${d.id}:`)))
})

test('junk values are nulled, real ones kept', () => {
  assert.ok(isJunk('nan') && isJunk('https://nan') && isJunk(' undefined '))
  assert.ok(!isJunk('https://example.co.uk'))
  assert.ok(PLACEHOLDER_IMAGE.test('https://ssl.gstatic.com/local/servicebusiness/default_user.png'))
  const p = buildPlan([row({ id: 9100, website: 'https://nan', phone: '01482 000000', main_image_url: 'https://ssl.gstatic.com/local/servicebusiness/default_user.png' })])
  assert.deepEqual(p.junk[0].set, { website: null, main_image_url: null })
})

test('every gone URL is out of the static export and out of the redirect sources', () => {
  const gone = read('data/gone.json').map((g) => g.path)
  const live = new Set(read('data/generated/venues.json').map((v) => `/soft-play/${v.townSlug}/${v.slug}`))
  const sources = new Set(read('data/redirects.json').map((r) => r.source))
  for (const g of gone) {
    assert.ok(!live.has(g), `${g} is gone but still in the export`)
    assert.ok(!sources.has(g), `${g} is gone and also redirected`)
  }
})

test('goneFor: retired URLs and old URLs that 301ed to them answer 410; redirectFor skips them', async () => {
  const { goneFor, redirectFor } = await import('../lib/redirects.ts')
  const gone = read('data/gone.json').map((g) => g.path)
  assert.ok(goneFor(gone[0]) && goneFor(gone[0] + '/'))
  const viaRedirect = read('data/redirects.json').find((r) => gone.includes(r.destination))
  assert.ok(viaRedirect, 'fixture: some old URL pointed at a retired venue')
  assert.ok(goneFor(viaRedirect.source))
  assert.equal(redirectFor(viaRedirect.source), null)
  assert.ok(!goneFor('/soft-play/hull'))
})
