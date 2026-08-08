import { NextRequest, NextResponse } from 'next/server'
import { sendContactFormNotification } from '@/lib/email'

const VALID_TOPICS = ['General enquiry', 'Add or claim a venue', 'Report an error', 'Other']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, topic, message } = body || {}

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    await sendContactFormNotification({
      name: name.trim().slice(0, 100),
      email: email.trim().slice(0, 150),
      phone: phone?.trim()?.slice(0, 30) || undefined,
      topic: VALID_TOPICS.includes(topic) ? topic : 'General enquiry',
      message: message.trim().slice(0, 5000),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contact] Failed to process submission:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again or email info@softplaynearme.co.uk' }, { status: 500 })
  }
}
