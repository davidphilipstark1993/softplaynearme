import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { listAllSubscribersForExport } from '@/lib/newsletter/db'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

// Server-side CSV so the subscriber list (private data — Phase 17) never has to round-trip
// through a client-built data: URL, and admin auth gates the download the same as every other
// newsletter admin endpoint.
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const subscribers = await listAllSubscribersForExport()
  const header = 'email,weekly_newsletter,events_activities,status,source,subscribed_at,unsubscribed_at'
  const rows = subscribers.map((s) =>
    [
      s.email,
      s.weekly_newsletter,
      s.events_activities,
      s.status,
      s.source ?? '',
      s.subscribed_at,
      s.unsubscribed_at ?? '',
    ]
      .map((v) => csvEscape(String(v)))
      .join(',')
  )
  const csv = [header, ...rows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"',
    },
  })
}
