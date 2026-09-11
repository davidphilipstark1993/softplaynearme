import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { getPool } from '@/lib/pool'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

// Backs the venue picker when adding a "venue" item to a newsletter — search existing venues
// by name instead of letting the newsletter duplicate venue data (Phase 16).
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (q.length < 2) return NextResponse.json({ venues: [] })

  const result = await getPool().query(
    `SELECT id, name, slug, city_slug, images[1] AS image_url
     FROM venues WHERE name ILIKE $1 ORDER BY name ASC LIMIT 20`,
    [`%${q}%`]
  )
  return NextResponse.json({ venues: result.rows })
}
