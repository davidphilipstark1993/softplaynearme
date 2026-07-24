import { cache } from 'react'
import { getPool } from '@/lib/pool'

/**
 * Total live venue count, memoized per-request. Falls back to null on any
 * DB error (e.g. connection/quota issues) so callers can supply their own
 * display fallback rather than this throwing and breaking metadata/layout
 * rendering for the whole site.
 */
export const getTotalVenueCount = cache(async (): Promise<number | null> => {
  try {
    const pool = getPool()
    const { rows } = await pool.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM venues')
    return rows[0]?.total ?? null
  } catch {
    return null
  }
})
