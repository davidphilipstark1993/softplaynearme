#!/usr/bin/env node
/**
 * Extract contact emails from venue websites.
 *
 * For each venue with a website:
 *   1. Fetches the homepage HTML
 *   2. Checks for mailto: links (most reliable)
 *   3. Falls back to regex scan of visible text
 *   4. If no email found, tries /contact or /contact-us page
 *   5. Selects the best email using priority order
 *   6. Saves to venues.contact_email and outputs a CSV
 *
 * Usage:
 *   node scripts/extract-contact-emails.mjs
 *   node scripts/extract-contact-emails.mjs --city hull
 *   node scripts/extract-contact-emails.mjs --limit 50
 *   node scripts/extract-contact-emails.mjs --dry-run
 *   node scripts/extract-contact-emails.mjs --skip-existing   (skip venues that already have contact_email)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Config ────────────────────────────────────────────────────────────────────

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

const CONCURRENCY = 4
const TIMEOUT_MS  = 12000
const DELAY_MS    = 400

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, arr) => {
    if (arg.startsWith('--')) {
      const next = arr[i + 1]
      pairs.push([arg.slice(2), (!next || next.startsWith('--')) ? 'true' : next])
    }
    return pairs
  }, [])
)

const CITY_FILTER    = args.city   ?? null
const LIMIT          = args.limit  ? Number(args.limit) : 99999
const DRY_RUN        = args['dry-run'] === 'true'
const SKIP_EXISTING  = args['skip-existing'] === 'true'

// ── Email priority ─────────────────────────────────────────────────────────────
// Matched left-to-right; first match wins.
const PRIORITY_PREFIXES = ['info', 'bookings', 'booking', 'contact', 'hello', 'enquiries', 'enquiry']
const JUNK_DOMAINS   = ['example.com', 'domain.com', 'wixpress.com', 'sentry.io', 'w3.org',
                        'schema.org', 'google.com', 'apple.com', 'facebook.com', 'instagram.com']
const JUNK_PREFIXES  = ['noreply', 'no-reply', 'donotreply', 'support@', 'admin@wordpress', 'postmaster']

// Known contact-page path fragments to try
const CONTACT_PATHS  = ['/contact', '/contact-us', '/contact_us', '/contactus', '/get-in-touch',
                        '/about', '/about-us', '/find-us']

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&[a-z#\d]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const EMAIL_RE = /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g

function extractEmails(html) {
  const found = new Set()

  // 1. mailto: links first — most explicit signal
  const mailtoRe = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi
  let m
  while ((m = mailtoRe.exec(html)) !== null) found.add(m[1].toLowerCase())

  // 2. Visible text scan
  const text = stripTags(html)
  while ((m = EMAIL_RE.exec(text)) !== null) found.add(m[1].toLowerCase())

  // Filter junk
  return [...found].filter((e) => {
    const [local, domain] = e.split('@')
    if (!domain) return false
    if (JUNK_DOMAINS.some((d) => domain.endsWith(d))) return false
    if (JUNK_PREFIXES.some((p) => e.startsWith(p) || local === p)) return false
    if (domain.endsWith('.png') || domain.endsWith('.jpg') || domain.endsWith('.gif')) return false
    return true
  })
}

function pickBestEmail(emails) {
  if (emails.length === 0) return null
  // Priority prefix match
  for (const prefix of PRIORITY_PREFIXES) {
    const match = emails.find((e) => e.split('@')[0] === prefix)
    if (match) return match
  }
  // Starts-with match (e.g. info.hull@example.com)
  for (const prefix of PRIORITY_PREFIXES) {
    const match = emails.find((e) => e.split('@')[0].startsWith(prefix))
    if (match) return match
  }
  // Fall back to first found
  return emails[0]
}

async function fetchHtml(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoftPlayNearMe/1.0; +https://www.softplaynearme.co.uk)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('html') && !ct.includes('text')) return null
    return await res.text()
  } catch {
    clearTimeout(timer)
    return null
  }
}

function findContactLinks(html, baseUrl) {
  const links = new Set()
  const re = /href=["']([^"']+)["']/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]
    if (raw.startsWith('mailto:') || raw.startsWith('#') || raw.startsWith('javascript:')) continue
    try {
      const abs = new URL(raw, baseUrl).href
      const pathname = new URL(abs).pathname.toLowerCase()
      if (CONTACT_PATHS.some((p) => pathname.startsWith(p))) links.add(abs)
    } catch { /* invalid URL */ }
  }
  return [...links].slice(0, 3) // at most 3 contact candidates
}

async function scrapeVenue(website) {
  let url
  try { url = new URL(website).href } catch { return { emails: [], tried: [website] } }

  const tried = []

  // Step 1: homepage
  tried.push(url)
  const homeHtml = await fetchHtml(url)
  if (!homeHtml) return { emails: [], tried }

  const homeEmails = extractEmails(homeHtml)

  // If we already have a solid email, return early
  const best = pickBestEmail(homeEmails)
  if (best && PRIORITY_PREFIXES.includes(best.split('@')[0])) {
    return { emails: homeEmails, tried }
  }

  // Step 2: find contact page links in homepage HTML
  const contactLinks = findContactLinks(homeHtml, url)

  // Also try known path suffixes on the same domain
  const origin = new URL(url).origin
  for (const p of CONTACT_PATHS) {
    const candidate = origin + p
    if (!contactLinks.includes(candidate)) contactLinks.push(candidate)
  }

  const allEmails = [...homeEmails]

  for (const link of contactLinks.slice(0, 4)) {
    if (tried.includes(link)) continue
    tried.push(link)
    await delay(200)
    const html = await fetchHtml(link)
    if (!html) continue
    allEmails.push(...extractEmails(html))
    // Stop early if we found a priority email
    const b = pickBestEmail([...new Set(allEmails)])
    if (b && PRIORITY_PREFIXES.includes(b.split('@')[0])) break
  }

  return { emails: [...new Set(allEmails)], tried }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Concurrency pool ──────────────────────────────────────────────────────────

async function runWithConcurrency(items, fn, limit) {
  const results = []
  const queue = [...items]
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item) results.push(await fn(item))
    }
  })
  await Promise.all(workers)
  return results
}

// ── CSV ───────────────────────────────────────────────────────────────────────

function csvEscape(v) {
  const s = String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 })

  // Ensure column exists
  if (!DRY_RUN) {
    await pool.query(`ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_email VARCHAR(160)`)
    console.log('✓ contact_email column ready')
  }

  // Fetch venues
  const conditions = [`v.website IS NOT NULL AND v.website != ''`]
  const values = []
  if (CITY_FILTER) { values.push(CITY_FILTER); conditions.push(`v.city_slug = $${values.length}`) }
  if (SKIP_EXISTING) conditions.push(`(v.contact_email IS NULL OR v.contact_email = '')`)

  const { rows: venues } = await pool.query(
    `SELECT v.id, v.name, v.website, v.city_slug, v.slug, v.contact_email
     FROM venues v
     WHERE ${conditions.join(' AND ')}
     ORDER BY v.name
     LIMIT $${values.length + 1}`,
    [...values, LIMIT]
  )

  console.log(`\nFound ${venues.length} venues to process\n`)

  const results = []
  const noEmail  = []
  let updated = 0

  async function processVenue(venue) {
    const label = `${venue.name} (${venue.website})`
    process.stdout.write(`  ${label}… `)

    const { emails, tried } = await scrapeVenue(venue.website)
    const best = pickBestEmail(emails)

    if (best) {
      console.log(`✉  ${best}${emails.length > 1 ? ` (+${emails.length - 1} more)` : ''}`)
    } else {
      console.log(`— no email (checked ${tried.length} page${tried.length !== 1 ? 's' : ''})`)
      noEmail.push({ name: venue.name, website: venue.website })
    }

    if (!DRY_RUN && best && best !== venue.contact_email) {
      try {
        await pool.query(
          `UPDATE venues SET contact_email = $1 WHERE id = $2`,
          [best, venue.id]
        )
        updated++
      } catch (err) {
        console.error(`    DB error for ${venue.name}: ${err.message}`)
      }
    }

    results.push({ name: venue.name, website: venue.website, email: best ?? '', allEmails: emails })
    await delay(DELAY_MS)
  }

  await runWithConcurrency(venues, processVenue, CONCURRENCY)

  // ── Output CSV ────────────────────────────────────────────────────────────
  const csvPath = path.join(__dirname, '..', 'venue-contact-emails.csv')
  const rows = [
    ['Venue Name', 'Website', 'Email'],
    ...results.map((r) => [r.name, r.website, r.email]),
  ]
  fs.writeFileSync(csvPath, rows.map((r) => r.map(csvEscape).join(',')).join('\n'))
  console.log(`\n✓ CSV written → ${csvPath}`)

  // ── Summary ───────────────────────────────────────────────────────────────
  const found = results.filter((r) => r.email).length
  console.log('\n' + '─'.repeat(60))
  console.log(`Venues processed : ${results.length}`)
  console.log(`Emails found     : ${found}`)
  console.log(`No email found   : ${noEmail.length}`)
  if (!DRY_RUN) console.log(`DB rows updated  : ${updated}`)
  if (DRY_RUN)  console.log('(dry run — no DB writes)')

  if (noEmail.length > 0) {
    console.log('\nDomains with no email found:')
    for (const v of noEmail) {
      console.log(`  ${v.name.padEnd(40)} ${v.website}`)
    }
  }

  await pool.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
