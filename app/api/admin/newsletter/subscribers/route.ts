import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { getSubscriberStats, listSubscribers } from '@/lib/newsletter/db'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10) || 1)
  const search = req.nextUrl.searchParams.get('search')?.trim() || undefined
  const statusParam = req.nextUrl.searchParams.get('status')
  const status = statusParam === 'subscribed' || statusParam === 'unsubscribed' ? statusParam : undefined

  const [{ subscribers, total }, stats] = await Promise.all([
    listSubscribers({ page, search, status }),
    getSubscriberStats(),
  ])

  return NextResponse.json({ subscribers, total, page, stats })
}
