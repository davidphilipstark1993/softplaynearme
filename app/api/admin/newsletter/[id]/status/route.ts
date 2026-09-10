import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { InvalidTransitionError, transitionNewsletterStatus } from '@/lib/newsletter/db'
import type { NewsletterStatus } from '@/lib/newsletter/types'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

const VALID_STATUSES: NewsletterStatus[] = ['draft', 'ready_for_review', 'approved', 'sent', 'failed']

// Publisher approval gate: this is the only route that can move a newsletter into
// "approved", and it explicitly requires an admin session — the Sunday cron never calls this,
// it only reads newsletters that are already approved (see lib/newsletter/db.ts ALLOWED_TRANSITIONS,
// which doesn't let anything transition into 'sent' from here either — only runNewsletterSend does that).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = Number((await params).id)
  const body = await req.json().catch(() => null)
  const status = body?.status as NewsletterStatus | undefined

  if (!status || !VALID_STATUSES.includes(status) || status === 'sent') {
    return NextResponse.json({ error: 'Invalid target status' }, { status: 400 })
  }

  try {
    const newsletter = await transitionNewsletterStatus(id, status, 'admin')
    return NextResponse.json({ newsletter })
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[admin/newsletter/status] error:', err)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
