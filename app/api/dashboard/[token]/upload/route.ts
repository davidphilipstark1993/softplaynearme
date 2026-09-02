import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getPool } from '@/lib/pool'

// ── In-memory rate limiter: 30 uploads per hour per token ────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(token: string): boolean {
  const now = Date.now()
  const entry = rateLimits.get(token)
  if (!entry || now > entry.resetAt) {
    rateLimits.set(token, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 30) return false
  entry.count++
  return true
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_SIZE = 4 * 1024 * 1024 // 4MB — stays under the platform request-body limit

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  if (!checkRateLimit(token)) {
    return NextResponse.json(
      { error: 'Too many uploads — please wait before uploading more photos' },
      { status: 429 }
    )
  }

  let client
  try {
    client = await getPool().connect()

    const claimResult = await client.query(
      `SELECT city_slug, venue_slug FROM venue_claims WHERE access_token = $1 LIMIT 1`,
      [token]
    )
    if (claimResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    const { city_slug, venue_slug } = claimResult.rows[0]
    if (!city_slug || !venue_slug) {
      return NextResponse.json({ error: 'No venue linked to this claim yet' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Photo must be a JPEG, PNG, WebP, or GIF image' }, { status: 422 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Photo must be under 4MB' }, { status: 422 })
    }

    const ext = file.type.split('/')[1]
    const pathname = `venues/${city_slug}/${venue_slug}/${crypto.randomUUID()}.${ext}`

    const blob = await put(pathname, file, {
      access: 'public',
      contentType: file.type,
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('Dashboard photo upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
