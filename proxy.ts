import { NextResponse, type NextRequest } from 'next/server'
import { redirectFor } from '@/lib/redirects'

/**
 * One-hop 301s for every old venue URL, and merged blog posts, in data/redirects.json
 * (see lib/redirects.ts).
 * Query strings are carried over.
 */
export function proxy(request: NextRequest) {
  const destination = redirectFor(request.nextUrl.pathname)
  if (!destination) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = destination
  return NextResponse.redirect(url, 301)
}

export const config = {
  matcher: ['/soft-play/:path*', '/blog/:path*'],
}
