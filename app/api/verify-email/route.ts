import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/pool'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.softplaynearme.co.uk'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/verify-email?error=missing`)
  }

  let client
  try {
    client = await getPool().connect()

    const result = await client.query(
      `UPDATE venue_claims
       SET email_verified = TRUE
       WHERE verification_token = $1
         AND email_verified = FALSE
       RETURNING access_token`,
      [token]
    )

    if (result.rows.length === 0) {
      // Token not found or already used — still redirect gracefully
      const lookup = await client.query(
        `SELECT access_token FROM venue_claims WHERE verification_token = $1`,
        [token]
      )
      if (lookup.rows.length > 0) {
        // Already verified — send them to the dashboard
        return NextResponse.redirect(
          `${BASE_URL}/dashboard/${lookup.rows[0].access_token}?verified=1`
        )
      }
      return NextResponse.redirect(`${BASE_URL}/verify-email?error=invalid`)
    }

    const accessToken = result.rows[0].access_token as string
    return NextResponse.redirect(`${BASE_URL}/dashboard/${accessToken}?verified=1`)
  } catch (err) {
    console.error('[verify-email] DB error:', err)
    return NextResponse.redirect(`${BASE_URL}/verify-email?error=server`)
  } finally {
    if (client) client.release()
  }
}
