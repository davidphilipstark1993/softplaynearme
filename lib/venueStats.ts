import { cache } from 'react'
import { getPool } from '@/lib/pool'
import { visibleVenueTypeSql } from '@/lib/venueTypes'

/**
 * Total live venue count, memoized per-request. Falls back to null on any
 * DB error (e.g. connection/quota issues) so callers can supply their own
 * display fallback rather than this throwing and breaking metadata/layout
 * rendering for the whole site.
 */
export const getTotalVenueCount = cache(async (): Promise<number | null> => {
  try {
    const pool = getPool()
    // Genuine soft play only — see lib/venueTypes.ts. Counting bucketed
    // venue_types (trampoline parks, farms, park playgrounds, other family
    // attractions) here would overstate the "soft play centres" claim.
    const { rows } = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM venues v WHERE ${visibleVenueTypeSql()}`
    )
    return rows[0]?.total ?? null
  } catch {
    return null
  }
})
