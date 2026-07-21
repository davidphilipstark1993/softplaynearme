import { NextRequest, NextResponse } from 'next/server'
import { checkAdminPassword, createAdminSessionToken } from '@/lib/adminAuth'

export async function POST(req: NextRequest) {
  const { secret } = await req.json()

  if (!checkAdminPassword(secret)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = createAdminSessionToken()
  if (!token) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set('admin_session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
  return res
}
