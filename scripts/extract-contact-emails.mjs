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
 *   node scripts/extract-contact-emails.mjs --from-json       (no database: read data/generated/venues.json, CSV only)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Config ────────────────────────────────────────────────────────────────────

const DB_URL = process.env.DATABASE_URL

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
const FROM_JSON      = args['from-json'] === 'true'
const OUT_PATH       = args.out ?? path.join(__dirname, '..', 'venue-contact-emails.csv')

if (!DB_URL && !FROM_JSON) { console.error('DATABASE_URL not set (or pass --from-json)'); process.exit(1) }

// ── Email priority ─────────────────────────────────────────────────────────────
// Matched left-to-right; first match wins.
const PRIORITY_PREFIXES = ['info', 'bookings', 'booking', 'contact', 'hello', 'enquiries', 'enquiry']
const JUNK_DOMAINS   = ['example.com', 'domain.com', 'website.com', 'yourdomain.com', 'yoursite.com',
                        'wixpress.com', 'sentry.io', 'w3.org',
                        'schema.org', 'google.com', 'apple.com', 'facebook.com', 'instagram.com']
const JUNK_PREFIXES  = ['noreply', 'no-reply', 'donotreply', 'support@', 'admin@wordpress', 'postmaster', 'counterfraud']
// Personal-email providers small businesses genuinely use as their contact
// address — an email on one of these isn't "off-domain" in the way an email
// on some other unrelated *business's* domain is.
const GENERIC_EMAIL_PROVIDERS = ['gmail.com', 'yahoo.com', 'yahoo.co.uk', 'outlook.com', 'hotmail.com',
                                  'hotmail.co.uk', 'icloud.com', 'aol.com', 'btinternet.com', 'live.com', 'msn.com']

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

  // Normalise (URL-encoded spaces left on mailto: links, www. mistakenly included in the domain), then filter junk
  const cleaned = [...found].map((e) => e.replace(/^(?:%20|[^a-z0-9])+/, '').replace('@www.', '@'))
  return [...new Set(cleaned)].filter((e) => {
    const [local, domain] = e.split('@')
    if (!domain) return false
    if (JUNK_DOMAINS.some((d) => domain.endsWith(d))) return false
    if (JUNK_PREFIXES.some((p) => e.startsWith(p) || local === p)) return false
    if (domain.endsWith('.png') || domain.endsWith('.jpg') || domain.endsWith('.gif')) return false
    return true
  })
}

// A venue's own site occasionally embeds or links to a completely different
// business (shared web developer's footer credit, an ad widget, a third
// party booking iframe) — an email scraped from that content isn't the
// venue's contact address just because it has a good prefix like "info@".
// Real contact emails are almost always either on the venue's own domain or
// a personal provider (small operators run off a gmail address); anything
// else is excluded rather than trusted.
function isRelevantDomain(emailDomain, siteDomain) {
  if (!siteDomain) return true // no site domain to compare against — can't filter
  const bareSite = siteDomain.replace(/^www\./, '')
  const bareEmail = emailDomain.replace(/^www\./, '')
  if (bareEmail === bareSite || bareEmail.endsWith(`.${bareSite}`) || bareSite.endsWith(`.${bareEmail}`)) return true
  // Compare just the core business name (first label), ignoring TLD — a
  // business owning both venuename.com and venuename.co.uk and using one
  // for its site and the other for email is a common, legitimate pattern,
  // not a mismatch.
  const coreOf = (d) => d.split('.')[0]
  if (coreOf(bareEmail) === coreOf(bareSite) && coreOf(bareEmail).length >= 4) return true
  return GENERIC_EMAIL_PROVIDERS.includes(bareEmail)
}

function pickBestEmail(emails, siteDomain) {
  const relevant = siteDomain ? emails.filter((e) => isRelevantDomain(e.split('@')[1], siteDomain)) : emails
  if (relevant.length === 0) return null
  // Priority prefix match
  for (const prefix of PRIORITY_PREFIXES) {
    const match = relevant.find((e) => e.split('@')[0] === prefix)
    if (match) return match
  }
  // Starts-with match (e.g. info.hull@example.com)
  for (const prefix of PRIORITY_PREFIXES) {
    const match = relevant.find((e) => e.split('@')[0].startsWith(prefix))
    if (match) return match
  }
  // Fall back to first found
  return relevant[0]
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

// When a venue's registered "website" is actually a third-party booking or
// social platform (Bookwhen, Eventbrite, Facebook, Instagram) rather than
// their own domain, any email found there is the *platform's* contact
// (support, partnerships, etc.), not the venue's — same-domain matching
// can't tell the difference since it genuinely is that domain. Safer to
// treat these as having no scrapeable site at all than to risk emailing a
// venue's outreach to the platform's business-development team instead.
const THIRD_PARTY_PLATFORM_DOMAINS = ['bookwhen.com', 'eventbrite.com', 'eventbrite.co.uk',
  'facebook.com', 'instagram.com', 'fb.com', 'linktr.ee', 'wix.com', 'squarespace.com']

async function scrapeVenue(website) {
  let url, siteDomain
  try { url = new URL(website).href; siteDomain = new URL(website).hostname.replace(/^www\./, '') } catch { return { emails: [], tried: [website] } }

  if (THIRD_PARTY_PLATFORM_DOMAINS.some((d) => siteDomain === d || siteDomain.endsWith(`.${d}`))) {
    return { emails: [], tried: [] }
  }

  const tried = []

  // Step 1: homepage
  tried.push(url)
  const homeHtml = await fetchHtml(url)
  if (!homeHtml) return { emails: [], tried }

  const homeEmails = extractEmails(homeHtml)

  // If we already have a solid email, return early
  const best = pickBestEmail(homeEmails, siteDomain)
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
    const b = pickBestEmail([...new Set(allEmails)], siteDomain)
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
  const pool = FROM_JSON ? null : new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 3 })

  // Ensure column exists
  if (!DRY_RUN && !FROM_JSON) {
    await pool.query(`ALTER TABLE venues ADD COLUMN IF NOT EXISTS contact_email VARCHAR(160)`)
    console.log('✓ contact_email column ready')
  }

  // Fetch venues
  const conditions = [`v.website IS NOT NULL AND v.website != ''`]
  const values = []
  if (CITY_FILTER) { values.push(CITY_FILTER); conditions.push(`v.city_slug = $${values.length}`) }
  if (SKIP_EXISTING) conditions.push(`(v.contact_email IS NULL OR v.contact_email = '')`)

  let venues
  if (FROM_JSON) {
    const all = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'generated', 'venues.json'), 'utf8'))
    venues = all
      .filter((v) => v.website && (!CITY_FILTER || v.townSlug === CITY_FILTER))
      .map((v) => ({ id: v.id, name: v.name, website: v.website, city_slug: v.townSlug, slug: v.slug, contact_email: null }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, LIMIT)
  } else {
    ;({ rows: venues } = await pool.query(
      `SELECT v.id, v.name, v.website, v.city_slug, v.slug, v.contact_email
       FROM venues v
       WHERE ${conditions.join(' AND ')}
       ORDER BY v.name
       LIMIT $${values.length + 1}`,
      [...values, LIMIT]
    ))
  }

  console.log(`\nFound ${venues.length} venues to process\n`)

  const results = []
  const noEmail  = []
  let updated = 0

  async function processVenue(venue) {
    const label = `${venue.name} (${venue.website})`
    process.stdout.write(`  ${label}… `)

    const { emails, tried } = await scrapeVenue(venue.website)
    let siteDomain
    try { siteDomain = new URL(venue.website).hostname.replace(/^www\./, '') } catch { siteDomain = null }
    const best = pickBestEmail(emails, siteDomain)

    if (best) {
      console.log(`✉  ${best}${emails.length > 1 ? ` (+${emails.length - 1} more)` : ''}`)
    } else {
      console.log(`— no email (checked ${tried.length} page${tried.length !== 1 ? 's' : ''})`)
      noEmail.push({ name: venue.name, website: venue.website })
    }

    if (!DRY_RUN && !FROM_JSON && best && best !== venue.contact_email) {
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

    results.push({ name: venue.name, website: venue.website, email: best ?? '', city: venue.city_slug, slug: venue.slug, allEmails: emails })
    await delay(DELAY_MS)
  }

  await runWithConcurrency(venues, processVenue, CONCURRENCY)

  // ── Output CSV ────────────────────────────────────────────────────────────
  const csvPath = OUT_PATH
  const rows = [
    ['Venue Name', 'Website', 'Email', 'City', 'Slug'],
    ...results.map((r) => [r.name, r.website, r.email, r.city ?? '', r.slug ?? '']),
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

  await pool?.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
