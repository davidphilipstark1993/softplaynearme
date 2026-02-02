import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, message, venueName } = body

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // For MVP, just log the contact - you can add email sending later
    console.log('Contact form submission:', { name, email, phone, message, venueName })

    return NextResponse.json({ success: true, message: 'Message received' })
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
