import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { deleteNewsletterItemIfEditable, toggleItemApproval } from '@/lib/newsletter/db'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

// Flips this item's individual approval — the per-item half of the "5/5 venues ready" gate
// that unlocks the whole-newsletter "Approve for Sunday Sending" action.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const result = await toggleItemApproval(Number((await params).itemId))
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const result = await deleteNewsletterItemIfEditable(Number((await params).itemId))
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 })
  return NextResponse.json({ ok: true })
}
