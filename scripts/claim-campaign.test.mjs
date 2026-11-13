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

test('a venue listed on another hub is skipped: the Hull letter quotes the Hull page only', () => {
  const rows = cc.toRecipients([
    row({ venue_id: '1' }),
    row({ venue_id: '2', email: 'a@x.co.uk', city_slug: 'beverley', slug: 'let-loose-yorkshire' }),
    row({ venue_id: '3', email: 'b@x.co.uk', city_slug: 'scunthorpe', slug: 'play-avenue-ltd' }),
  ], 'hull')
  const { send, skipped } = cc.classify(rows, ctx({ cityName: 'Hull', listingPrefix: 'https://www.softplaynearme.co.uk/soft-play/hull/' }))
  assert.deepEqual(send.map((r) => r.venue_id), ['1'])
  assert.match(skipped.find((s) => s.r.venue_id === '2').reason, /needs a letter of its own/)
  assert.match(skipped.find((s) => s.r.venue_id === '3').reason, /Hull letter quotes the Hull page/)
})

test('a withdrawn-ISP address (Karoo) is flagged, not dropped', () => {
  assert.equal(cc.isLikelyStale('info@kgvcottingham.karoo.co.uk'), true)
  assert.equal(cc.isLikelyStale('info@letsplayhull.com'), false)
  assert.equal(cc.classify(cc.toRecipients([row({ email: 'info@kgvcottingham.karoo.co.uk' })], 'hull'), ctx()).send.length, 1)
})

test('warm-up caps and the SendGrid payload (tracking off, ASM group, reply-to)', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(cc.dayCapFor), [20, 40, 80, 120, 200, 200, 200])
  const p = cc.buildPayload({ to: 'x@y.co.uk', from: 'david@softplaynearme.co.uk', replyTo: 'david@softplaynearme.co.uk', name: 'David', subject: 's', text: 't', html: 'h', groupId: '123', city: 'hull', venueId: 14, kind: 'campaign' })
  assert.equal(p.asm.group_id, 123)
  assert.deepEqual(p.tracking_settings, { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, subscription_tracking: { enable: false } })
  assert.equal(p.reply_to.email, 'david@softplaynearme.co.uk')
  assert.deepEqual(p.content.map((c) => c.type), ['text/plain', 'text/html'])
})

test('the logo banner is an inline attachment the HTML points at, and only attached when used', () => {
  assert.match(htmlTemplate, /<img src="cid:spnm-logo" alt="Soft Play Near Me"/)
  assert.doesNotMatch(textTemplate, /cid:/)
  const base = { to: 'x@y.co.uk', from: 'david@softplaynearme.co.uk', replyTo: 'david@softplaynearme.co.uk', name: 'David', subject: 's', text: 't', groupId: '1', city: 'hull', venueId: 1, kind: 'test' }
  const withLogo = cc.buildPayload({ ...base, html: htmlTemplate })
  assert.equal(withLogo.attachments.length, 1)
  assert.equal(withLogo.attachments[0].content_id, 'spnm-logo')
  assert.equal(withLogo.attachments[0].disposition, 'inline')
  assert.equal(withLogo.attachments[0].type, 'image/png')
  assert.ok(Buffer.from(withLogo.attachments[0].content, 'base64').subarray(1, 4).toString() === 'PNG')
  assert.ok(withLogo.attachments[0].content.length < 120_000, 'keep the email light')
  assert.equal(cc.buildPayload({ ...base, html: '<p>no logo</p>' }).attachments, undefined)
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

// ── Birmingham ─────────────────────────────────────────────────────────────────────────────
const bham = cc.CITIES.birmingham
const bText = fs.readFileSync(path.join(ROOT, bham.template), 'utf8')
const bHtml = fs.readFileSync(path.join(ROOT, bham.html_template), 'utf8')
const bCtx = (over = {}) => ctx({
  cityName: 'Birmingham', listingPrefix: 'https://www.softplaynearme.co.uk/soft-play/birmingham/',
  districts: new Set(bham.postcode_districts), hold: bham.hold, includeHeld: false, ...over,
})
const bRow = (over = {}) => ({ venue_id: '400', venue_name: "Mini Me Children's Role Play Centre and Cafe", slug: 'mini-me', city_slug: 'birmingham', email: 'info@minimeroleplay.com', postcode: 'B72 1PL', claimed_by_owner: 'false', ...over })

test('the Birmingham letter matches its config (text and HTML) and carries the audit figures, nothing more', () => {
  assert.deepEqual(cc.checkLetterMatchesConfig(bText, bham), [])
  assert.deepEqual(cc.checkLetterMatchesConfig(bHtml, bham), [])
  assert.equal(bham.impressions, 2812)
  assert.match(bText, /Birmingham page \(https:\/\/www\.softplaynearme\.co\.uk\/soft-play\/birmingham\) appeared 2,812 times in Google searches between 1 August and 31 October 2026\./)
  assert.doesNotMatch(bText, /average position|clicked through|0\.21|\bsix\b people/i, 'position and click figures stay out, as in the approved Hull letter')
  assert.doesNotMatch(bText, /Hull|4,576/, 'no Hull figures or names')
  assert.doesNotMatch(bText, /unlock|elevate|seamless|don't miss out|hope this finds you well|lead notification|verified badge|respond to reviews|extra photos/i)
  assert.match(bText, /^Hi \{\{venue_name\}\} team,\n\nHow are you\? I hope business is good!\n\nI'm David,/)
  assert.match(bText, /reply with the link and I'll add a Book Now button/)
  assert.match(bText, /isn't in the dashboard yet/)
  assert.match(bText, /free/)
  assert.match(bText, /two working days/)
  assert.match(bText, /up to 10/)
  assert.ok(cc.checkLetterMatchesConfig(bText.replace('2,812', '2,800'), bham).length > 0, 'a drifted figure is caught')
})

test('the Birmingham letter is its own letter, not the Hull body with the city swapped', () => {
  const swapped = textTemplate.replaceAll('Hull', 'Birmingham').replace('4,576', '2,812')
  assert.notEqual(bText, swapped)
  assert.match(bText, /Listings are built from public information/)
  assert.doesNotMatch(textTemplate, /Listings are built from public information/)
})

test('the Birmingham letter renders cleanly, with the Birmingham subject and utm tag', () => {
  const [r] = cc.toRecipients([bRow()], 'birmingham')
  const m = cc.renderEmail({ textTemplate: bText, htmlTemplate: bHtml, city: bham, recipient: r, unsubscribe: '<%asm_group_unsubscribe_raw_url%>', postal: '1 Example Street, Hessle HU13 0AA' })
  assert.deepEqual(cc.unresolvedTokens(m.text), [])
  assert.deepEqual(cc.unresolvedTokens(m.html), [])
  assert.match(m.subject, /is on our Birmingham page$/)
  assert.match(r.claim_url, /&city=birmingham&slug=mini-me&utm_source=email&utm_campaign=claim-birmingham$/)
  assert.match(bHtml, /<img src="cid:spnm-logo"/)
})

test('Birmingham postcode check: only Birmingham-city districts are emailed; a missing or ambiguous postcode is not', () => {
  const rows = cc.toRecipients([
    bRow({ venue_id: '400' }),                                                                   // B72 Sutton Coldfield
    bRow({ venue_id: '415', email: 'hello@thelittlehighstreet.com', postcode: 'B17 9PA' }),      // Harborne
    bRow({ venue_id: '406', email: 'info@partyandplay.uk', postcode: 'B23 6RP' }),              // Erdington
    bRow({ venue_id: '407', email: 'a@x.co.uk', postcode: 'WV1 2UN' }),                         // Wolverhampton
    bRow({ venue_id: '413', email: 'b@x.co.uk', postcode: 'B90 3AH' }),                         // Shirley (Solihull)
    bRow({ venue_id: '414', email: 'c@x.co.uk', postcode: 'B91 3SX' }),                         // Solihull
    bRow({ venue_id: '419', email: 'd@x.co.uk', postcode: 'B71 3SZ' }),                         // West Bromwich
    bRow({ venue_id: '409', email: 'e@x.co.uk', postcode: 'B47 5JW' }),                         // Wythall
    bRow({ venue_id: '431', email: 'f@x.co.uk', postcode: 'B45 8PZ' }),                         // Barnt Green / Rubery: ambiguous
    bRow({ venue_id: '900', email: 'g@x.co.uk', postcode: 'B37 5TL' }),                         // Chelmsley Wood: ambiguous
    bRow({ venue_id: '901', email: 'h@x.co.uk', postcode: '' }),                                // no postcode
  ], 'birmingham')
  const { send, skipped } = cc.classify(rows, bCtx())
  assert.deepEqual(send.map((r) => r.venue_id), ['400', '415', '406'])
  const why = Object.fromEntries(skipped.map((s) => [s.r.venue_id, s.reason]))
  for (const id of ['407', '413', '414', '419', '409', '431', '900']) assert.match(why[id], /outside the Birmingham area/, id)
  assert.match(why['901'], /no usable postcode/)
})

test('a Birmingham-tagged venue listed under another hub is still skipped (listing prefix), and a postcode-less CSV cannot slip through', () => {
  const rows = cc.toRecipients([
    bRow({ venue_id: '1', city_slug: 'wolverhampton', slug: 'go-kidz-go', postcode: 'B23 6RP', email: 'a@x.co.uk' }),
    bRow({ venue_id: '2', postcode: undefined, email: 'b@x.co.uk' }),
  ], 'birmingham')
  const { send, skipped } = cc.classify(rows, bCtx())
  assert.equal(send.length, 0)
  assert.match(skipped.find((s) => s.r.venue_id === '1').reason, /needs a letter of its own/)
  assert.match(skipped.find((s) => s.r.venue_id === '2').reason, /no usable postcode/)
})

test('Little Tinkers (store temporarily closed) is held until released with --include-held', () => {
  const r = cc.toRecipients([bRow({ venue_id: '2013', venue_name: 'Little Tinkers Birmingham', slug: 'little-tinkers-birmingham', email: 'info@littletinkers.biz', postcode: 'B29 5PT' })], 'birmingham')
  const held = cc.classify(r, bCtx())
  assert.equal(held.send.length, 0)
  assert.match(held.skipped[0].reason, /^held: Little Tinkers Birmingham — .*temporarily closed/)
  assert.equal(cc.classify(r, bCtx({ includeHeld: true })).send.length, 1)
})

test('the postcode rule in the Birmingham SQL and the one in the script agree, district by district', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'scripts/sql/birmingham-area-2026-11-12/03-birmingham-claim-recipients.sql'), 'utf8')
  const src = sql.match(/~ '(\^B\(\?:[^']+)'/)?.[1]
  assert.ok(src, 'the postcode regex is in the SQL')
  const re = new RegExp(src.replace(/\\s/g, '\\s'))
  const allowed = new Set(bham.postcode_districts)
  for (let n = 1; n <= 99; n++) {
    const pc = `B${n} 1AA`
    assert.equal(re.test(pc), allowed.has(`B${n}`), `B${n}`)
  }
  for (const pc of ['WV1 2UN', 'WS11 0XE', 'DY10 1BP', 'CV5 8AU', 'M1 1AA', 'BA1 1AA', 'BB1 1AA']) assert.equal(re.test(pc), false, pc)
  assert.equal(re.test('B72 1PL'), true)
  assert.equal(re.test('B721PL'), true)
})

test('the claim-wave SQL files are read-only SELECTs with the visible-type, unclaimed and email filters', () => {
  for (const f of ['scripts/sql/birmingham-area-2026-11-12/03-birmingham-claim-recipients.sql', 'scripts/sql/outreach/city-claim-recipients.sql', 'scripts/sql/outreach/city-claim-readiness.sql']) {
    const sql = fs.readFileSync(path.join(ROOT, f), 'utf8')
    assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i, f)
    assert.match(sql, /is_active = true/, f)
    assert.match(sql, /venue_type IS NULL OR v\.venue_type IN \('indoor', 'pub'\)/, f)
  }
  const gen = fs.readFileSync(path.join(ROOT, 'scripts/sql/outreach/city-claim-recipients.sql'), 'utf8')
  assert.match(gen, /v\.city_slug = :'city'/)
  assert.doesNotMatch(gen.replace(/--.*$/gm, ''), /lead_notification_email/)
})

test('Birmingham dry run from a CSV: sends nothing, shows who would be emailed and why others are skipped', () => {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME }
  const csv = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'claim-b-')), 'birmingham.csv')
  fs.writeFileSync(csv, [
    'venue_id,venue_name,slug,city_slug,email,website,address,postcode,venue_type,claimed_by_owner',
    '400,Mini Me,mini-me,birmingham,info@minimeroleplay.com,,,B72 1PL,indoor,false',
    '407,Go Kidz Go,go-kidz-go,birmingham,1gokidzgo@gmail.com,,,WV1 2UN,indoor,false',
    '2013,Little Tinkers Birmingham,little-tinkers-birmingham,birmingham,info@littletinkers.biz,,,B29 5PT,indoor,false',
  ].join('\n') + '\n')
  const r = spawnSync('node', ['scripts/outreach/claim-campaign.mjs', '--city', 'birmingham', '--csv', csv], { cwd: ROOT, env, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /DRY RUN — nothing is sent\. City: Birmingham/)
  assert.match(r.stdout, /3 rows in the CSV: 1 would be emailed, 2 skipped/)
  assert.match(r.stdout, /#400 {2}Mini Me/)
  assert.match(r.stdout, /#407 .*outside the Birmingham area/)
  assert.match(r.stdout, /#2013 .*held:/)
  assert.match(r.stdout, /appeared 2,812 times/)
  const live = spawnSync('node', ['scripts/outreach/claim-campaign.mjs', '--city', 'birmingham', '--csv', csv, '--send'], { cwd: ROOT, env, encoding: 'utf8' })
  assert.equal(live.status, 1)
  assert.match(live.stderr, /Refusing to send/)
})

// ── Every city's letter ────────────────────────────────────────────────────────────────────
test('every city config has a text and HTML letter that match it, with no other city named and no promise the dashboard cannot keep', () => {
  const names = Object.values(cc.CITIES).map((c) => c.name)
  for (const c of Object.values(cc.CITIES)) {
    for (const file of [c.template, c.html_template]) {
      const body = fs.readFileSync(path.join(ROOT, file), 'utf8')
      assert.deepEqual(cc.checkLetterMatchesConfig(body, c), [], file)
      for (const other of names.filter((n) => n !== c.name)) assert.doesNotMatch(body, new RegExp(`\\b${other}\\b`), `${file} names ${other}`)
      assert.doesNotMatch(body, /average position|clicked through|unlock|elevate|seamless|don't miss out|hope this finds you well|lead notification|verified badge|respond to reviews|extra photos/i, file)
      assert.match(body, /How are you\? I hope business is good!/, file)
      assert.match(body, /reply with the link and I'll add a Book Now button/, file)
      assert.match(body, /\{\{unsubscribe_url\}\}/, file)
      assert.match(body, /\{\{POSTAL_ADDRESS\}\}/, file)
    }
  }
  const bodies = Object.values(cc.CITIES).map((c) => fs.readFileSync(path.join(ROOT, c.template), 'utf8'))
  assert.equal(new Set(bodies).size, bodies.length, 'each city has its own letter')
})

test('Beverley: its own figure, HU17 only, and the Hull-area listing guard', () => {
  const bev = cc.CITIES.beverley
  assert.equal(bev.impressions, 1697)
  const c = ctx({ cityName: 'Beverley', listingPrefix: 'https://www.softplaynearme.co.uk/soft-play/beverley/', districts: new Set(bev.postcode_districts), hold: null })
  const r = (over) => ({ venue_id: '21', venue_name: 'Let Loose Yorkshire', slug: 'let-loose-yorkshire', city_slug: 'beverley', email: 'info@letlooseyorkshire.co.uk', postcode: 'HU17 0RS', claimed_by_owner: 'false', ...over })
  const { send, skipped } = cc.classify(cc.toRecipients([
    r({}),
    r({ venue_id: '192', slug: 'jack-in-the-box-soft-play-and-role-play', email: 'admin@jackintheboxclub.co.uk', postcode: 'HU17 0LF' }),
    r({ venue_id: '78', slug: 'sweet-soft-play-hull', email: 'a@x.co.uk', postcode: 'HU17 7RB' }),
    r({ venue_id: '47', slug: 'cottingham', email: 'b@x.co.uk', postcode: 'HU16 4EL' }),
    r({ venue_id: '14', slug: 'adventure-play-town-hull', city_slug: 'hull', email: 'c@x.co.uk', postcode: 'HU5 1SN' }),
  ], 'beverley'), c)
  assert.deepEqual(send.map((x) => x.venue_id), ['21', '192', '78'])
  assert.match(skipped.find((s) => s.r.venue_id === '47').reason, /outside the Beverley area/)
  assert.match(skipped.find((s) => s.r.venue_id === '14').reason, /needs a letter of its own/)
})
