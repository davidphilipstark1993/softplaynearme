/**
 * Sign-in links and the owner session. No passwords anywhere:
 *
 *  - A sign-in link carries a random 256-bit token. Only its sha256 is stored
 *    (owner_login_tokens.token_hash), it expires after 24 hours, and it can be used once.
 *  - Using it sets an `owner_session` cookie: "<claimId>.<expiresAt>.<hmac>", signed with
 *    OWNER_SESSION_SECRET (falling back to ADMIN_SECRET), valid for 30 days.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

export const LOGIN_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const SESSION_COOKIE = 'owner_session'

export function newLoginToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** A stored token row is usable only if it exists, is unused and hasn't expired. */
export function isTokenUsable(row: { expires_at: Date | string; used_at: Date | string | null } | null | undefined, now = new Date()): boolean {
  if (!row) return false
  if (row.used_at) return false
  return new Date(row.expires_at).getTime() > now.getTime()
}

function secret(): string | null {
  return process.env.OWNER_SESSION_SECRET || process.env.ADMIN_SECRET || null
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(`owner:${payload}`).digest('hex')
}

export function createSessionValue(claimId: number, now = Date.now()): string | null {
  const key = secret()
  if (!key) return null
  const payload = `${claimId}.${now + SESSION_TTL_MS}`
  return `${payload}.${sign(payload, key)}`
}

/** The claim id a session cookie belongs to, or null if it is missing, forged or expired. */
export function readSessionValue(value: string | null | undefined, now = Date.now()): number | null {
  const key = secret()
  if (!key || !value) return null
  const parts = value.split('.')
  if (parts.length !== 3) return null
  const [id, exp, sig] = parts
  const expected = sign(`${id}.${exp}`, key)
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (!/^\d+$/.test(id) || !/^\d+$/.test(exp) || Number(exp) < now) return null
  return Number(id)
}

/** sha256 of the client IP with the session secret, so rate limits never store raw IPs. */
export function hashIp(ip: string | null | undefined): string {
  return createHash('sha256').update(`${secret() ?? 'spnm'}:${ip ?? 'unknown'}`).digest('hex')
}
