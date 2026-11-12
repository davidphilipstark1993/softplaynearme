#!/usr/bin/env node
/**
 * Venue-claim outreach: one city at a time, through the existing SendGrid setup.
 *
 * B2B email about a public listing that already exists, sent under legitimate interest with a
 * clear opt-out. Not the newsletter and not the "you're newly listed, please verify" email.
 *
 *   node scripts/outreach/claim-campaign.mjs --city hull                    DRY RUN (default): render everything, send nothing
 *   node scripts/outreach/claim-campaign.mjs --city hull --test-to me@x.com  send ONE real [TEST] email to that address, then stop
 *   node scripts/outreach/claim-campaign.mjs --city hull --send             the real batch (only after the test has been eyeballed)
 *   node scripts/outreach/claim-campaign.mjs --city hull --send --limit 5
 *   node scripts/outreach/claim-campaign.mjs --city hull --csv path/to.csv
 *
 * Options: --day-cap N, --max-per-minute N (default 8), --allow-duplicate-email,
 *          --include-placeholders, --exclude-file path (extra addresses to skip, one per line),
 *          --i-have-confirmed-sender (skip the SendGrid verified-sender lookup, see below).
 *
 * Env (names only; values are never printed or logged):
 *   SENDGRID_API_KEY (or SPNM_SENDGRID_API_KEY if that is empty), SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME,
 *   SENDGRID_UNSUBSCRIBE_GROUP_ID_OUTREACH (or SENDGRID_ASM_GROUP_ID), POSTAL_ADDRESS.
 *
 * Files (all under the gitignored contacts/ folder):
 *   contacts/claim-campaign/{city}.csv        recipients (the SQL in the venue-claim email report)
 *   contacts/claim-campaign/sent.csv          one row per attempt: timestamp,venue_id,email,city,message_id,status,subject,kind
 *   contacts/claim-campaign/suppression.txt   addresses that said "no thanks" (add by hand), one per line
 *   contacts/claim-campaign/warmup.json       per-day send counts for the warm-up caps
 *
 * The copy lives in scripts/outreach/templates/claim-{city}.txt / .html. Each city has its own letter
 * and its own config block below; every figure in a letter must be the exact figure from the CTR audit,
 * and this script refuses to run if a letter and its config disagree.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const SITE = 'https://www.softplaynearme.co.uk'
const DATA_DIR = path.join(ROOT, 'contacts', 'claim-campaign')

// ── City configs ─────────────────────────────────────────────────────────────────────────
// Impressions are "times the city page appeared in Google searches" — never "searches", never per venue.
export const CITIES = {
  hull: {
    slug: 'hull',
    name: 'Hull',
    page_url: `${SITE}/soft-play/hull`,
    impressions: 4576,
    clicks: 9,
    clicks_words: 'Nine',
    ctr: '0.20%',
    avg_position: '31.29',
    date_range: '1 August and 31 October 2026',
    template: 'scripts/outreach/templates/claim-hull.txt',
    html_template: 'scripts/outreach/templates/claim-hull.html',
  },
}

export const SUBJECT = (venueName, city) => `${venueName} is on our ${city.name} page`

const PLACEHOLDER_DOMAINS = new Set(['mysite.com', 'example.com', 'example.org', 'email.com', 'test.com', 'domain.com', 'yourvenue.co.uk', 'yourdomain.com', 'yoursite.com'])
const EMAIL_OK = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/

// ── Pure helpers (exported for tests) ──────────────────────────────────────────────────────

/** Minimal CSV parser (quoted fields, doubled quotes, CRLF). Returns array of objects keyed by header. */
export function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQuotes = false
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  const [header, ...body] = rows
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

/** Same query string the listing page builds for its "Claim" button (encodeURIComponent), plus UTM tags. */
export function claimUrl(venueName, citySlug, venueSlug) {
  return `${SITE}/add-venue?venue=${encodeURIComponent(venueName)}&city=${encodeURIComponent(citySlug)}&slug=${encodeURIComponent(venueSlug)}&utm_source=email&utm_campaign=claim-${citySlug}`
}

export const listingUrl = (citySlug, venueSlug) => `${SITE}/soft-play/${citySlug}/${venueSlug}`

export function emailDomain(email) {
  return email.split('@')[1]?.toLowerCase() ?? ''
}

export function isPlaceholderEmail(email) {
  return PLACEHOLDER_DOMAINS.has(emailDomain(email))
}

/** Rows of the recipient CSV -> recipients with computed URLs. Email comes from the `email` column. */
export function toRecipients(rows, citySlug) {
  return rows.map((r) => ({
    venue_id: r.venue_id,
    venue_name: r.venue_name,
    slug: r.slug,
    city_slug: r.city_slug || citySlug,
    email: (r.email ?? '').trim().toLowerCase(),
    claimed: String(r.claimed_by_owner ?? '').toLowerCase() === 'true',
    postcode: r.postcode ?? '',
    listing_url: listingUrl(r.city_slug || citySlug, r.slug),
    claim_url: claimUrl(r.venue_name, r.city_slug || citySlug, r.slug),
  }))
}

export function replaceTokens(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in values ? values[key] : m))
}

export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Render one email. `unsubscribe` is the ASM tag at send time, or a visible placeholder in a dry run.
 * Venue names go into HTML escaped; URLs are used as given (they are percent-encoded already).
 */
export function renderEmail({ textTemplate, htmlTemplate, city, recipient, unsubscribe, postal, subjectPrefix = '' }) {
  const base = { listing_url: recipient.listing_url, claim_url: recipient.claim_url, unsubscribe_url: unsubscribe, POSTAL_ADDRESS: postal }
  const text = replaceTokens(textTemplate, { ...base, venue_name: recipient.venue_name })
  const html = replaceTokens(htmlTemplate, {
    ...base,
    venue_name: escapeHtml(recipient.venue_name),
    listing_url: escapeHtml(recipient.listing_url),
    claim_url: escapeHtml(recipient.claim_url),
    POSTAL_ADDRESS: escapeHtml(postal),
  })
  return { subject: `${subjectPrefix}${SUBJECT(recipient.venue_name, city)}`, text, html }
}

export const unresolvedTokens = (s) => s.match(/\{\{\w+\}\}/g) ?? []

/** Every figure the letter does state must be the config's: impressions, date range, page URL. */
export function checkLetterMatchesConfig(text, city) {
  const problems = []
  const want = [
    [city.impressions.toLocaleString('en-GB'), 'impressions'],
    [city.page_url, 'city page URL'],
    [city.date_range, 'date range'],
  ]
  for (const [needle, label] of want) if (!text.includes(needle)) problems.push(`letter does not contain the config's ${label} (${needle})`)
  return problems
}

/** Warm-up: day 1 cap 20, then 40, 80, 120, 200 and 200 thereafter. `daysSent` = distinct earlier send days. */
export const WARMUP = [20, 40, 80, 120, 200]
export const dayCapFor = (daysSent) => WARMUP[Math.min(daysSent, WARMUP.length - 1)]

/**
 * Decide, for each recipient, send or skip-with-reason. Pure: all I/O state comes in as arguments.
 * Order of checks is the order of the reasons logged.
 */
export function classify(recipients, ctx) {
  const send = []
  const skipped = []
  const seenToday = new Set()
  const skip = (r, reason) => skipped.push({ r, reason })
  for (const r of recipients) {
    if (!EMAIL_OK.test(r.email)) { skip(r, 'invalid email format'); continue }
    if (r.claimed) { skip(r, 'already claimed'); continue }
    if (isPlaceholderEmail(r.email) && !ctx.includePlaceholders) { skip(r, `placeholder address (${emailDomain(r.email)}) — confirm it, then pass --include-placeholders`); continue }
    if (ctx.suppressed.has(r.email)) { skip(r, 'on the local suppression list (said no thanks / added by hand)'); continue }
    if (ctx.excluded.has(r.email)) { skip(r, 'on an exclude file (recent outreach / opted out)'); continue }
    if (ctx.sendgridSuppressed?.has(r.email)) { skip(r, `on SendGrid suppressions (${ctx.sendgridSuppressed.get(r.email)})`); continue }
    if (ctx.sentVenueIds.has(String(r.venue_id))) { skip(r, 'already sent for this campaign and venue_id'); continue }
    if (ctx.recentlyContacted.has(r.email)) { skip(r, 'contacted by SPNM outreach in the last 30 days'); continue }
    if (seenToday.has(r.email) && !ctx.allowDuplicateEmail) { skip(r, 'second venue with the same email on the same day (--allow-duplicate-email to override)'); continue }
    seenToday.add(r.email)
    send.push(r)
  }
  return { send, skipped }
}

// ── State on disk ──────────────────────────────────────────────────────────────────────────

const readLines = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').map((l) => l.split('#')[0].trim().toLowerCase()).filter(Boolean) : []

const SENT_HEADER = 'timestamp,venue_id,email,city,message_id,status,subject,kind'
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

function readSent(file) {
  if (!fs.existsSync(file)) return []
  return parseCsv(fs.readFileSync(file, 'utf8'))
}

function logAttempt(file, row) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (!fs.existsSync(file)) fs.writeFileSync(file, SENT_HEADER + '\n')
  fs.appendFileSync(file, [row.timestamp, row.venue_id, row.email, row.city, row.message_id, row.status, row.subject, row.kind].map(csvCell).join(',') + '\n')
}

// ── SendGrid ───────────────────────────────────────────────────────────────────────────────

const apiKey = () => process.env.SENDGRID_API_KEY || process.env.SPNM_SENDGRID_API_KEY || ''
const asmGroup = () => process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID_OUTREACH || process.env.SENDGRID_ASM_GROUP_ID || ''
const FROM_EMAIL = () => process.env.SENDGRID_FROM_EMAIL || 'david@softplaynearme.co.uk'
const FROM_NAME = () => process.env.SENDGRID_FROM_NAME || 'David'
const REPLY_TO = 'david@softplaynearme.co.uk'
const PLACEHOLDER_POSTAL = /^\s*$|\{\{|TODO|YOUR|PLACEHOLDER|CHANGE.?ME/i

async function sg(method, endpoint, body) {
  const res = await fetch(`https://api.sendgrid.com/v3${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`SendGrid ${method} ${endpoint} -> ${res.status}: ${text.slice(0, 300)}`)
  return { json: text ? JSON.parse(text) : null, headers: res.headers }
}

/** Addresses SendGrid will refuse or that must never be mailed: bounces, blocks, invalid, spam reports, global + ASM-group unsubscribes. */
async function fetchSendgridSuppressions(groupId) {
  const found = new Map()
  const lists = [
    ['/suppression/bounces', 'bounce'], ['/suppression/blocks', 'block'], ['/suppression/invalid_emails', 'invalid'],
    ['/suppression/spam_reports', 'spam report'], ['/suppression/unsubscribes', 'global unsubscribe'],
  ]
  for (const [endpoint, label] of lists) {
    for (let offset = 0; ; offset += 500) {
      const { json } = await sg('GET', `${endpoint}?limit=500&offset=${offset}`)
      for (const row of json ?? []) found.set(String(row.email).toLowerCase(), label)
      if (!json || json.length < 500) break
    }
  }
  if (groupId) {
    const { json } = await sg('GET', `/asm/groups/${groupId}/suppressions`)
    for (const email of json ?? []) found.set(String(email).toLowerCase(), 'outreach group unsubscribe')
  }
  return found
}

/** david@ must be a verified sender (or on an authenticated domain) or SendGrid can accept (202) and silently drop. */
async function senderIsConfirmed(email) {
  const { json } = await sg('GET', '/verified_senders?limit=200')
  return (json?.results ?? []).some((s) => String(s.from_email).toLowerCase() === email.toLowerCase() && s.verified === true)
}

export function buildPayload({ to, from, replyTo, name, subject, text, html, groupId, city, venueId, kind }) {
  return {
    personalizations: [{ to: [{ email: to }], custom_args: { campaign: `claim-${city}`, venue_id: String(venueId), kind } }],
    from: { email: from, name },
    reply_to: { email: replyTo, name },
    subject,
    content: [
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html },
    ],
    categories: ['venue-claim-campaign', `claim-${city}`],
    asm: { group_id: Number(groupId) },
    // Tracking explicitly off: no open pixel, no rewritten links, no SendGrid footer (the unsubscribe link is in the body).
    tracking_settings: {
      click_tracking: { enable: false, enable_text: false },
      open_tracking: { enable: false },
      subscription_tracking: { enable: false },
    },
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    out[key] = !next || next.startsWith('--') ? true : next
    if (out[key] !== true) i++
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const today = () => new Date().toISOString().slice(0, 10)

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const city = CITIES[args.city]
  if (!city) {
    console.error(`Usage: claim-campaign.mjs --city <${Object.keys(CITIES).join('|')}> [--test-to addr | --send] ...  (see the header of this file)`)
    process.exit(2)
  }
  const realSend = args.send === true
  const testTo = typeof args['test-to'] === 'string' ? args['test-to'] : null
  const live = realSend || !!testTo

  // Letter + config must agree before anything else.
  const textTemplate = fs.readFileSync(path.join(ROOT, city.template), 'utf8')
  const htmlTemplate = fs.readFileSync(path.join(ROOT, city.html_template), 'utf8')
  const drift = [...checkLetterMatchesConfig(textTemplate, city), ...checkLetterMatchesConfig(htmlTemplate, city)]
  if (drift.length) {
    console.error('Letter and city config disagree — fix before anything is sent:\n  ' + [...new Set(drift)].join('\n  '))
    process.exit(1)
  }

  // Recipients
  const csvPath = path.resolve(typeof args.csv === 'string' ? args.csv : path.join(DATA_DIR, `${city.slug}.csv`))
  if (!fs.existsSync(csvPath)) {
    console.error(`Recipient CSV not found: ${csvPath}\nExport it with the SQL in the venue-claim email report (city_slug = '${city.slug}') into contacts/claim-campaign/${city.slug}.csv, or pass --csv.`)
    process.exit(1)
  }
  const recipients = toRecipients(parseCsv(fs.readFileSync(csvPath, 'utf8')), city.slug)

  // Local state
  const sentFile = path.join(DATA_DIR, 'sent.csv')
  const warmFile = path.join(DATA_DIR, 'warmup.json')
  const sentRows = readSent(sentFile)
  const accepted = sentRows.filter((r) => r.kind === 'campaign' && /^2\d\d$|^accepted$/.test(r.status))
  const thirtyDaysAgo = Date.now() - 30 * 86400000
  const ctx = {
    includePlaceholders: args['include-placeholders'] === true,
    allowDuplicateEmail: args['allow-duplicate-email'] === true,
    suppressed: new Set(readLines(path.join(DATA_DIR, 'suppression.txt'))),
    excluded: new Set([
      ...(typeof args['exclude-file'] === 'string' ? readLines(path.resolve(args['exclude-file'])) : []),
      // The older backlink outreach log has no dates, so anything in it is treated as recently contacted.
      ...readLines(path.join(ROOT, 'contacts', 'venue-outreach-sent.txt')),
      ...readLines(path.join(ROOT, 'contacts', 'venue-outreach-exclude.txt')),
    ]),
    sentVenueIds: new Set(accepted.filter((r) => r.city === city.slug).map((r) => String(r.venue_id))),
    recentlyContacted: new Set(accepted.filter((r) => new Date(r.timestamp).getTime() >= thirtyDaysAgo).map((r) => r.email.toLowerCase())),
    sendgridSuppressed: null,
  }

  // Environment checks for anything that really sends
  const postal = process.env.POSTAL_ADDRESS ?? ''
  const groupId = asmGroup()
  const missing = []
  if (!apiKey()) missing.push('SENDGRID_API_KEY (or SPNM_SENDGRID_API_KEY)')
  if (!groupId) missing.push('SENDGRID_UNSUBSCRIBE_GROUP_ID_OUTREACH (or SENDGRID_ASM_GROUP_ID)')
  if (PLACEHOLDER_POSTAL.test(postal)) missing.push('POSTAL_ADDRESS (a real UK postal address — required for PECR)')
  if (live && missing.length) {
    console.error('Refusing to send. Still needed:\n  - ' + missing.join('\n  - '))
    process.exit(1)
  }

  if (live) {
    try {
      ctx.sendgridSuppressed = await fetchSendgridSuppressions(groupId)
      console.log(`SendGrid suppressions loaded (${ctx.sendgridSuppressed.size} addresses).`)
    } catch (e) {
      console.error(`Could not read SendGrid suppressions, so nothing is sent: ${e.message}`)
      process.exit(1)
    }
    if (args['i-have-confirmed-sender'] !== true) {
      let ok = false
      try { ok = await senderIsConfirmed(FROM_EMAIL()) } catch { /* handled below */ }
      if (!ok) {
        console.error(`Could not confirm ${FROM_EMAIL()} is a verified SendGrid sender (or the key can't read verified senders). SendGrid can return 202 and silently drop mail from an unverified sender. Confirm it in SendGrid, then re-run with --i-have-confirmed-sender.`)
        process.exit(1)
      }
    }
  }

  const { send, skipped } = classify(recipients, ctx)
  const unsubscribeForRender = live ? '<%asm_group_unsubscribe_raw_url%>' : '[unsubscribe-link]'
  const postalForRender = live ? postal : postal || '{{POSTAL_ADDRESS}}'

  // ── Dry run ──
  if (!live) {
    console.log(`DRY RUN — nothing is sent. City: ${city.name}. CSV: ${path.relative(ROOT, csvPath)}`)
    console.log(`\n${recipients.length} rows in the CSV: ${send.length} would be emailed, ${skipped.length} skipped.\n`)
    console.log('Would email:')
    for (const r of send) console.log(`  #${r.venue_id}  ${r.venue_name}  <${r.email}>\n         ${r.listing_url}`)
    if (skipped.length) {
      console.log('\nSkipped:')
      for (const { r, reason } of skipped) console.log(`  #${r.venue_id}  ${r.venue_name}  <${r.email}> — ${reason}`)
    }
    const bad = send.flatMap((r) => unresolvedTokens(renderEmail({ textTemplate, htmlTemplate, city, recipient: r, unsubscribe: unsubscribeForRender, postal: 'x' }).text))
    console.log(`\nRendered ${send.length} emails; unresolved tokens: ${bad.length ? bad.join(', ') : 'none'}.`)
    const day = dayCapFor(Object.keys(JSON.parse(fs.existsSync(warmFile) ? fs.readFileSync(warmFile, 'utf8') : '{}')).filter((d) => d !== today()).length)
    console.log(`Warm-up: today's cap would be ${typeof args['day-cap'] === 'string' ? args['day-cap'] : day}; ${Math.min(send.length, day)} of ${send.length} fit.`)
    if (send[0]) {
      const m = renderEmail({ textTemplate, htmlTemplate, city, recipient: send[0], unsubscribe: unsubscribeForRender, postal: postalForRender })
      console.log(`\n──── sample (${send[0].venue_name}) ────\nFrom: ${FROM_NAME()} <${FROM_EMAIL()}>   Reply-To: ${REPLY_TO}\nSubject: ${m.subject}\n\n${m.text}\n──── end sample ────`)
    }
    if (missing.length) console.log('\nBefore a real send you still need:\n  - ' + missing.join('\n  - ') + '\n  - a confirmed verified sender for ' + FROM_EMAIL() + ' (checked at send time)\n  - to eyeball the --test-to email and then say go')
    return
  }

  // ── Test send: one email, to one address, then stop ──
  if (testTo) {
    const sample = recipients.find((r) => EMAIL_OK.test(r.email)) ?? recipients[0]
    if (!sample) { console.error('No recipients in the CSV to personalise the test with.'); process.exit(1) }
    const m = renderEmail({ textTemplate, htmlTemplate, city, recipient: sample, unsubscribe: unsubscribeForRender, postal, subjectPrefix: '[TEST] ' })
    const payload = buildPayload({ to: testTo, from: FROM_EMAIL(), replyTo: REPLY_TO, name: FROM_NAME(), subject: m.subject, text: m.text, html: m.html, groupId, city: city.slug, venueId: sample.venue_id, kind: 'test' })
    let status = 'error', messageId = ''
    try {
      const { headers } = await sg('POST', '/mail/send', payload)
      status = '202'
      messageId = headers.get('x-message-id') ?? ''
    } catch (e) {
      console.error(e.message)
    }
    logAttempt(sentFile, { timestamp: new Date().toISOString(), venue_id: sample.venue_id, email: testTo, city: city.slug, message_id: messageId, status, subject: m.subject, kind: 'test' })
    console.log(`TEST email to ${testTo}: status ${status}${messageId ? `, SendGrid message id ${messageId}` : ''}. Personalised with ${sample.venue_name}; not recorded against that venue.\n\nSubject: ${m.subject}\n\n${m.text}\n\nSTOP: check this in the inbox before running --send.`)
    process.exit(status === '202' ? 0 : 1)
  }

  // ── Real batch ──
  const warm = fs.existsSync(warmFile) ? JSON.parse(fs.readFileSync(warmFile, 'utf8')) : {}
  const priorDays = Object.keys(warm).filter((d) => d !== today()).length
  const cap = typeof args['day-cap'] === 'string' ? Number(args['day-cap']) : dayCapFor(priorDays)
  const remaining = Math.max(0, cap - (warm[today()] ?? 0))
  const limit = typeof args.limit === 'string' ? Number(args.limit) : Infinity
  const batch = send.slice(0, Math.min(remaining, limit))
  const perMinute = typeof args['max-per-minute'] === 'string' ? Number(args['max-per-minute']) : 8
  console.log(`Sending ${batch.length} of ${send.length} eligible (day cap ${cap}, ${warm[today()] ?? 0} already today, ${perMinute}/minute). ${skipped.length} skipped.`)

  let ok = 0, failed = 0
  for (const r of batch) {
    const m = renderEmail({ textTemplate, htmlTemplate, city, recipient: r, unsubscribe: unsubscribeForRender, postal })
    const payload = buildPayload({ to: r.email, from: FROM_EMAIL(), replyTo: REPLY_TO, name: FROM_NAME(), subject: m.subject, text: m.text, html: m.html, groupId, city: city.slug, venueId: r.venue_id, kind: 'campaign' })
    let status = 'error', messageId = ''
    try {
      const { headers } = await sg('POST', '/mail/send', payload)
      status = '202'
      messageId = headers.get('x-message-id') ?? ''
      ok++
      warm[today()] = (warm[today()] ?? 0) + 1
      fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.writeFileSync(warmFile, JSON.stringify(warm, null, 2))
    } catch (e) {
      failed++
      console.error(`  #${r.venue_id} ${r.venue_name}: ${e.message}`)
    }
    logAttempt(sentFile, { timestamp: new Date().toISOString(), venue_id: r.venue_id, email: r.email, city: city.slug, message_id: messageId, status, subject: m.subject, kind: 'campaign' })
    await sleep(Math.ceil(60000 / perMinute))
  }

  const held = send.length - batch.length
  console.log(`\nDone. Sent: ${ok}. Failed: ${failed}. Held back by the day cap/limit: ${held}. Skipped: ${skipped.length}.`)
  for (const { r, reason } of skipped) console.log(`  skipped #${r.venue_id} ${r.venue_name}: ${reason}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e.message); process.exit(1) })
}
