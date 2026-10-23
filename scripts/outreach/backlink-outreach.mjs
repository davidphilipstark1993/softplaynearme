#!/usr/bin/env node
/**
 * Backlink outreach to listed soft play venues, via SendGrid.
 *
 * Reads the CSV produced by `npm run extract:emails -- --from-json --out contacts/venue-contact-emails.csv`
 * (columns: Venue Name, Website, Email, City, Slug) and:
 *
 *   sync  Creates/finds a SendGrid Marketing Contacts list and upserts every venue email into it.
 *   send  Emails each venue asking them to link to www.softplaynearme.co.uk, offering a newsletter
 *         feature in return. DRY RUN unless --confirm is passed.
 *
 * Usage:
 *   node scripts/outreach/backlink-outreach.mjs sync [--csv contacts/venue-contact-emails.csv] [--list-name "Venue backlink outreach"]
 *   node scripts/outreach/backlink-outreach.mjs send                      (preview only: prints counts + a sample email)
 *   node scripts/outreach/backlink-outreach.mjs send --test-to me@x.com   (sends ONE real email to that address)
 *   node scripts/outreach/backlink-outreach.mjs send --confirm            (sends to every venue in the CSV)
 *   node scripts/outreach/backlink-outreach.mjs send --confirm --limit 25 (first 25 only — recommended for the first batch)
 *
 * Env: SENDGRID_API_KEY (required), SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME,
 *      SENDGRID_UNSUBSCRIBE_GROUP_ID_OUTREACH (recommended — adds SendGrid's unsubscribe footer/header).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'https://www.softplaynearme.co.uk'
const BATCH_SIZE = 900 // SendGrid personalizations cap is 1000 per request

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'david@softplaynearme.co.uk'
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Soft Play Near Me'
const REPLY_TO = 'hello@softplaynearme.co.uk'
const ASM_GROUP = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID_OUTREACH

const [command, ...rest] = process.argv.slice(2)
const args = Object.fromEntries(
  rest.reduce((pairs, arg, i) => {
    if (arg.startsWith('--')) {
      const next = rest[i + 1]
      pairs.push([arg.slice(2), !next || next.startsWith('--') ? 'true' : next])
    }
    return pairs
  }, [])
)

const CSV_PATH = path.resolve(args.csv ?? path.join(__dirname, '..', '..', 'contacts', 'venue-contact-emails.csv'))
const LIST_NAME = args['list-name'] ?? 'Venue backlink outreach'
const LIMIT = args.limit ? Number(args.limit) : Infinity

// ── CSV ───────────────────────────────────────────────────────────────────────

function parseCsv(text) {
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
  return rows
}

const EMAIL_OK = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/

/** One recipient per unique email — chains share an address, so they get one email, not one per site. */
function loadRecipients() {
  if (!fs.existsSync(CSV_PATH)) { console.error(`CSV not found: ${CSV_PATH}`); process.exit(1) }
  const [header, ...rows] = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'))
  const col = (name) => header.indexOf(name)
  const iName = col('Venue Name'), iEmail = col('Email'), iCity = col('City'), iSlug = col('Slug')
  const byEmail = new Map()
  for (const r of rows) {
    const email = (r[iEmail] ?? '').trim().toLowerCase()
    if (!EMAIL_OK.test(email)) continue
    const venue = { name: r[iName], city: iCity >= 0 ? r[iCity] : '', slug: iSlug >= 0 ? r[iSlug] : '' }
    const existing = byEmail.get(email)
    if (existing) existing.venues.push(venue)
    else byEmail.set(email, { email, venues: [venue] })
  }
  return [...byEmail.values()].map((r) => {
    const first = r.venues[0]
    const listing = first.city && first.slug ? `${SITE}/soft-play/${first.city}/${first.slug}` : SITE
    return { email: r.email, venueName: cleanVenueName(first.name), venueUrl: listing, extraVenues: r.venues.length - 1 }
  })
}

// Scraped names are Google Maps titles and often carry SEO tails ("… - Family Entertainment Centre and Party Venue").
function cleanVenueName(name) {
  return name.split(/\s+[-–|\/]\s+/)[0].replace(/\s*\(.*$/, '').trim() || name
}

// ── Email content ─────────────────────────────────────────────────────────────

const SUBJECT = 'A free newsletter feature for your soft play centre'

function buildBodies() {
  const text = `Hi -venue_name- team,

I run Soft Play Near Me (${SITE}), a UK directory that helps parents find soft play centres near them. -venue_name- is already listed, free of charge, here:

-venue_url-

I'm getting in touch with a small request: would you be willing to add a link to ${SITE} on your website? A footer link, or a line on a "useful links" or parents page, would be perfect. For example:

  Looking for more soft play nearby? Visit Soft Play Near Me — ${SITE}

In return, we'll feature -venue_name- in our newsletter, which goes out to local parents looking for places to take their children.

If you're happy to help, just reply to this email with the page your link is on and I'll get your newsletter feature scheduled.

Thanks so much for your time,
David
Soft Play Near Me
${SITE}

---
You're receiving this one-off email because -venue_name- is listed on Soft Play Near Me and we found this address on your website. If you'd rather not hear from us, just reply "no thanks" and we won't contact you again.`

  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const paras = text.split('\n\n').map((p) => {
    const html = esc(p)
      .replace(/\n/g, '<br>')
      .replace(new RegExp(esc(SITE).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `<a href="${SITE}">${SITE}</a>`)
      .replace('-venue_url-', '<a href="-venue_url-">-venue_url-</a>')
    return `<p style="margin:0 0 16px">${html}</p>`
  })
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px">${paras.join('')}</div>`
  return { text, html }
}

// ── SendGrid ──────────────────────────────────────────────────────────────────

function apiKey() {
  const key = process.env.SENDGRID_API_KEY
  if (!key) { console.error('SENDGRID_API_KEY is not set'); process.exit(1) }
  return key
}

async function sg(method, endpoint, body) {
  const res = await fetch(`https://api.sendgrid.com/v3${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`SendGrid ${method} ${endpoint} → ${res.status}: ${text.slice(0, 400)}`)
  return { json: text ? JSON.parse(text) : null, headers: res.headers }
}

async function findOrCreateList(name) {
  const { json } = await sg('GET', '/marketing/lists?page_size=1000')
  const existing = (json.result ?? []).find((l) => l.name === name)
  if (existing) { console.log(`Using existing list "${name}" (${existing.id})`); return existing.id }
  const { json: created } = await sg('POST', '/marketing/lists', { name })
  console.log(`Created list "${name}" (${created.id})`)
  return created.id
}

async function sync() {
  const recipients = loadRecipients()
  console.log(`${recipients.length} unique venue emails in ${CSV_PATH}`)
  const listId = await findOrCreateList(LIST_NAME)
  for (let i = 0; i < recipients.length; i += 1000) {
    const chunk = recipients.slice(i, i + 1000)
    const { json } = await sg('PUT', '/marketing/contacts', {
      list_ids: [listId],
      contacts: chunk.map((r) => ({ email: r.email })),
    })
    console.log(`  queued ${chunk.length} contacts (job ${json.job_id})`)
  }
  console.log('Done. SendGrid processes contact imports asynchronously — allow a few minutes before they appear in the list.')
}

async function send() {
  let recipients = loadRecipients().slice(0, LIMIT)
  const { text, html } = buildBodies()

  if (args['test-to']) {
    recipients = [{ email: args['test-to'], venueName: 'Example Soft Play', venueUrl: `${SITE}/soft-play/hull`, extraVenues: 0 }]
  } else if (args.confirm !== 'true') {
    console.log(`DRY RUN — would email ${recipients.length} venues. Pass --confirm to send, or --test-to you@example.com to send one test.\n`)
    console.log(`Subject: ${SUBJECT}\n`)
    const r = recipients[0]
    console.log(`To: ${r?.email}\n\n${text.replaceAll('-venue_name-', r?.venueName).replaceAll('-venue_url-', r?.venueUrl)}`)
    return
  }

  let sent = 0, failed = 0
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)
    const body = {
      personalizations: batch.map((r) => ({
        to: [{ email: r.email }],
        substitutions: { '-venue_name-': r.venueName, '-venue_url-': r.venueUrl },
      })),
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: REPLY_TO, name: FROM_NAME },
      subject: SUBJECT,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
      categories: ['venue-backlink-outreach'],
    }
    if (ASM_GROUP) body.asm = { group_id: Number(ASM_GROUP) }
    try {
      await sg('POST', '/mail/send', body)
      sent += batch.length
    } catch (err) {
      failed += batch.length
      console.error(err.message)
    }
  }
  console.log(`Sent: ${sent}  Failed: ${failed}`)
}

const commands = { sync, send }
if (!commands[command]) {
  console.error('Usage: backlink-outreach.mjs <sync|send> [options] — see header of this file')
  process.exit(1)
}
commands[command]().catch((err) => { console.error(err); process.exit(1) })
