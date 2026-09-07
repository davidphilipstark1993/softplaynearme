#!/usr/bin/env node
/**
 * Generate a claimed-vs-unclaimed venue list for a city, for outreach
 * targeting (Phase 4: "Outreach-ready: generate a simple claimed vs
 * unclaimed list for London first").
 *
 * Outputs a CSV with every venue's claim/plan status, contact details
 * already on file (phone/website/contact_email — from prior
 * extract-contact-emails.mjs runs), and the public listing URL, sorted
 * unclaimed-first so outreach can prioritise the biggest opportunity.
 *
 * Usage:
 *   node scripts/generate-claim-status-list.mjs --city london
 *   node scripts/generate-claim-status-list.mjs --city london --unclaimed-only
 *   node scripts/generate-claim-status-list.mjs --city london --out /path/to/file.csv
 */

import fs from 'fs'
import path from 'path'
import pg from 'pg'

const { Pool } = pg

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, arr) => {
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = arr[i + 1]
      pairs.push([key, next && !next.startsWith('--') ? next : true])
    }
    return pairs
  }, [])
)

const citySlug = args.city
if (!citySlug) {
  console.error('Usage: node scripts/generate-claim-status-list.mjs --city <slug> [--unclaimed-only] [--out <path>]')
  process.exit(1)
}
const unclaimedOnly = !!args['unclaimed-only']

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

function csvEscape(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `SELECT name, slug, address, postcode, phone, website, contact_email,
              claimed_by_owner, plan, plan_status, needs_review, rating, reviews_count
       FROM venues
       WHERE city_slug = $1
       ORDER BY claimed_by_owner ASC, name ASC`,
      [citySlug]
    )

    let rows = result.rows
    if (unclaimedOnly) rows = rows.filter((r) => !r.claimed_by_owner)

    if (rows.length === 0) {
      console.log(`No venues found for city_slug='${citySlug}'.`)
      return
    }

    const header = [
      'name', 'claimed', 'plan', 'plan_status', 'needs_review',
      'phone', 'website', 'contact_email', 'address', 'postcode',
      'rating', 'reviews_count', 'listing_url',
    ]
    const csvRows = [header]
    for (const r of rows) {
      csvRows.push([
        r.name,
        r.claimed_by_owner ? 'yes' : 'no',
        r.plan || 'free',
        r.plan_status || 'inactive',
        r.needs_review ? 'yes' : 'no',
        r.phone || '',
        r.website || '',
        r.contact_email || '',
        r.address || '',
        r.postcode || '',
        r.rating ?? '',
        r.reviews_count ?? '',
        `https://www.softplaynearme.co.uk/soft-play/${citySlug}/${r.slug}`,
      ])
    }

    const outPath = args.out || path.join(process.cwd(), `${citySlug}-claim-status-${new Date().toISOString().slice(0, 10)}.csv`)
    fs.writeFileSync(outPath, csvRows.map((row) => row.map(csvEscape).join(',')).join('\n'))

    const claimedCount = rows.filter((r) => r.claimed_by_owner).length
    console.log(`${rows.length} venues in '${citySlug}' — ${claimedCount} claimed, ${rows.length - claimedCount} unclaimed`)
    console.log(`✓ CSV written → ${outPath}`)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
