import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { verifyAdminSessionToken } from '@/lib/adminAuth'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let client
  try {
    client = await getPool().connect()
    const result = await client.query(
      `SELECT id, name, email, venue_name, venue_address, venue_phone, venue_website,
              city_slug, venue_slug, status, email_verified, created_at
       FROM venue_claims
       ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
         created_at DESC`
    )
    return NextResponse.json({ claims: result.rows })
  } catch (err) {
    console.error('[admin/claims] GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { id, status } = await req.json()
  if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  let client
  try {
    client = await getPool().connect()
    await client.query(
      `UPDATE venue_claims SET status = $1 WHERE id = $2`,
      [status, id]
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/claims] PATCH error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
