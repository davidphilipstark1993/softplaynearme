import { NextRequest, NextResponse } from 'next/server'
import { runNewsletterSend } from '@/lib/newsletter/send'
import type { NewsletterType } from '@/lib/newsletter/types'

export const maxDuration = 60

const VALID_TYPES: NewsletterType[] = ['weekly', 'events']

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/**
 * Triggered by the Sunday morning GitHub Actions workflow (and callable manually with the same
 * bearer token for a re-run). All the actual safety logic — approval required, not already
 * sent, duplicate-send protection — lives in runNewsletterSend()/startSend() so this route is
 * just plumbing: authenticate, run, report what happened.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const typeParam = req.nextUrl.searchParams.get('type') || 'weekly'
  if (!VALID_TYPES.includes(typeParam as NewsletterType)) {
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }
  const type = typeParam as NewsletterType

  try {
    const result = await runNewsletterSend(type, 'cron')

    if (result.skipped) {
      console.log(`[cron/send-newsletter] Skipped (${type}): ${result.reason}`)
      return NextResponse.json({ sent: false, ...result })
    }

    console.log(
      `[cron/send-newsletter] Sent newsletter ${result.newsletterId} (${type}): ${result.sent} sent, ${result.failed} failed of ${result.total}`
    )
    return NextResponse.json({ sent: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[cron/send-newsletter] FAILED (${type}):`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
