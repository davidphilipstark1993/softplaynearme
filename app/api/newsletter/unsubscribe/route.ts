import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeByToken, type UnsubscribeScope } from '@/lib/newsletter/db'

const VALID_SCOPES: UnsubscribeScope[] = ['weekly', 'events', 'all']

// GET so the link works as a plain click from an email client (one-click unsubscribe),
// per Phase 12 — this must be a real state change, not a dead link.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  const scopeParam = req.nextUrl.searchParams.get('scope') || 'all'
  const scope: UnsubscribeScope = VALID_SCOPES.includes(scopeParam as UnsubscribeScope)
    ? (scopeParam as UnsubscribeScope)
    : 'all'

  if (!token) {
    return NextResponse.redirect(new URL('/newsletter/unsubscribed?status=invalid', req.url))
  }

  try {
    const subscriber = await unsubscribeByToken(token, scope)
    if (!subscriber) {
      return NextResponse.redirect(new URL('/newsletter/unsubscribed?status=invalid', req.url))
    }
    const url = new URL('/newsletter/unsubscribed', req.url)
    url.searchParams.set('status', 'ok')
    url.searchParams.set('scope', scope)
    url.searchParams.set('token', token)
    return NextResponse.redirect(url)
  } catch (err) {
    console.error('[newsletter/unsubscribe] error:', err)
    return NextResponse.redirect(new URL('/newsletter/unsubscribed?status=error', req.url))
  }
}
