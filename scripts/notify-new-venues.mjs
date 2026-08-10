#!/usr/bin/env node
/**
 * Emails owners of newly-discovered venues (needs_review=true, contact_email
 * populated) to let them know they're listed and how to claim/edit it.
 * Groups by contact_email first — a few venues share an operator's email
 * (e.g. a leisure trust running several centres) and get one combined email
 * listing all of their venues rather than one email per venue.
 *
 * Dry-run by default — prints the exact rendered emails without sending.
 *
 * Usage:
 *   SENDGRID_API_KEY=SG.... node scripts/notify-new-venues.mjs
 *   SENDGRID_API_KEY=SG.... node scripts/notify-new-venues.mjs --commit
 *   SENDGRID_API_KEY=SG.... node scripts/notify-new-venues.mjs --city london
 */

import pg from 'pg'
const { Pool } = pg

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1) }

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, arr) => {
    if (arg === '--commit') pairs.push(['commit', true])
    else if (arg === '--city') pairs.push(['city', arr[i + 1]])
    return pairs
  }, [])
)
const commit = !!args.commit
const cityFilter = args.city || null

const SENDER = 'david@softplaynearme.co.uk'
const BASE_URL = 'https://www.softplaynearme.co.uk'
const SENDGRID_KEY = process.env.SENDGRID_API_KEY
if (commit && !SENDGRID_KEY) {
  console.error('SENDGRID_API_KEY is required to actually send (dry-run works without it).')
  process.exit(1)
}

function claimUrl(venue) {
  const params = new URLSearchParams({ venue: venue.name, city: venue.city_slug, slug: venue.slug })
  return `${BASE_URL}/add-venue?${params.toString()}`
}
function venueUrl(venue) {
  return `${BASE_URL}/soft-play/${venue.city_slug}/${venue.slug}`
}

function renderEmail(venues) {
  const single = venues.length === 1
  const subject = single
    ? `${venues[0].name} is now listed on Soft Play Near Me — claim it free`
    : `${venues.length} of your venues are now listed on Soft Play Near Me — claim them free`

  const venueBlocks = venues.map((v) => `
    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px">
      <p style="margin:0 0 6px;font-weight:600;color:#1e293b">${v.name}</p>
      <p style="margin:0 0 10px;font-size:13px"><a href="${venueUrl(v)}" style="color:#7c3aed">${venueUrl(v)}</a></p>
      <a href="${claimUrl(v)}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600">Claim this listing &rarr;</a>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Arial,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;padding:24px 16px">
  <p>Hi,</p>
  <p>We've just added ${single ? `<strong>${venues[0].name}</strong>` : `${venues.length} of your venues`} to <strong>Soft Play Near Me</strong> (softplaynearme.co.uk), a directory UK parents use to find soft play centres near them.</p>
  ${venueBlocks}
  <p><strong>It's free to claim</strong> — takes about 60 seconds. Once claimed, you'll get your own dashboard where you can:</p>
  <ul>
    <li>Add photos (listings with 3+ photos get significantly more clicks)</li>
    <li>Set your opening hours and prices</li>
    <li>Add facilities (caf&eacute;, parking, SEN sessions, parties, etc.)</li>
    <li>Write your own description</li>
  </ul>
  <p>No subscription required for the free tier — it's free forever.</p>
  <p>Any questions, just reply to this email.</p>
  <p>Thanks,<br>David<br>Soft Play Near Me</p>
</body></html>`

  return { subject, html }
}

async function sendViaSendGrid(to, subject, html) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: SENDER, name: 'Soft Play Near Me' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })
  if (res.status === 202) return { ok: true }
  const body = await res.text()
  return { ok: false, status: res.status, body }
}

async function main() {
  const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  const client = await pool.connect()

  await client.query(`ALTER TABLE venues ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP`)

  const conditions = [`needs_review = true`, `contact_email IS NOT NULL`, `contact_email != ''`, `notified_at IS NULL`]
  const values = []
  if (cityFilter) { values.push(cityFilter); conditions.push(`city_slug = $${values.length}`) }

  const { rows } = await client.query(
    `SELECT id, name, city_slug, slug, contact_email FROM venues WHERE ${conditions.join(' AND ')} ORDER BY contact_email, name`,
    values
  )

  const groups = new Map()
  for (const v of rows) {
    if (!groups.has(v.contact_email)) groups.set(v.contact_email, [])
    groups.get(v.contact_email).push(v)
  }

  console.log(`${rows.length} venues, ${groups.size} recipient(s)${commit ? ' — SENDING' : ' — DRY RUN'}\n`)

  let sent = 0, failed = 0
  for (const [email, venues] of groups) {
    const { subject, html } = renderEmail(venues)
    console.log(`--- ${email} (${venues.length} venue${venues.length > 1 ? 's' : ''}: ${venues.map((v) => v.name).join(', ')}) ---`)
    console.log(`Subject: ${subject}`)

    if (commit) {
      const result = await sendViaSendGrid(email, subject, html)
      if (result.ok) {
        console.log('  -> sent')
        sent++
        await client.query(
          `UPDATE venues SET notified_at = CURRENT_TIMESTAMP WHERE id = ANY($1)`,
          [venues.map((v) => v.id)]
        )
      } else {
        console.log(`  -> FAILED (${result.status}): ${result.body}`)
        failed++
      }
      await new Promise((r) => setTimeout(r, 300))
    }
    console.log()
  }

  client.release()
  await pool.end()

  if (commit) {
    console.log(`Done: ${sent} sent, ${failed} failed.`)
  } else {
    console.log('Dry run — nothing sent. Re-run with --commit to actually send.')
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
