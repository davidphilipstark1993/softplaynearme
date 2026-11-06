import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { isAdminRequest, rateLimit, clientIp } from '@/lib/ads/request'
import { ImageError, MAX_UPLOAD_BYTES, processAdImage } from '@/lib/ads/image'

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  if (!rateLimit(`ad-upload:${clientIp(req)}`, 30, 60 * 60_000)) {
    return NextResponse.json({ error: 'Too many uploads — try again later' }, { status: 429 })
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Image storage (BLOB_READ_WRITE_TOKEN) is not configured in this environment' },
      { status: 503 }
    )
  }

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size === 0) return NextResponse.json({ error: 'File is empty' }, { status: 422 })
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image must be under 4MB' }, { status: 422 })
    }

    const processed = await processAdImage(Buffer.from(await file.arrayBuffer()))
    const blob = await put(`ads/${crypto.randomUUID()}.webp`, processed.buffer, {
      access: 'public',
      contentType: 'image/webp',
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    })

    return NextResponse.json({
      url: blob.url,
      width: processed.width,
      height: processed.height,
      cropped: processed.cropped,
    })
  } catch (err) {
    if (err instanceof ImageError) return NextResponse.json({ error: err.message }, { status: 422 })
    console.error('[admin/ads] upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
