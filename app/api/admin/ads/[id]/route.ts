import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { getPool } from '@/lib/pool'
import { isAdminRequest } from '@/lib/ads/request'
import { adInputSchema, firstIssue } from '@/lib/ads/validation'

function parseId(id: string): number | null {
  const n = Number(id)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Full update (the edit form), or `{ status }` alone for quick pause / archive / restore. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const id = parseId((await params).id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const pool = getPool()

  try {
    if (body && Object.keys(body).length === 1 && typeof body.status === 'string') {
      if (!['draft', 'active', 'archived'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 422 })
      }
      if (body.status === 'active') {
        const { rows } = await pool.query(`SELECT image_url, placements FROM ads WHERE id = $1`, [id])
        if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (!rows[0].image_url) return NextResponse.json({ error: 'Upload artwork before activating' }, { status: 422 })
        if (rows[0].placements.length === 0) {
          return NextResponse.json({ error: 'Choose at least one placement before activating' }, { status: 422 })
        }
      }
      const r = await pool.query(`UPDATE ads SET status = $2, updated_at = now() WHERE id = $1`, [id, body.status])
      if (r.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ success: true })
    }

    const parsed = adInputSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 422 })
    const a = parsed.data

    const r = await pool.query(
      `UPDATE ads SET title=$2, description=$3, cta_text=$4, destination_url=$5, image_url=$6, image_alt=$7,
                      advertiser_name=$8, advertiser_type=$9, utm_campaign=$10, status=$11, starts_at=$12,
                      ends_at=$13, priority=$14, placements=$15, city_slugs=$16, updated_at=now()
        WHERE id = $1`,
      [id, a.title, a.description, a.ctaText, a.destinationUrl, a.imageUrl, a.imageAlt, a.advertiserName,
       a.advertiserType, a.utmCampaign, a.status, a.startsAt, a.endsAt, a.priority, a.placements, a.citySlugs]
    )
    if (r.rowCount === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/ads] PATCH error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/** Permanent. Takes the advert's analytics with it (ON DELETE CASCADE) — the UI steers to Archive first. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  const id = parseId((await params).id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  try {
    const pool = getPool()
    const { rows } = await pool.query(`DELETE FROM ads WHERE id = $1 RETURNING image_url`, [id])
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Best-effort cleanup of the artwork, unless another advert still uses it.
    const url: string | null = rows[0].image_url
    if (url && process.env.BLOB_READ_WRITE_TOKEN) {
      const shared = await pool.query(`SELECT 1 FROM ads WHERE image_url = $1 LIMIT 1`, [url])
      if (shared.rowCount === 0) await del(url).catch((e) => console.error('[admin/ads] blob delete:', e))
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/ads] DELETE error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
