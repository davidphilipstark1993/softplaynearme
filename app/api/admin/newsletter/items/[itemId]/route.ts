import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { deleteNewsletterItemIfEditable } from '@/lib/newsletter/db'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const result = await deleteNewsletterItemIfEditable(Number((await params).itemId))
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 })
  return NextResponse.json({ ok: true })
}
