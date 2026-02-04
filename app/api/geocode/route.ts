import { NextRequest, NextResponse } from 'next/server'
import { geocodePostcode, isValidUKPostcode, formatPostcode } from '@/lib/geo'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const postcode = searchParams.get('postcode')

  if (!postcode) {
    return NextResponse.json(
      { error: 'Postcode is required' },
      { status: 400 }
    )
  }

  if (!isValidUKPostcode(postcode)) {
    return NextResponse.json(
      { error: 'Invalid UK postcode format' },
      { status: 400 }
    )
  }

  const result = await geocodePostcode(postcode)

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: 404 }
    )
  }

  return NextResponse.json({
    postcode: result.postcode,
    lat: result.lat,
    lng: result.lng,
    region: result.region,
    admin_district: result.admin_district
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postcode } = body

    if (!postcode) {
      return NextResponse.json(
        { error: 'Postcode is required' },
        { status: 400 }
      )
    }

    if (!isValidUKPostcode(postcode)) {
      return NextResponse.json(
        { error: 'Invalid UK postcode format' },
        { status: 400 }
      )
    }

    const result = await geocodePostcode(postcode)

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      )
    }

    return NextResponse.json({
      postcode: result.postcode,
      lat: result.lat,
      lng: result.lng,
      region: result.region,
      admin_district: result.admin_district
    })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
