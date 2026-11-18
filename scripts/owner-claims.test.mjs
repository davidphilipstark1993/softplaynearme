// Owner claim flow (phase 15-01): domain matching, sign-in tokens and sessions, owner data
// that a Google re-ingest can't overwrite, and page revalidation after a save.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { registerTsResolver } from './ts-resolve-hook.mjs'

const canStripTypes = process.features.typescript !== false && Number(process.versions.node.split('.')[0]) >= 22
registerTsResolver()
const skip = canStripTypes ? false : 'needs Node >= 22.18 (built-in TypeScript type stripping)'
const ROOT = new URL('..', import.meta.url)
const read = (f) => fs.readFileSync(new URL(f, ROOT), 'utf8')

// ── Domain matching ────────────────────────────────────────────────────────────────
test('domain match: www, subdomains and .co.uk all reduce to the registrable domain', { skip }, async () => {
  const { checkEmailAgainstWebsite: c, registrableDomain: r } = await import('../lib/claims/domain.ts')
  assert.equal(r('www.funplex.co.uk'), 'funplex.co.uk')
  assert.equal(r('shop.eu.funplex.co.uk'), 'funplex.co.uk')
  assert.equal(r('a.b.example.com'), 'example.com')
  assert.equal(r('co.uk'), null)
  assert.deepEqual(c('info@funplex.co.uk', 'https://www.funplex.co.uk/prices'), { match: true, domain: 'funplex.co.uk' })
  assert.equal(c('jo@mail.funplex.co.uk', 'funplex.co.uk').match, true, 'subdomain email')
  assert.equal(c('Jo@FunPlex.co.uk', 'HTTP://WWW.FUNPLEX.CO.UK').match, true, 'case-insensitive')
  assert.equal(c('owner@monkey-bizness.co.uk', 'http://www.monkey-bizness.co.uk/lewes').match, true)
})

test('domain match: webmail, other domains, platforms and missing websites go to manual review', { skip }, async () => {
  const { checkEmailAgainstWebsite: c } = await import('../lib/claims/domain.ts')
  assert.deepEqual(c('jo@gmail.com', 'https://funplex.co.uk'), { match: false, reason: 'webmail' })
  assert.deepEqual(c('jo@hotmail.co.uk', 'https://hotmail.co.uk'), { match: false, reason: 'webmail' }, 'webmail never matches, even its own site')
  assert.deepEqual(c('jo@otherplace.co.uk', 'https://funplex.co.uk'), { match: false, reason: 'different-domain' })
  assert.deepEqual(c('jo@funplex.com', 'https://funplex.co.uk'), { match: false, reason: 'different-domain' }, '.com is not .co.uk')
  assert.deepEqual(c('x@funplex.co.uk.evil.com', 'https://funplex.co.uk'), { match: false, reason: 'different-domain' }, 'suffix trick')
  assert.deepEqual(c('jo@simplybook.me', 'https://sensoryroomhire.simplybook.me/v2/'), { match: false, reason: 'platform-website' })
  assert.deepEqual(c('jo@facebook.com', 'https://www.facebook.com/funplex'), { match: false, reason: 'platform-website' })
  assert.deepEqual(c('jo@funplex.co.uk', null), { match: false, reason: 'no-website' })
  assert.deepEqual(c('not-an-email', 'https://funplex.co.uk'), { match: false, reason: 'invalid-email' })
})

// ── Tokens and sessions ────────────────────────────────────────────────────────────
test('sign-in tokens: random, stored only as a hash, expire after 24h, single use', { skip }, async () => {
  const t = await import('../lib/claims/tokens.ts')
  const a = t.newLoginToken(), b = t.newLoginToken()
  assert.notEqual(a.token, b.token)
  assert.equal(a.hash, t.hashToken(a.token))
  assert.notEqual(a.hash, a.token)
  assert.ok(a.token.length >= 40)
  const now = new Date('2026-11-18T12:00:00Z')
  assert.equal(t.LOGIN_TOKEN_TTL_MS, 24 * 3600 * 1000)
  assert.equal(t.isTokenUsable({ expires_at: '2026-11-19T11:59:00Z', used_at: null }, now), true)
  assert.equal(t.isTokenUsable({ expires_at: '2026-11-18T11:59:59Z', used_at: null }, now), false, 'expired')
  assert.equal(t.isTokenUsable({ expires_at: '2026-11-19T11:59:00Z', used_at: '2026-11-18T11:00:00Z' }, now), false, 'already used')
  assert.equal(t.isTokenUsable(null, now), false)
  // The DB consume is one atomic UPDATE: unused + unexpired, marked used in the same statement.
  const db = read('lib/claims/db.ts')
  assert.match(db, /UPDATE owner_login_tokens SET used_at = NOW\(\)\s+WHERE token_hash = \$1 AND used_at IS NULL AND expires_at > NOW\(\)\s+RETURNING claim_id/)
  assert.match(db, /\[hashToken\(token\)\]/, 'looked up by hash, never by the raw token')
})

test('owner session cookie: signed, tamper-proof, expires', { skip }, async () => {
  process.env.OWNER_SESSION_SECRET = 'test-secret'
  const t = await import('../lib/claims/tokens.ts')
  const v = t.createSessionValue(42, 1_000)
  assert.equal(t.readSessionValue(v, 2_000), 42)
  assert.equal(t.readSessionValue(v.replace(/^42\./, '43.'), 2_000), null, 'changing the claim id breaks the signature')
  assert.equal(t.readSessionValue(v, 1_000 + t.SESSION_TTL_MS + 1), null, 'expired')
  assert.equal(t.readSessionValue('garbage', 2_000), null)
})

// ── Owner data vs Google re-ingest ─────────────────────────────────────────────────
test('a Places re-ingest cannot overwrite owner data: no script writes venue_owner_data', () => {
  const offenders = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (!['node_modules', 'output', 'fixtures'].includes(e.name)) walk(p); continue }
      if (!/\.(mjs|js|ts)$/.test(e.name) || /\.test\.mjs$/.test(e.name)) continue
      const src = fs.readFileSync(p, 'utf8')
      if (/venue_owner_data/.test(src) && !p.includes('phase15-01-owner-claims')) offenders.push(p)
    }
  }
  walk(new URL('scripts', ROOT).pathname)
  assert.deepEqual(offenders, [], 'ingest/enrichment scripts must never touch venue_owner_data')
  for (const f of ['scripts/fetch-google-ratings.mjs', 'scripts/enrich-venues.mjs', 'scripts/enrich-seo-all.mjs', 'scripts/rebuild-static-json.mjs']) {
    assert.ok(!/owner_description|venue_owner_data/.test(read(f)), f)
  }
})

test('owner data wins on render, before and after the base row is re-ingested', { skip }, async () => {
  const { mergeOwnerData } = await import('../lib/ownerData.ts')
  const owner = {
    owner_description: 'Our own words.',
    prices: { under_1s: 2.5, under_5s: 6, over_5s: 8, adults: 0 },
    age_min: 0, age_max: 10,
    opening_hours_override: { monday: 'closed', tuesday: { open: '09:30', close: '17:00' } },
    facilities: { cafe: true, parking: false },
    sen_sessions: 'Quiet session Sundays 8–9am',
  }
  const base = { description: 'Generated text', price_from: 9, cafe: false, parking: true, opening_hours: { weekday_text: ['Monday: 9 AM – 6 PM'] } }
  const reIngested = { ...base, description: 'Re-generated text after enrich-seo-all', price_from: 11, cafe: false, opening_hours: { weekday_text: ['Monday: 10 AM – 5 PM'] } }
  for (const b of [base, reIngested]) {
    const m = mergeOwnerData(b, owner)
    assert.equal(m.description, 'Our own words.')
    assert.equal(m.price_from, 2.5)
    assert.equal(m.price_to, 8)
    assert.equal(m.cafe, true)
    assert.equal(m.parking, false, "an owner's explicit 'no' wins too")
    assert.equal(m.age_range_max, 10)
    assert.deepEqual(m.opening_hours, { monday: 'closed', tuesday: { open: '09:30', close: '17:00' } })
    assert.equal(m.has_sen_sessions, true)
  }
  assert.deepEqual(mergeOwnerData(base, null), base, 'no owner data: base untouched')
})

// ── Validation, completeness, ranking ──────────────────────────────────────────────
test('owner input is validated: limits, formats, only known fields', { skip }, async () => {
  const { validateOwnerData: v, ownerCompleteness, listingBoost } = await import('../lib/ownerData.ts')
  assert.ok(v({ owner_description: 'x'.repeat(601) }).errors.length)
  assert.ok(v({ prices: { under_5s: -1 } }).errors.length)
  assert.ok(v({ age_min: 9, age_max: 3 }).errors.length)
  assert.ok(v({ opening_hours_override: { monday: { open: '18:00', close: '09:00' } } }).errors.length)
  assert.ok(v({ photos: ['https://evil.example.com/x.jpg'] }).errors.length, 'only our own uploads')
  const ok = v({ prices: { under_5s: '6.5', notes: ' term time ' }, facilities: { cafe: true, junk: 1 }, hacker: 'x' })
  assert.deepEqual(ok, { data: { prices: { under_5s: 6.5, notes: 'term time' }, facilities: { cafe: true } }, errors: [] })
  assert.equal(ownerCompleteness({}), 0)
  assert.equal(ownerCompleteness({ owner_description: 'a', prices: { adults: 0 } }), 20)
  assert.equal(listingBoost({}), 0)
  assert.equal(listingBoost({ claimed_by_owner: true, owner_completeness: 100 }), 0.2, 'never more than 0.2 stars')
})

// ── Revalidation after a save ──────────────────────────────────────────────────────
test('saving owner data revalidates the venue page and its hub', { skip }, async () => {
  const { venuePathsFor } = await import('../lib/claims/paths.ts')
  assert.deepEqual(venuePathsFor('worthing', 'hope-hive'), ['/soft-play/worthing/hope-hive', '/soft-play/worthing'])
  const route = read('app/api/owner/data/route.ts')
  assert.match(route, /const changed = await saveOwnerData\([\s\S]*?if \(changed\.length\) revalidateVenue\(claim\.city_slug, claim\.venue_slug\)/)
  assert.match(route, /if \(!isVerifiedClaim\(claim\) \|\| !claim\.venue_id\)[\s\S]*?status: 403/, 'unverified claims cannot save')
  assert.match(read('lib/claims/session.ts'), /for \(const p of paths\) revalidatePath\(p\)/)
  assert.match(read('app/api/admin/owners/route.ts'), /revertEdit[\s\S]*?revalidateVenue/, 'admin revert refreshes too')
})
