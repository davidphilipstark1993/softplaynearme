import {
  completeSend,
  getEligibleSubscribers,
  getNewsletterItems,
  getNextApprovedNewsletter,
  markNewsletterFailed,
  markNewsletterSent,
  recordSkippedSend,
  startSend,
} from './db'
import { sendNewsletterCampaign } from './sendgrid'
import { renderNewsletterHtml } from './template'
import type { NewsletterType, SendTrigger } from './types'

export interface SendRunResult {
  skipped: boolean
  reason?: string
  newsletterId?: number
  sent?: number
  failed?: number
  total?: number
}

/**
 * The single entry point used by both the Sunday cron route and any manual
 * "send now" admin action. Every safety check lives here so neither caller
 * can bypass it:
 *   1. There must be an approved, not-yet-sent newsletter of this type.
 *   2. startSend() takes the DB-level lock — a concurrent/duplicate call
 *      loses the race and comes back null instead of double-sending.
 */
export async function runNewsletterSend(
  type: NewsletterType,
  triggeredBy: SendTrigger
): Promise<SendRunResult> {
  const newsletter = await getNextApprovedNewsletter(type)
  if (!newsletter) {
    return { skipped: true, reason: `No approved, unsent ${type} newsletter found` }
  }

  const send = await startSend(newsletter.id, triggeredBy)
  if (!send) {
    await recordSkippedSend(newsletter.id, 'A send for this newsletter is already running or completed')
    return { skipped: true, reason: 'Already sent or currently sending — duplicate send blocked', newsletterId: newsletter.id }
  }

  try {
    const [items, subscribers] = await Promise.all([
      getNewsletterItems(newsletter.id),
      getEligibleSubscribers(type),
    ])

    if (subscribers.length === 0) {
      await completeSend(send.id, { status: 'completed', sentCount: 0, failedCount: 0, totalRecipients: 0 })
      await markNewsletterSent(newsletter.id)
      return { skipped: false, newsletterId: newsletter.id, sent: 0, failed: 0, total: 0 }
    }

    const result = await sendNewsletterCampaign(
      subscribers.map((s) => ({ email: s.email, unsubscribeToken: s.unsubscribe_token })),
      newsletter.subject,
      (recipient) =>
        renderNewsletterHtml({ newsletter, items, unsubscribeToken: recipient.unsubscribeToken }),
      type
    )

    const allFailed = result.sent === 0 && result.failed > 0
    await completeSend(send.id, {
      status: allFailed ? 'failed' : 'completed',
      sentCount: result.sent,
      failedCount: result.failed,
      errorMessage: result.errors.length ? result.errors.join('; ') : null,
      totalRecipients: subscribers.length,
    })

    if (allFailed) {
      await markNewsletterFailed(newsletter.id)
    } else {
      await markNewsletterSent(newsletter.id)
    }

    return { skipped: false, newsletterId: newsletter.id, sent: result.sent, failed: result.failed, total: subscribers.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during send'
    await completeSend(send.id, { status: 'failed', sentCount: 0, failedCount: 0, errorMessage: message, totalRecipients: 0 })
    await markNewsletterFailed(newsletter.id)
    throw err
  }
}
