#!/usr/bin/env node
// Review queue for scraped venue facts (Phase 2D, 27 Nov 2026).
//
// Nothing the scraper finds is live until a person approves it here. Approving writes
// the venue field AND a provenance row (venue_fact_sources: value, source URL, date
// checked, who approved), in one transaction.
//
//   node scripts/enrichment/review-queue.mjs import --file=seo-data/enrichment/candidates-2026-11-27.json
//   node scripts/enrichment/review-queue.mjs export [--out=seo-data/enrichment/review.csv]   # pending -> CSV with a blank decision column
//   node scripts/enrichment/review-queue.mjs apply --file=seo-data/enrichment/review.csv --by=<your name> [--execute]
//        # decision column: approve | reject | (blank = leave pending). Dry run unless --execute.
//   node scripts/enrichment/review-queue.mjs stats
//
// After applying: npm run data:rebuild, so the static export carries the new facts.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from '../migrations/_lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cmd = process.argv[2]
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')
const EXECUTE = process.argv.includes('--execute')

/** candidate field -> venue columns it sets. */
export const FIELD_COLUMNS = {
  toddler_area: (v) => ({ toddler_area: v === true }),
  baby_area: (v) => ({ baby_area: v === true }),
  has_sen_sessions: (v) => ({ has_sen_sessions: v === true }),
  parties: (v) => ({ parties: v === true }),
  has_party_rooms: (v) => ({ has_party_rooms: v === true }),
  cafe: (v) => ({ cafe: v === true }),
  parking: (v) => ({ parking: v === true }),
  free_parking: (v) => ({ free_parking: v === true, parking: v === true }),
  has_soft_play: (v) => ({ has_soft_play: v === true }),
  age_range: (v) => ({ age_range_min: Number(v.min), age_range_max: Number(v.max) }),
  price_from: (v) => ({ price_from: Number(v) }),
}

const csvCell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') q = false; else cell += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows.filter((r) => r.some(Boolean))
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}

async function main() {
  const pool = await getPool()
  try {
    if (cmd === 'import') {
      const list = JSON.parse(fs.readFileSync(path.resolve(ROOT, arg('file')), 'utf8'))
      let n = 0
      for (const c of list) {
        if (!FIELD_COLUMNS[c.field]) continue
        const r = await pool.query(
          `INSERT INTO venue_fact_candidates (venue_id, field, value, evidence, source_url, fetched_at) VALUES ($1,$2,$3::jsonb,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [c.venue_id, c.field, JSON.stringify(c.value), String(c.evidence).slice(0, 1000), c.source_url, c.fetched_at],
        )
        n += r.rowCount
      }
      console.log(`Imported ${n} of ${list.length} candidates (rest already pending).`)
    } else if (cmd === 'export') {
      const out = arg('out') ?? path.join(ROOT, 'seo-data', 'enrichment', 'review.csv')
      const { rows } = await pool.query(
        `SELECT c.id, c.venue_id, v.name, v.city_slug, v.slug, c.field, c.value, c.evidence, c.source_url, c.fetched_at
           FROM venue_fact_candidates c JOIN venues v ON v.id = c.venue_id WHERE c.status = 'pending' ORDER BY v.city_slug, v.name, c.field`,
      )
      fs.mkdirSync(path.dirname(out), { recursive: true })
      const head = ['decision', 'id', 'venue_id', 'name', 'url', 'field', 'value', 'evidence', 'source_url', 'fetched_at']
      fs.writeFileSync(out, [head.join(','), ...rows.map((r) => ['', r.id, r.venue_id, r.name, `/soft-play/${r.city_slug}/${r.slug}`, r.field, JSON.stringify(r.value), r.evidence, r.source_url, String(r.fetched_at).slice(0, 10)].map(csvCell).join(','))].join('\n') + '\n')
      console.log(`Wrote ${rows.length} pending candidates to ${out}. Fill the decision column (approve / reject), then run apply.`)
    } else if (cmd === 'apply') {
      const by = arg('by')
      if (!by) throw new Error('--by=<name> is required (recorded as approved_by)')
      const rows = parseCsv(fs.readFileSync(path.resolve(ROOT, arg('file')), 'utf8')).filter((r) => /^(approve|reject)$/i.test(r.decision.trim()))
      const ids = rows.map((r) => Number(r.id))
      const { rows: cands } = await pool.query(`SELECT * FROM venue_fact_candidates WHERE id = ANY($1) AND status = 'pending'`, [ids])
      const byId = new Map(cands.map((c) => [c.id, c]))
      const approve = rows.filter((r) => /^approve$/i.test(r.decision.trim()) && byId.has(Number(r.id)))
      const reject = rows.filter((r) => /^reject$/i.test(r.decision.trim()) && byId.has(Number(r.id)))
      console.log(`approve ${approve.length}, reject ${reject.length}, skipped (not pending) ${rows.length - approve.length - reject.length}`)
      for (const r of approve) {
        const c = byId.get(Number(r.id))
        console.log(`  + ${c.venue_id} ${c.field} = ${JSON.stringify(c.value)}  (${c.source_url})`)
      }
      if (!EXECUTE) { console.log('Dry run. Pass --execute to write.'); return }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        for (const r of approve) {
          const c = byId.get(Number(r.id))
          const set = FIELD_COLUMNS[c.field](c.value)
          const cols = Object.keys(set)
          await client.query(`UPDATE venues SET ${cols.map((k, i) => `"${k}" = $${i + 2}`).join(', ')}, updated_at = NOW() WHERE id = $1`, [c.venue_id, ...cols.map((k) => set[k])])
          await client.query(
            `INSERT INTO venue_fact_sources (venue_id, field, value, source_url, checked_at, approved_by, candidate_id) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7)`,
            [c.venue_id, c.field, JSON.stringify(c.value), c.source_url, c.fetched_at, by, c.id],
          )
          await client.query(`UPDATE venue_fact_candidates SET status = 'approved', reviewed_at = NOW(), reviewed_by = $2 WHERE id = $1`, [c.id, by])
        }
        for (const r of reject) await client.query(`UPDATE venue_fact_candidates SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $2, note = $3 WHERE id = $1`, [Number(r.id), by, r.note || null])
        await client.query('COMMIT')
        console.log('Applied. Now run: npm run data:rebuild')
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {})
        throw e
      } finally {
        client.release()
      }
    } else if (cmd === 'stats') {
      const { rows } = await pool.query(`SELECT field, status, COUNT(*)::int AS n FROM venue_fact_candidates GROUP BY 1, 2 ORDER BY 1, 2`)
      console.table(rows)
    } else {
      console.log('Usage: review-queue.mjs import|export|apply|stats (see the header of this file)')
    }
  } finally {
    await pool.end()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e.message); process.exit(1) })
