import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { createNewsletter, listNewsletters } from '@/lib/newsletter/db'
import type { NewsletterType } from '@/lib/newsletter/types'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const newsletters = await listNewsletters()
  return NextResponse.json({ newsletters })
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const type: NewsletterType = body?.type === 'events' ? 'events' : 'weekly'
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : ''
  const weekOf = typeof body?.weekOf === 'string' && body.weekOf ? body.weekOf : null

  if (!subject) {
    return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
  }

  const newsletter = await createNewsletter({ type, weekOf, subject })
  return NextResponse.json({ newsletter }, { status: 201 })
}
