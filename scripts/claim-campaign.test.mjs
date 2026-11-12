import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as cc from './outreach/claim-campaign.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const hull = cc.CITIES.hull
const textTemplate = fs.readFileSync(path.join(ROOT, hull.template), 'utf8')
const htmlTemplate = fs.readFileSync(path.join(ROOT, hull.html_template), 'utf8')

const row = (over = {}) => ({
  venue_id: '1', venue_name: "Let's Play Hull", slug: 'let-s-play', city_slug: 'hull', email: 'info@letsplayhull.com', claimed_by_owner: 'false', ...over,
})
const ctx = (over = {}) => ({
  includePlaceholders: false, allowDuplicateEmail: false, suppressed: new Set(), excluded: new Set(),
  sentVenueIds: new Set(), recentlyContacted: new Set(), sendgridSuppressed: null, ...over,
})

test('the Hull letter matches its config, in both the text and HTML versions', () => {
  assert.deepEqual(cc.checkLetterMatchesConfig(textTemplate, hull), [])
  assert.deepEqual(cc.checkLetterMatchesConfig(htmlTemplate, hull), [])
  assert.ok(cc.checkLetterMatchesConfig(textTemplate.replace('4,576', '4,600'), hull).length > 0, 'a drifted figure is caught')
})

test('the letter makes no promise the free dashboard cannot keep', () => {
  for (const banned of [/unlock|elevate|seamless|don't miss out|hope this finds you well/i, /lead notification|verified badge|respond to reviews|extra photos/i]) {
    assert.doesNotMatch(textTemplate, banned)
  }
  assert.match(textTemplate, /reply with the link and I'll add a Book Now button/)
  assert.match(textTemplate, /isn't in the dashboard yet/)
  assert.match(textTemplate, /Hull page \(https:\/\/www\.softplaynearme\.co\.uk\/soft-play\/hull\) appeared 4,576 times in Google searches between 1 August and 31 October 2026\./, 'the figure is about the city page and states its window')
  assert.doesNotMatch(textTemplate, /\bsearches for\b|your (own )?(listing|venue) (appeared|had)/, 'never presented as a venue-level figure')
  assert.doesNotMatch(textTemplate, /average position|clicked through/, 'position and click figures were removed from the letter')
  assert.match(textTemplate, /^Hi \{\{venue_name\}\} team,\n\nHow are you\? I hope business is good!\n\nI'm David,/, 'warm opening')
})

test('rendering fills every token, escapes HTML in names, and encodes the claim URL', () => {
  const [r] = cc.toRecipients([row({ venue_name: 'Tom & Jerry <Play> "Barn"' })], 'hull')
  const m = cc.renderEmail({ textTemplate, htmlTemplate, city: hull, recipient: r, unsubscribe: '<%asm_group_unsubscribe_raw_url%>', postal: '1 Example Street, Hull HU1 1AA' })
  assert.deepEqual(cc.unresolvedTokens(m.text), [])
  assert.deepEqual(cc.unresolvedTokens(m.html), [])
  assert.match(m.subject, /^Tom & Jerry <Play> "Barn" is on our Hull page$/)
  assert.match(m.html, /Tom &amp; Jerry &lt;Play&gt; &quot;Barn&quot; team/)
  assert.match(m.text, /unsubscribe link: <%asm_group_unsubscribe_raw_url%>/)
  assert.match(r.claim_url, /^https:\/\/www\.softplaynearme\.co\.uk\/add-venue\?venue=Tom%20%26%20Jerry%20%3CPlay%3E%20%22Barn%22&city=hull&slug=let-s-play&utm_source=email&utm_campaign=claim-hull$/)
  assert.equal(cc.renderEmail({ textTemplate, htmlTemplate, city: hull, recipient: r, unsubscribe: 'u', postal: 'p', subjectPrefix: '[TEST] ' }).subject.startsWith('[TEST] '), true)
})

test('skip rules: placeholder, claimed, suppressed, duplicate same-day, already sent, recent, SendGrid suppressions', () => {
  const rows = cc.toRecipients([
    row({ venue_id: '1' }),
    row({ venue_id: '2', email: 'info@mysite.com' }),
    row({ venue_id: '3', email: 'a@x.co.uk', claimed_by_owner: 'true' }),
    row({ venue_id: '4', email: 'b@x.co.uk' }),
    row({ venue_id: '5', email: 'b@x.co.uk' }),
    row({ venue_id: '6', email: 'c@x.co.uk' }),
    row({ venue_id: '7', email: 'd@x.co.uk' }),
    row({ venue_id: '8', email: 'e@x.co.uk' }),
    row({ venue_id: '9', email: 'not-an-email' }),
  ], 'hull')
  const { send, skipped } = cc.classify(rows, ctx({
    suppressed: new Set(['c@x.co.uk']),
    sentVenueIds: new Set(['7']),
    sendgridSuppressed: new Map([['e@x.co.uk', 'bounce']]),
  }))
  assert.deepEqual(send.map((r) => r.venue_id), ['1', '4'])
  const reasons = Object.fromEntries(skipped.map((s) => [s.r.venue_id, s.reason]))
  assert.match(reasons['2'], /placeholder/)
  assert.match(reasons['3'], /already claimed/)
  assert.match(reasons['5'], /same email on the same day/)
  assert.match(reasons['6'], /suppression list/)
  assert.match(reasons['7'], /already sent/)
  assert.match(reasons['8'], /SendGrid suppressions \(bounce\)/)
  assert.match(reasons['9'], /invalid/)
  assert.equal(cc.classify(rows.slice(1, 2), ctx({ includePlaceholders: true })).send.length, 1)
  assert.equal(cc.classify([rows[3], rows[4]], ctx({ allowDuplicateEmail: true })).send.length, 2)
  assert.equal(cc.classify(rows.slice(0, 1), ctx({ recentlyContacted: new Set(['info@letsplayhull.com']) })).send.length, 0)
})

test('warm-up caps and the SendGrid payload (tracking off, ASM group, reply-to)', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(cc.dayCapFor), [20, 40, 80, 120, 200, 200, 200])
  const p = cc.buildPayload({ to: 'x@y.co.uk', from: 'david@softplaynearme.co.uk', replyTo: 'david@softplaynearme.co.uk', name: 'David', subject: 's', text: 't', html: 'h', groupId: '123', city: 'hull', venueId: 14, kind: 'campaign' })
  assert.equal(p.asm.group_id, 123)
  assert.deepEqual(p.tracking_settings, { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, subscription_tracking: { enable: false } })
  assert.equal(p.reply_to.email, 'david@softplaynearme.co.uk')
  assert.deepEqual(p.content.map((c) => c.type), ['text/plain', 'text/html'])
})

test('--send and --test-to refuse to run without key, ASM group and postal address (and never reach the network)', () => {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME }
  const csv = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'claim-')), 'hull.csv')
  fs.writeFileSync(csv, 'venue_id,venue_name,slug,city_slug,email,claimed_by_owner\n1,Test Venue,test-venue,hull,a@b.co.uk,false\n')
  for (const flag of [['--send'], ['--test-to', 'someone@example.co.uk']]) {
    const r = spawnSync('node', ['scripts/outreach/claim-campaign.mjs', '--city', 'hull', '--csv', csv, ...flag], { cwd: ROOT, env, encoding: 'utf8' })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /Refusing to send/)
    assert.match(r.stderr, /SENDGRID_API_KEY/)
    assert.match(r.stderr, /SENDGRID_UNSUBSCRIBE_GROUP_ID_OUTREACH/)
    assert.match(r.stderr, /POSTAL_ADDRESS/)
  }
  const dry = spawnSync('node', ['scripts/outreach/claim-campaign.mjs', '--city', 'hull', '--csv', csv], { cwd: ROOT, env, encoding: 'utf8' })
  assert.equal(dry.status, 0)
  assert.match(dry.stdout, /DRY RUN — nothing is sent/)
})
