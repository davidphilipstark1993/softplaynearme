/**
 * Database access for owner claims (tables from scripts/migrations/phase15-01-owner-claims.mjs).
 * Reads degrade to "nothing" if the tables don't exist yet, so venue pages never break.
 */
import { getPool } from '@/lib/pool'
import { newLoginToken, hashToken, LOGIN_TOKEN_TTL_MS } from './tokens'
import { ownerCompleteness, OWNER_FIELDS, type OwnerData, type OwnerField } from '@/lib/ownerData'

export type ClaimStatus = 'pending' | 'verified' | 'rejected'
export type ClaimMethod = 'domain_email' | 'manual_review'

export interface Claim {
  id: number
  venue_id: number | null
  name: string
  email: string
  role: string | null
  method: ClaimMethod | null
  status: string
  email_verified: boolean
  city_slug: string | null
  venue_slug: string | null
  venue_name: string
  created_at: string
  verified_at: string | null
}

/** 'approved' is the pre-15-01 name for 'verified'. */
export const isVerifiedClaim = (c: Pick<Claim, 'status'> | null | undefined) => !!c && (c.status === 'verified' || c.status === 'approved')

export interface ClaimVenue {
  id: number
  name: string
  slug: string
  city_slug: string
  website: string | null
  claimed_by_owner: boolean | null
}

export async function getVenueForClaim(citySlug: string, slug: string): Promise<ClaimVenue | null> {
  const { rows } = await getPool().query(
    `SELECT id, name, slug, city_slug, website, claimed_by_owner FROM venues WHERE city_slug = $1 AND slug = $2 AND is_active = true`,
    [citySlug, slug]
  )
  return rows[0] ?? null
}

export async function hasVerifiedOwner(venueId: number): Promise<boolean> {
  const { rows } = await getPool().query(
    `SELECT 1 FROM venue_claims WHERE venue_id = $1 AND status IN ('verified','approved') LIMIT 1`,
    [venueId]
  )
  return rows.length > 0
}

/** Claims in the last hour from this IP, and in the last day for this venue. */
export async function recentClaimCounts(ipHash: string, venueId: number): Promise<{ ip: number; venue: number }> {
  const { rows } = await getPool().query(
    `SELECT count(*) FILTER (WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '1 hour') AS ip,
            count(*) FILTER (WHERE venue_id = $2 AND created_at > NOW() - INTERVAL '1 day') AS venue
       FROM venue_claims WHERE created_at > NOW() - INTERVAL '1 day'`,
    [ipHash, venueId]
  )
  return { ip: Number(rows[0]?.ip ?? 0), venue: Number(rows[0]?.venue ?? 0) }
}

export async function createClaim(input: {
  venue: ClaimVenue
  name: string
  email: string
  role: string
  method: ClaimMethod
  ipHash: string
}): Promise<Claim> {
  const { venue } = input
  const { rows } = await getPool().query(
    `INSERT INTO venue_claims (name, email, venue_name, city_slug, venue_slug, venue_url, venue_id, role, method, status, ip_hash, venue_website, message, proof)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,'','')
     RETURNING id, venue_id, name, email, role, method, status, email_verified, city_slug, venue_slug, venue_name, created_at, verified_at`,
    [
      input.name, input.email, venue.name, venue.city_slug, venue.slug,
      `https://www.softplaynearme.co.uk/soft-play/${venue.city_slug}/${venue.slug}`,
      venue.id, input.role, input.method, input.ipHash, venue.website,
    ]
  )
  return rows[0]
}

export async function getClaim(id: number): Promise<Claim | null> {
  const { rows } = await getPool().query(
    `SELECT id, venue_id, name, email, role, method, status, email_verified, city_slug, venue_slug, venue_name, created_at, verified_at
       FROM venue_claims WHERE id = $1`,
    [id]
  )
  return rows[0] ?? null
}

/** Latest claims for an email address (to send a returning owner a fresh sign-in link). */
export async function claimsForEmail(email: string): Promise<Claim[]> {
  const { rows } = await getPool().query(
    `SELECT id, venue_id, name, email, role, method, status, email_verified, city_slug, venue_slug, venue_name, created_at, verified_at
       FROM venue_claims WHERE lower(email) = lower($1) AND status IN ('verified','approved','pending') ORDER BY created_at DESC LIMIT 5`,
    [email]
  )
  return rows
}

/** A new single-use sign-in token for a claim; returns the raw token for the email link. */
export async function issueLoginToken(claimId: number): Promise<string> {
  const { token, hash } = newLoginToken()
  await getPool().query(
    `INSERT INTO owner_login_tokens (claim_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [claimId, hash, new Date(Date.now() + LOGIN_TOKEN_TTL_MS)]
  )
  return token
}

/**
 * Use a sign-in token: atomically marks it used (so it works once) and returns its claim.
 * Confirms the claim's email; a domain-email claim becomes verified and the venue claimed.
 */
export async function consumeLoginToken(token: string): Promise<{ claim: Claim; justVerified: boolean } | null> {
  const pool = getPool()
  const { rows } = await pool.query(
    `UPDATE owner_login_tokens SET used_at = NOW()
      WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
      RETURNING claim_id`,
    [hashToken(token)]
  )
  if (!rows[0]) return null
  const claimId = rows[0].claim_id as number
  await pool.query(`UPDATE venue_claims SET email_verified = true WHERE id = $1`, [claimId])
  let claim = await getClaim(claimId)
  if (!claim) return null
  let justVerified = false
  if (claim.status === 'pending' && claim.method === 'domain_email' && claim.venue_id) {
    await markVerified(claim.id, claim.venue_id, 'domain_email')
    claim = (await getClaim(claimId))!
    justVerified = true
  }
  return { claim, justVerified }
}

export async function markVerified(claimId: number, venueId: number, reviewedBy: string): Promise<void> {
  const pool = getPool()
  await pool.query(`UPDATE venue_claims SET status = 'verified', verified_at = NOW(), reviewed_by = $2 WHERE id = $1`, [claimId, reviewedBy])
  await pool.query(`UPDATE venues SET claimed_by_owner = true WHERE id = $1`, [venueId])
}

export async function rejectClaim(claimId: number, reviewedBy: string): Promise<void> {
  await getPool().query(`UPDATE venue_claims SET status = 'rejected', reviewed_by = $2 WHERE id = $1`, [claimId, reviewedBy])
}

/** Owner photo allowance: 4 on the free plan, 12 with an active paid plan ("Extra photos"). */
export const FREE_PHOTO_LIMIT = 4
export const PAID_PHOTO_LIMIT = 12
export async function photoLimitFor(venueId: number): Promise<number> {
  const { rows } = await getPool().query(`SELECT plan, plan_status FROM venues WHERE id = $1`, [venueId])
  const v = rows[0]
  const paid = !!v && v.plan && v.plan !== 'free' && ['active', 'trialing'].includes(String(v.plan_status))
  return paid ? PAID_PHOTO_LIMIT : FREE_PHOTO_LIMIT
}

// ── Owner data ─────────────────────────────────────────────────────────────────────

const JSON_FIELDS = new Set<OwnerField>(['prices', 'opening_hours_override', 'photos', 'events', 'facilities'])

/** The owner's data for a venue, or null (also when the table doesn't exist yet). */
export async function getOwnerData(venueId: number | null | undefined): Promise<OwnerData | null> {
  if (!venueId) return null
  try {
    const { rows } = await getPool().query(`SELECT * FROM venue_owner_data WHERE venue_id = $1`, [venueId])
    if (!rows[0]) return null
    const out: OwnerData = {}
    for (const f of OWNER_FIELDS) if (rows[0][f] != null) (out as Record<string, unknown>)[f] = rows[0][f]
    return out
  } catch {
    return null
  }
}

/**
 * Save the given fields, logging each change (old -> new) to venue_edit_log, and keep
 * venues.owner_completeness in step. Returns the fields that actually changed.
 */
export async function saveOwnerData(venueId: number, patch: OwnerData, editedBy: string, claimId: number | null): Promise<OwnerField[]> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(`SELECT * FROM venue_owner_data WHERE venue_id = $1 FOR UPDATE`, [venueId])
    const current = (rows[0] ?? {}) as Record<string, unknown>
    const changed: OwnerField[] = []
    for (const f of OWNER_FIELDS) {
      if (!(f in patch)) continue
      const next = (patch as Record<string, unknown>)[f] ?? null
      const prev = current[f] ?? null
      if (JSON.stringify(prev) === JSON.stringify(next)) continue
      changed.push(f)
      await client.query(
        `INSERT INTO venue_edit_log (venue_id, field, old_value, new_value, edited_by) VALUES ($1, $2, $3, $4, $5)`,
        [venueId, f, JSON.stringify(prev), JSON.stringify(next), editedBy]
      )
    }
    if (changed.length) {
      const cols = changed
      const vals = cols.map((f) => {
        const v = (patch as Record<string, unknown>)[f] ?? null
        return JSON_FIELDS.has(f) && v !== null ? JSON.stringify(v) : v
      })
      const insertCols = ['venue_id', ...cols, 'updated_by_claim_id']
      const placeholders = insertCols.map((_, i) => `$${i + 1}`)
      const updates = [...cols.map((c) => `${c} = EXCLUDED.${c}`), 'updated_at = NOW()', 'updated_by_claim_id = EXCLUDED.updated_by_claim_id']
      await client.query(
        `INSERT INTO venue_owner_data (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})
         ON CONFLICT (venue_id) DO UPDATE SET ${updates.join(', ')}`,
        [venueId, ...vals, claimId]
      )
      const { rows: after } = await client.query(`SELECT * FROM venue_owner_data WHERE venue_id = $1`, [venueId])
      await client.query(`UPDATE venues SET owner_completeness = $2, updated_at = NOW() WHERE id = $1`, [venueId, ownerCompleteness(after[0] as OwnerData)])
    }
    await client.query('COMMIT')
    return changed
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

export interface EditLogRow {
  id: number
  venue_id: number
  venue_name: string
  city_slug: string
  slug: string
  field: OwnerField
  old_value: unknown
  new_value: unknown
  edited_by: string
  edited_at: string
  reverted_at: string | null
}

export async function recentEdits(limit = 100): Promise<EditLogRow[]> {
  const { rows } = await getPool().query(
    `SELECT l.*, v.name AS venue_name, v.city_slug, v.slug
       FROM venue_edit_log l JOIN venues v ON v.id = l.venue_id
      ORDER BY l.edited_at DESC LIMIT $1`,
    [limit]
  )
  return rows
}

/** Put a field back to its value before this edit (itself logged as an admin edit). */
export async function revertEdit(logId: number): Promise<{ venueId: number; citySlug: string; slug: string } | null> {
  const { rows } = await getPool().query(
    `SELECT l.*, v.city_slug, v.slug FROM venue_edit_log l JOIN venues v ON v.id = l.venue_id WHERE l.id = $1 AND l.reverted_at IS NULL`,
    [logId]
  )
  const row = rows[0]
  if (!row || !(OWNER_FIELDS as readonly string[]).includes(row.field)) return null
  await saveOwnerData(row.venue_id, { [row.field]: row.old_value } as OwnerData, `admin:revert#${logId}`, null)
  await getPool().query(`UPDATE venue_edit_log SET reverted_at = NOW() WHERE id = $1`, [logId])
  return { venueId: row.venue_id, citySlug: row.city_slug, slug: row.slug }
}

export async function adminQueues() {
  const pool = getPool()
  const [pending, claimed] = await Promise.all([
    pool.query(
      `SELECT c.id, c.name, c.email, c.role, c.method, c.status, c.email_verified, c.created_at, c.venue_id,
              v.name AS venue_name, v.city_slug, v.slug, v.website,
              EXISTS (SELECT 1 FROM venue_claims o WHERE o.venue_id = c.venue_id AND o.id <> c.id AND o.status IN ('verified','approved')) AS has_owner
         FROM venue_claims c LEFT JOIN venues v ON v.id = c.venue_id
        WHERE c.status = 'pending' AND c.venue_id IS NOT NULL
        ORDER BY c.created_at ASC`
    ),
    pool.query(
      `SELECT DISTINCT ON (v.id) v.id AS venue_id, v.name, v.city_slug, v.slug, v.owner_completeness, c.email, c.verified_at
         FROM venue_claims c JOIN venues v ON v.id = c.venue_id
        WHERE c.status IN ('verified','approved')
        ORDER BY v.id, c.verified_at DESC NULLS LAST`
    ),
  ])
  return { pending: pending.rows, claimed: claimed.rows }
}
