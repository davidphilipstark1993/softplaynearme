// Shared helpers for the Phase 2 data-quality migration scripts.
//
// SAFETY MODEL: every script defaults to a dry run — it connects, verifies
// each target row still matches what the audit found (by id AND name, in
// case the live DB has changed since the May 2026 static export these
// scripts were generated from), and prints what it WOULD do. Nothing is
// written unless you pass --execute.
//
// Usage:
//   node scripts/migrations/phase2-01-remove-miscategorized.mjs           (dry run)
//   node scripts/migrations/phase2-01-remove-miscategorized.mjs --execute (writes)

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

export const EXECUTE = process.argv.includes('--execute')
export const BATCH_SIZE = 15

export function loadFindings() {
  return JSON.parse(readFileSync(path.join(ROOT, 'data/_audit_findings.json'), 'utf-8'))
}

export function loadVenuesJson() {
  return JSON.parse(readFileSync(path.join(ROOT, 'data/generated/venues.json'), 'utf-8'))
}

let poolPromise
export async function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      const envContent = readFileSync(path.join(ROOT, '.env.local'), 'utf-8')
      const match = envContent.match(/^DATABASE_URL=(.*)$/m)
      if (!match) throw new Error('DATABASE_URL not found in .env.local')
      const url = match[1].trim().replace(/^["']|["']$/g, '')
      const { Pool } = await import('pg')
      return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
    })()
  }
  return poolPromise
}

/** Append 301 redirect entries to data/redirects.json (deduped by source). */
export function appendRedirects(entries) {
  const file = path.join(ROOT, 'data/redirects.json')
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : []
  const bySource = new Map(existing.map((e) => [e.source, e]))
  for (const e of entries) bySource.set(e.source, e)
  const merged = [...bySource.values()]
  if (EXECUTE) {
    writeFileSync(file, JSON.stringify(merged, null, 2) + '\n')
  }
  return merged.length - existing.length
}

/** Run `items` through `fn` in batches of BATCH_SIZE, logging progress. */
export async function runBatched(items, fn) {
  let ok = 0, skipped = 0, failed = 0
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    console.log(`\n--- batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items) ---`)
    for (const item of batch) {
      try {
        const result = await fn(item)
        if (result === 'skipped') skipped++
        else ok++
      } catch (e) {
        failed++
        console.error('  FAILED:', item.name ?? item.slug ?? JSON.stringify(item).slice(0, 80), '-', e.message)
      }
    }
  }
  console.log(`\n${EXECUTE ? 'APPLIED' : 'DRY RUN — would apply'}: ${ok} ok, ${skipped} skipped (row changed/missing since audit), ${failed} failed`)
  if (!EXECUTE) console.log('Re-run with --execute to write these changes.')
}
