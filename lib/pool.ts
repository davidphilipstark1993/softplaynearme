import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined
}

/**
 * When set, getPool() refuses to open a connection and every caller falls back
 * to the static exports in `data/generated/`.
 *
 * Why: each `next build` prerenders ~930 pages, and app/sitemap.ts scans the
 * whole venues table on top of that. Every deploy therefore burned Neon compute
 * hours, and the free-plan allowance is compute-time based — we exhausted it and
 * the live site started serving empty city pages. Commit 5d0e4fa was an earlier
 * revert forced by the same cost.
 *
 * This works without touching any call site because every DB read in the app is
 * already wrapped in try/catch with a static-data fallback (that path is what
 * kept builds working while the quota was exhausted). Refusing to connect just
 * makes the existing fallback the build-time default.
 *
 * Scope: the `build` npm script sets this, so it applies to the build process
 * only. `next dev`, `next start`, serverless runtime, ISR revalidation and the
 * API routes all leave it unset and use the database normally.
 *
 * Trade-off: build output is only as fresh as `data/generated/`. Those files are
 * currently produced from a CSV by `npm run data:build`, not from the database,
 * so refresh them before relying on a static-only build for new venue data.
 */
export const STATIC_BUILD = process.env.SOFTPLAY_STATIC_BUILD === '1'

/** Thrown instead of connecting when STATIC_BUILD is set. */
export class StaticBuildNoDatabaseError extends Error {
  constructor() {
    super(
      'SOFTPLAY_STATIC_BUILD=1 — skipping the database for this build and ' +
        'reading data/generated/ instead. This is deliberate, not a failure; ' +
        'unset the variable (or use `npm run build:with-db`) to query Neon.'
    )
    this.name = 'StaticBuildNoDatabaseError'
  }
}

export function getPool(): Pool {
  if (STATIC_BUILD) {
    throw new StaticBuildNoDatabaseError()
  }

  if (global.__pgPool) return global.__pgPool

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
  })

  global.__pgPool = pool

  return pool
}
