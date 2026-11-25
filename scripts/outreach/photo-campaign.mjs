#!/usr/bin/env node
/**
 * Photo-request emails to the most-seen venues without a working photo (25 Nov 2026,
 * copy approved by David). Same safeguards as claim-campaign.mjs: dry run by default,
 * one [TEST] email with --test-to, the real batch only with --send in a later sitting;
 * SendGrid suppressions, the local suppression and exclude lists, the outreach
 * unsubscribe group and a real postal address are all required to send. Tracking off.
 *
 * Unlike the claim letter, venues contacted by the older outreach are NOT skipped
 * (David approved re-contacting them for photos); opt-outs still are.
 *
 *   node scripts/outreach/photo-campaign.mjs                                   # dry run
 *   node scripts/outreach/photo-campaign.mjs --test-to david@softplaynearme.co.uk
 *   node scripts/outreach/photo-campaign.mjs --send
 *
 * Recipients: contacts/photo-outreach-2026-11-25.csv (gitignored; built from the Phase 4
 * venue-quality export). Log: contacts/photo-campaign/sent.csv.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  parseCsv, claimUrl, isPlaceholderEmail, isLikelyStale, replaceTokens, escapeHtml, unresolvedTokens,
  sg, fetchSendgridSuppressions, senderIsConfirmed,
} from './claim-campaign.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CAMPAIGN = 'photos-2026-11'
const TEMPLATE = path.join(ROOT, 'scripts/outreach/templates/photos-2026-11.txt')
const DATA_DIR = path.join(ROOT, 'contacts', 'photo-campaign')
const EMAIL_OK = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/
const FROM = process.env.SENDGRID_FROM_EMAIL || 'david@softplaynearme.co.uk'
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'David'
const PLACEHOLDER_POSTAL = /^\s*$|\{\{|TODO|YOUR|PLACEHOLDER|CHANGE.?ME/i

const OPTIONS_UNCLAIMED = (claim) => `Two easy ways:
- Reply to this email with a few photos you're happy for us to use, and I'll put them up for you.
- Or claim the listing for free and upload up to 10 yourself, along with your hours, prices and facilities: ${claim}

There's no cost and no subscription.`
const OPTIONS_CLAIMED = `Two easy ways:
- Reply to this email with a few photos you're happy for us to use, and I'll put them up for you.
- Or sign in to your owner dashboard and upload up to 10 yourself: https://www.softplaynearme.co.uk/owner/login

There's no cost.`

export function reachLine(impressions) {
  const n = Number(impressions) || 0
  return n >= 50
    ? `That page came up ${n.toLocaleString('en-GB')} times in Google searches over the last three months, but it doesn't have a photo of your venue yet.`
    : `It doesn't have a photo of your venue yet.`
}

export function render(template, r, { unsubscribe, postal, prefix = '' }) {
  const [subjectLine, ...rest] = template.split('\n')
  const claimed = String(r.claimed_by_owner) === 'true'
  const values = {
    venue_name: r.venue_name, listing_url: r.listing_url, reach: reachLine(r.impressions_3m),
    options: claimed ? OPTIONS_CLAIMED : OPTIONS_UNCLAIMED(claimUrl(r.venue_name, r.city_slug, r.slug).replace('claim-', 'photos-')),
    unsubscribe_url: unsubscribe, POSTAL_ADDRESS: postal,
  }
  const subject = prefix + replaceTokens(subjectLine.replace(/^Subject:\s*/, ''), values)
  const text = replaceTokens(rest.join('\n').replace(/^\n+/, ''), values)
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">${escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, (u) => (u.includes('asm_group') ? `<a href="${u}">unsubscribe</a>` : `<a href="${u}">${u}</a>`))
    .split('\n').join('<br>')}</div>`.replace(/&lt;%asm_group_unsubscribe_raw_url%&gt;/g, '<a href="<%asm_group_unsubscribe_raw_url%>">unsubscribe</a>')
  return { subject, text, html }
}

const readLines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').map((l) => l.split('#')[0].trim().toLowerCase()).filter(Boolean) : [])
const sentFile = path.join(DATA_DIR, 'sent.csv')
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
function log(row) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(sentFile)) fs.writeFileSync(sentFile, 'timestamp,venue_id,email,message_id,status,subject,kind\n')
  fs.appendFileSync(sentFile, [row.timestamp, row.venue_id, row.email, row.message_id, row.status, row.subject, row.kind].map(csvCell).join(',') + '\n')
}

function payload(to, m, venueId, kind, groupId) {
  return {
    personalizations: [{ to: [{ email: to }], custom_args: { campaign: CAMPAIGN, venue_id: String(venueId), kind } }],
    from: { email: FROM, name: FROM_NAME }, reply_to: { email: 'david@softplaynearme.co.uk', name: FROM_NAME },
    subject: m.subject, content: [{ type: 'text/plain', value: m.text }, { type: 'text/html', value: m.html }],
    categories: ['venue-photo-campaign', CAMPAIGN], asm: { group_id: Number(groupId) },
    tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false }, subscription_tracking: { enable: false } },
  }
}

async function main() {
  const args = process.argv.slice(2)
  const testTo = args.includes('--test-to') ? args[args.indexOf('--test-to') + 1] : null
  const realSend = args.includes('--send')
  const live = realSend || !!testTo
  const csvPath = path.join(ROOT, 'contacts', 'photo-outreach-2026-11-25.csv')
  const template = fs.readFileSync(TEMPLATE, 'utf8')
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))

  const postal = process.env.POSTAL_ADDRESS ?? ''
  const groupId = process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID_OUTREACH || process.env.SENDGRID_ASM_GROUP_ID || ''
  const key = process.env.SENDGRID_API_KEY || process.env.SPNM_SENDGRID_API_KEY || ''
  const missing = [!key && 'SENDGRID_API_KEY', !groupId && 'SENDGRID_UNSUBSCRIBE_GROUP_ID_OUTREACH', PLACEHOLDER_POSTAL.test(postal) && 'POSTAL_ADDRESS'].filter(Boolean)
  if (live && missing.length) { console.error('Refusing to send. Still needed: ' + missing.join(', ')); process.exit(1) }

  const suppressed = new Set([...readLines(path.join(ROOT, 'contacts/claim-campaign/suppression.txt')), ...readLines(path.join(ROOT, 'contacts/venue-outreach-exclude.txt'))])
  const already = new Set(fs.existsSync(sentFile) ? parseCsv(fs.readFileSync(sentFile, 'utf8')).filter((r) => r.kind === 'campaign' && r.status === '202').map((r) => r.venue_id) : [])
  let sgSuppressed = new Map()
  if (live) {
    sgSuppressed = await fetchSendgridSuppressions(groupId)
    if (!args.includes('--i-have-confirmed-sender') && !(await senderIsConfirmed(FROM).catch(() => false))) { console.error(`Could not confirm ${FROM} is a verified sender; re-run with --i-have-confirmed-sender once checked.`); process.exit(1) }
  }

  const send = [], skipped = [], seen = new Set()
  for (const r of rows) {
    const e = (r.email || '').toLowerCase()
    const why = !e ? 'no email' : !EMAIL_OK.test(e) ? 'invalid email' : isPlaceholderEmail(e) ? 'placeholder address'
      : suppressed.has(e) ? 'opted out / excluded' : sgSuppressed.has(e) ? `SendGrid suppression (${sgSuppressed.get(e)})`
      : isLikelyStale(e) ? 'stale ISP domain, likely to bounce' : already.has(r.venue_id) ? 'already sent' : seen.has(e) ? 'duplicate email' : null
    if (why) { skipped.push([r, why]); continue }
    seen.add(e); send.push({ ...r, email: e, venue_name: r.venue_name.replace(/\s+(ltd|limited)\.?$/i, '') })
  }
  const unsub = live ? '<%asm_group_unsubscribe_raw_url%>' : '[unsubscribe-link]'

  if (!live) {
    console.log(`DRY RUN: ${send.length} would be emailed, ${skipped.length} skipped.\n`)
    for (const r of send) console.log(`  #${r.venue_id} ${r.venue_name} <${r.email}>${String(r.claimed_by_owner) === 'true' ? ' [claimed]' : ''}${isLikelyStale(r.email) ? '  ⚠ stale ISP domain' : ''}`)
    console.log('\nSkipped: ' + skipped.map(([r, w]) => `#${r.venue_id} (${w})`).join(', '))
    const bad = send.flatMap((r) => unresolvedTokens(render(template, r, { unsubscribe: unsub, postal: 'x' }).text))
    console.log(`\nUnresolved tokens: ${bad.length ? bad.join(', ') : 'none'}.`)
    const m = render(template, send[0], { unsubscribe: unsub, postal: postal || '{{POSTAL_ADDRESS}}' })
    console.log(`\n──── sample ────\nSubject: ${m.subject}\n\n${m.text}\n────────────────`)
    if (missing.length) console.log('\nTo send you still need: ' + missing.join(', '))
    return
  }

  const batch = testTo ? [send[0]] : send
  for (const r of batch) {
    const to = testTo ?? r.email
    const kind = testTo ? 'test' : 'campaign'
    const m = render(template, r, { unsubscribe: unsub, postal, prefix: testTo ? '[TEST] ' : '' })
    let status = 'error', id = ''
    try { const { headers } = await sg('POST', '/mail/send', payload(to, m, r.venue_id, kind, groupId)); status = '202'; id = headers.get('x-message-id') ?? '' } catch (e) { console.error(`#${r.venue_id}: ${e.message}`) }
    log({ timestamp: new Date().toISOString(), venue_id: r.venue_id, email: to, message_id: id, status, subject: m.subject, kind })
    console.log(`${kind} #${r.venue_id} ${r.venue_name} -> ${to}: ${status}`)
    if (!testTo) await new Promise((res) => setTimeout(res, 7500))
  }
  if (testTo) console.log('\nSTOP: check the test in the inbox before running --send.')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
