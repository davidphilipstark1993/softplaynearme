import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { approveForSending, NotReadyError } from '@/lib/newsletter/db'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

// The publisher approval gate: the only route that can move a newsletter into
// 'approved'. Draft <-> ready_for_review is computed automatically from each
// item's own approval toggle (see lib/newsletter/db.ts recomputeNewsletterStatus) —
// there's nothing to manually set there. This route only ever does the explicit,
// separate "sign off on sending" action, and only once exactly 5 venue picks are
// individually approved. The Sunday cron never calls this — it only reads
// newsletters that are already 'approved'.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = Number((await params).id)

  try {
    const newsletter = await approveForSending(id, 'admin')
    return NextResponse.json({ newsletter })
  } catch (err) {
    if (err instanceof NotReadyError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[admin/newsletter/status] error:', err)
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
  }
}
