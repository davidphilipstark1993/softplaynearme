import { NextResponse, type NextRequest } from 'next/server'
import { redirectFor, goneFor } from '@/lib/redirects'

/**
 * 410 Gone for listings removed on purpose (data/gone.json), then one-hop 301s for
 * every old venue URL and merged blog post in data/redirects.json (see lib/redirects.ts).
 * Query strings are carried over.
 */
const GONE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Listing removed | Soft Play Near Me</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;color:#0f172a"><h1>This listing has been removed</h1><p>It wasn't an indoor soft play venue, so it is no longer in the directory.</p><p><a href="/soft-play">Find soft play near you</a></p></body></html>`

export function proxy(request: NextRequest) {
  // Off-category listings removed on purpose answer 410 Gone (data/gone.json).
  if (goneFor(request.nextUrl.pathname)) {
    return new NextResponse(GONE_HTML, { status: 410, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } })
  }
  const destination = redirectFor(request.nextUrl.pathname)
  if (!destination) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = destination
  return NextResponse.redirect(url, 301)
}

export const config = {
  matcher: ['/soft-play/:path*', '/blog/:path*'],
}
