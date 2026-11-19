// Email every verified owner a fresh sign-in link for the new owner dashboard (phase 15-01).
// Their old /dashboard/<token> links no longer edit listings.
//
//   node scripts/outreach/owner-signin-links.mjs            # dry run: lists who would get one
//   node scripts/outreach/owner-signin-links.mjs --commit   # creates tokens and sends the emails
//
// Needs DATABASE_URL and RESEND_API_KEY or SENDGRID_API_KEY. Run after phase15-01 --execute and
// after the owner-claims code is deployed (the link must land on a live /owner/signin).
// One email per address per venue name (repeat claims and duplicate listings of the same venue
// share one). Skips addresses that already hold an unexpired, unused token, so re-running is safe.
import { createHash, randomBytes } from 'node:crypto'
import { getPool } from '../migrations/_lib.mjs'

const COMMIT = process.argv.includes('--commit')
if (COMMIT && !process.env.RESEND_API_KEY && !process.env.SENDGRID_API_KEY) throw new Error('No RESEND_API_KEY or SENDGRID_API_KEY: nothing would send. Load them first (vercel env pull).')
const BASE = 'https://www.softplaynearme.co.uk'
const pool = await getPool()
const { rows } = await pool.query(`
  SELECT DISTINCT ON (lower(c.email), lower(v.name)) c.id, c.name, c.email, v.name AS venue_name, v.city_slug, v.slug
    FROM venue_claims c JOIN venues v ON v.id = c.venue_id
   WHERE c.status = 'verified' AND v.is_active = true
     AND NOT EXISTS (SELECT 1 FROM owner_login_tokens t JOIN venue_claims c2 ON c2.id = t.claim_id
                      WHERE lower(c2.email) = lower(c.email) AND t.used_at IS NULL AND t.expires_at > NOW())
   ORDER BY lower(c.email), lower(v.name), c.id`)
console.log(`${rows.length} verified owner claim(s) to email${COMMIT ? '' : ' (dry run)'}:`)
for (const r of rows) console.log(`  #${r.id} ${r.email}  ${r.venue_name}  ${BASE}/soft-play/${r.city_slug}/${r.slug}`)

async function send(to, subject, html) {
  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'Soft Play Near Me <hello@softplaynearme.co.uk>', to, subject, html }) })
    if (res.ok) return true
  }
  if (process.env.SENDGRID_API_KEY) {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: 'david@softplaynearme.co.uk', name: 'Soft Play Near Me' }, reply_to: { email: 'hello@softplaynearme.co.uk' }, subject, content: [{ type: 'text/html', value: html }] }) })
    return res.ok
  }
  return false
}

if (COMMIT) {
  let sent = 0
  for (const r of rows) {
    const token = randomBytes(32).toString('base64url')
    await pool.query(`INSERT INTO owner_login_tokens (claim_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`, [r.id, createHash('sha256').update(token).digest('hex')])
    const url = `${BASE}/owner/signin?token=${encodeURIComponent(token)}`
    const html = `<p>Hi ${r.name.replace(/</g, '&lt;')},</p>
<p>We've rebuilt how venue owners manage their listing on Soft Play Near Me. You can now add prices, toddler and SEN sessions, party packages, photos and events for <strong>${r.venue_name.replace(/</g, '&lt;')}</strong>, and it goes live straight away. There's no password: just use this link.</p>
<p><a href="${url}">Sign in to your listing</a></p>
<p style="font-size:12px;color:#64748b">The link works once and expires in 24 hours. You can request a new one any time at ${BASE}/owner/login. Your old dashboard link no longer edits the listing.</p>
<p>Thanks,<br>David, Soft Play Near Me</p>`
    if (await send(r.email, `New sign-in for ${r.venue_name} on Soft Play Near Me`, html)) sent++
    else console.error(`  FAILED to send to ${r.email}`)
  }
  console.log(`Sent ${sent} of ${rows.length}.`)
}
await pool.end()
