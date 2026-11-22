/**
 * Shared photo upload for venue listings, used by the owner dashboard and the admin
 * venues page. JPEG/PNG/WebP/HEIC up to 8MB in; out comes a JPEG at most 1600px wide,
 * re-encoded by sharp, which drops all EXIF/GPS metadata (rotation is applied first).
 */
import { put } from '@vercel/blob'
import sharp from 'sharp'

const MAX_BYTES = 8 * 1024 * 1024
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export type PhotoUploadResult = { url: string } | { error: string; status: number }

export async function uploadVenuePhoto(venueId: number, file: unknown, prefix: 'owner' | 'admin'): Promise<PhotoUploadResult> {
  if (!(file instanceof File)) return { error: 'No photo received', status: 400 }
  if (!TYPES.has(file.type)) return { error: 'Photos must be JPEG, PNG, WebP or HEIC', status: 422 }
  if (file.size > MAX_BYTES) return { error: 'Photos must be under 8MB', status: 422 }
  try {
    const out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    const blob = await put(`venues/${venueId}/${prefix}-${Date.now()}.jpg`, out, { access: 'public', contentType: 'image/jpeg' })
    return { url: blob.url }
  } catch (err) {
    console.error(`[${prefix}/photo]`, err)
    return { error: 'That photo could not be processed. Please try another.', status: 422 }
  }
}
