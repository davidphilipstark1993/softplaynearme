import sharp from 'sharp'
import { AD_IMAGE_HEIGHT, AD_IMAGE_WIDTH } from './placements'

export const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp'])
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // stays under the platform request-body limit
const MIN_WIDTH = 640

export class ImageError extends Error {}

export interface ProcessedImage {
  buffer: Buffer
  width: number
  height: number
  /** True when the original wasn't 16:9 and had to be cropped. */
  cropped: boolean
}

/**
 * Validates by decoding (not by trusting the browser-supplied MIME type or
 * file extension), then re-encodes to a 1280x720 WebP. Re-encoding also drops
 * EXIF/GPS data and anything smuggled into the file.
 */
export async function processAdImage(input: Buffer): Promise<ProcessedImage> {
  let meta: sharp.Metadata
  try {
    meta = await sharp(input, { limitInputPixels: 50_000_000 }).metadata()
  } catch {
    throw new ImageError('That file could not be read as an image')
  }
  if (!meta.format || !ALLOWED_IMAGE_FORMATS.has(meta.format)) {
    throw new ImageError('Image must be a JPEG, PNG or WebP file')
  }
  if (!meta.width || !meta.height) throw new ImageError('Image has no dimensions')
  if (meta.width < MIN_WIDTH) {
    throw new ImageError(`Image is too small — use at least ${MIN_WIDTH}px wide (1280×720 is ideal)`)
  }

  const ratio = meta.width / meta.height
  const cropped = Math.abs(ratio - 16 / 9) > 0.02

  const buffer = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate() // honour EXIF orientation before metadata is stripped
    .resize(AD_IMAGE_WIDTH, AD_IMAGE_HEIGHT, { fit: 'cover', position: 'attention', withoutEnlargement: false })
    .webp({ quality: 82 })
    .toBuffer()

  return { buffer, width: AD_IMAGE_WIDTH, height: AD_IMAGE_HEIGHT, cropped }
}
