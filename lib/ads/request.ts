import type { NextRequest } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { isBotUserAgent } from './guards'

export { rateLimit, cleanPath, isBotUserAgent } from './guards'

export function isAdminRequest(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

/** Whether this hit should be counted: not a bot and not the site owner browsing their own site. */
export function shouldCount(req: NextRequest): boolean {
  return !isBotUserAgent(req.headers.get('user-agent')) && !isAdminRequest(req)
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

