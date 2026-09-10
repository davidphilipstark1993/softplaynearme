import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { getNewsletter, getNewsletterItems } from '@/lib/newsletter/db'
import { renderNewsletterHtml } from '@/lib/newsletter/template'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const id = Number((await params).id)
  const newsletter = await getNewsletter(id)
  if (!newsletter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await getNewsletterItems(id)
  const html = renderNewsletterHtml({
    newsletter,
    items,
    unsubscribeUrl: '#preview-unsubscribe-link',
    preferencesUrl: '#preview-preferences-link',
  })

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
