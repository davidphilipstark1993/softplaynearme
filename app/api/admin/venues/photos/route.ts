import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'
import { verifyAdminSessionToken } from '@/lib/adminAuth'
import { getOwnerData, saveOwnerData, photoLimitFor } from '@/lib/claims/db'
import { revalidateVenue } from '@/lib/claims/session'
import { validateOwnerData } from '@/lib/ownerData'
import { uploadVenuePhoto } from '@/lib/venuePhotoUpload'

export const runtime = 'nodejs'

/**
 * Admin photo management for any venue, claimed or not. Photos go into
 * venue_owner_data.photos, the same list the owner dashboard edits, so they show
 * on the venue page straight away, appear in the owner's dashboard if the venue is
 * claimed later, and every change is logged in venue_edit_log (revertable from
 * /admin/owners). The plan's photo limit applies, so an owner saving from their
 * dashboard is never blocked by photos an admin added.
 */

function isAuthed(req: NextRequest): boolean {
  return verifyAdminSessionToken(req.cookies.get('admin_session')?.value)
}

async function getVenue(id: number): Promise<{ id: number; city_slug: string; slug: string } | null> {
  const { rows } = await getPool().query(`SELECT id, city_slug, slug FROM venues WHERE id = $1`, [id])
  return rows[0] ?? null
}

const venueIdFrom = (x: unknown): number | null => {
  const n = Number(x)
  return Number.isInteger(n) && n > 0 ? n : null
}

async function state(venueId: number) {
  const [data, limit] = await Promise.all([getOwnerData(venueId), photoLimitFor(venueId)])
  return { photos: data?.photos ?? [], limit }
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const venueId = venueIdFrom(req.nextUrl.searchParams.get('venueId'))
  if (!venueId) return NextResponse.json({ error: 'Missing venue id' }, { status: 400 })
  try {
    if (!(await getVenue(venueId))) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    return NextResponse.json(await state(venueId))
  } catch (err) {
    console.error('[admin/venues/photos] GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/** Upload one photo (multipart: venueId, file) and add it to the end of the venue's photos. */
export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const form = await req.formData().catch(() => null)
  const venueId = venueIdFrom(form?.get('venueId'))
  if (!venueId) return NextResponse.json({ error: 'Missing venue id' }, { status: 400 })
  try {
    const venue = await getVenue(venueId)
    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    const before = await state(venueId)
    if (before.photos.length >= before.limit) {
      return NextResponse.json({ error: `This venue already has ${before.limit} photos, the most its plan allows. Remove one first.` }, { status: 422 })
    }
    const result = await uploadVenuePhoto(venueId, form?.get('file'), 'admin')
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    // Re-read so two uploads in quick succession don't overwrite each other's list.
    const current = (await getOwnerData(venueId))?.photos ?? []
    await saveOwnerData(venueId, { photos: [...current, result.url].slice(0, before.limit) }, 'admin', null)
    revalidateVenue(venue.city_slug, venue.slug)
    return NextResponse.json(await state(venueId))
  } catch (err) {
    console.error('[admin/venues/photos] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/** Replace the photo list (JSON: venueId, photos) — used to remove and reorder. First photo is the cover. */
export async function PUT(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const venueId = venueIdFrom(body?.venueId)
  if (!venueId) return NextResponse.json({ error: 'Missing venue id' }, { status: 400 })
  const { data, errors } = validateOwnerData({ photos: body?.photos })
  if (errors.length) return NextResponse.json({ error: errors[0] }, { status: 422 })
  try {
    const venue = await getVenue(venueId)
    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    const limit = await photoLimitFor(venueId)
    if ((data.photos?.length ?? 0) > limit) return NextResponse.json({ error: `This venue's plan allows up to ${limit} photos.` }, { status: 422 })
    const changed = await saveOwnerData(venueId, { photos: data.photos?.length ? data.photos : null }, 'admin', null)
    if (changed.length) revalidateVenue(venue.city_slug, venue.slug)
    return NextResponse.json(await state(venueId))
  } catch (err) {
    console.error('[admin/venues/photos] PUT error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
