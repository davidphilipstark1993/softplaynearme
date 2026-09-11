import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { getNewsletter, getNewsletterItems, listSendsForNewsletter, updateNewsletterContent } from '@/lib/newsletter/db'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = Number((await params).id)
  const newsletter = await getNewsletter(id)
  if (!newsletter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [items, sends] = await Promise.all([getNewsletterItems(id), listSendsForNewsletter(id)])
  return NextResponse.json({ newsletter, items, sends })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = Number((await params).id)
  const existing = await getNewsletter(id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'sent') {
    return NextResponse.json({ error: 'A sent newsletter cannot be edited' }, { status: 409 })
  }

  const body = await req.json().catch(() => null)
  const newsletter = await updateNewsletterContent(id, {
    subject: typeof body?.subject === 'string' ? body.subject.trim() : undefined,
    introHtml: typeof body?.introHtml === 'string' ? body.introHtml : undefined,
    weekOf: typeof body?.weekOf === 'string' ? body.weekOf : undefined,
    scheduledSendAt: typeof body?.scheduledSendAt === 'string' ? body.scheduledSendAt : undefined,
  })
  return NextResponse.json({ newsletter })
}
