import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { getNewsletter } from '@/lib/newsletter/db'
import { runNewsletterSend } from '@/lib/newsletter/send'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

// Manual "send now" for an already-approved newsletter (e.g. re-running a failed send, or
// sending outside the Sunday schedule). Still goes through runNewsletterSend(), so the same
// approval check and duplicate-send lock apply as the cron path — this route cannot send
// anything that isn't in 'approved' status.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = Number((await params).id)
  const newsletter = await getNewsletter(id)
  if (!newsletter) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (newsletter.status !== 'approved') {
    return NextResponse.json({ error: 'Only an approved newsletter can be sent' }, { status: 409 })
  }

  try {
    const result = await runNewsletterSend(newsletter.type, 'manual')
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
