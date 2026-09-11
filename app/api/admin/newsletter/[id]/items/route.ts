import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { addNewsletterItem, DuplicateItemError, getNewsletter } from '@/lib/newsletter/db'
import type { NewsletterItemType } from '@/lib/newsletter/types'

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

const VALID_TYPES: NewsletterItemType[] = ['venue', 'event', 'offer', 'news', 'link']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const newsletterId = Number((await params).id)

  const newsletter = await getNewsletter(newsletterId)
  if (!newsletter) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (newsletter.status === 'sent') {
    return NextResponse.json({ error: 'A sent newsletter cannot be edited' }, { status: 409 })
  }

  const body = await req.json().catch(() => null)

  const itemType = body?.itemType as NewsletterItemType | undefined
  const title = typeof body?.title === 'string' ? body.title.trim() : ''

  if (!itemType || !VALID_TYPES.includes(itemType)) {
    return NextResponse.json({ error: 'Invalid item type' }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (itemType === 'venue' && !body?.venueId) {
    return NextResponse.json({ error: 'A venue must be selected' }, { status: 400 })
  }

  try {
    const item = await addNewsletterItem(newsletterId, {
      itemType,
      venueId: itemType === 'venue' ? Number(body.venueId) : null,
      title,
      description: typeof body?.description === 'string' ? body.description.trim() : null,
      url: typeof body?.url === 'string' ? body.url.trim() : null,
      imageUrl: typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : null,
      citySlug: typeof body?.citySlug === 'string' ? body.citySlug.trim() : null,
      eventDate: typeof body?.eventDate === 'string' && body.eventDate ? body.eventDate : null,
      displayOrder: typeof body?.displayOrder === 'number' ? body.displayOrder : 0,
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    if (err instanceof DuplicateItemError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    throw err
  }
}
