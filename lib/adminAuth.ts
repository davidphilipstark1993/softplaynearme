import { createHmac, timingSafeEqual } from 'crypto'

const ADMIN_SECRET = process.env.ADMIN_SECRET
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

/**
 * Session tokens are HMAC-signed with ADMIN_SECRET rather than being the
 * secret itself, so a leaked cookie doesn't hand over the admin password.
 */
export function createAdminSessionToken(): string | null {
  if (!ADMIN_SECRET) return null
  const issuedAt = Date.now().toString()
  const signature = createHmac('sha256', ADMIN_SECRET).update(issuedAt).digest('hex')
  return `${issuedAt}.${signature}`
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  if (!ADMIN_SECRET || !token) return false

  const [issuedAt, signature] = token.split('.')
  if (!issuedAt || !signature) return false
  if (!/^\d+$/.test(issuedAt)) return false
  if (Date.now() - Number(issuedAt) > SESSION_MAX_AGE_MS) return false

  const expected = createHmac('sha256', ADMIN_SECRET).update(issuedAt).digest('hex')
  const expectedBuf = Buffer.from(expected, 'hex')
  const actualBuf = Buffer.from(signature, 'hex')
  if (expectedBuf.length !== actualBuf.length) return false

  return timingSafeEqual(expectedBuf, actualBuf)
}

export function checkAdminPassword(candidate: string): boolean {
  return !!ADMIN_SECRET && candidate === ADMIN_SECRET
}
