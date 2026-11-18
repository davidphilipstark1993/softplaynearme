import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import sharp from 'sharp'
import { getSessionClaim } from '@/lib/claims/session'
import { isVerifiedClaim } from '@/lib/claims/db'

export const runtime = 'nodejs'
const MAX_BYTES = 8 * 1024 * 1024
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

/**
 * Upload one photo. JPEG/PNG/WebP/HEIC up to 8MB in; out comes a JPEG at most 1600px wide,
 * re-encoded by sharp, which drops all EXIF/GPS metadata (rotation is applied first).
 */
export async function POST(req: NextRequest) {
  const claim = await getSessionClaim()
  if (!claim) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (!isVerifiedClaim(claim) || !claim.venue_id) return NextResponse.json({ error: 'Your claim is still being checked.' }, { status: 403 })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No photo received' }, { status: 400 })
  if (!TYPES.has(file.type)) return NextResponse.json({ error: 'Photos must be JPEG, PNG, WebP or HEIC' }, { status: 422 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Photos must be under 8MB' }, { status: 422 })
  try {
    const out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    const blob = await put(`venues/${claim.venue_id}/owner-${Date.now()}.jpg`, out, { access: 'public', contentType: 'image/jpeg' })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('[owner/photo]', err)
    return NextResponse.json({ error: 'That photo could not be processed. Please try another.' }, { status: 422 })
  }
}
