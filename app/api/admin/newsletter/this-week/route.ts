import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { getOrCreateThisWeeksNewsletter } from '@/lib/newsletter/db'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

// Finds (or creates) the weekly newsletter targeting the upcoming Sunday — there is always
// exactly one live weekly issue at a time, so there's nothing to remember to create manually.
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const newsletter = await getOrCreateThisWeeksNewsletter()
  return NextResponse.json({ newsletter })
}
