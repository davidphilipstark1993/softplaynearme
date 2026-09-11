import { sendAdminOperationalNotification } from '@/lib/email'
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
import { PREF_URL_TAG, sendNewsletterCampaign, UNSUB_URL_TAG } from './sendgrid'
import { renderNewsletterHtml, renderNewsletterPlainText } from './template'
import type { NewsletterType, SendTrigger } from './types'

const BASE_URL = 'https://www.softplaynearme.co.uk'

export interface SendRunResult {
  skipped: boolean
  reason?: string
  newsletterId?: number
  sent?: number
  failed?: number
  total?: number
}

/**
 * The single entry point used by the Sunday send (scripts/newsletter/weekly-send.mjs, run
 * directly by GitHub Actions) and by the admin "Send now" button — kept as one function so the
 * two paths can never drift into producing different content for the same newsletter, and so
 * every safety check lives in one place neither caller can bypass:
 *   1. There must be an approved, not-yet-sent newsletter of this type.
 *   2. startSend() takes the DB-level lock — a concurrent/duplicate call loses the race and
 *      comes back null instead of double-sending.
 */
export async function runNewsletterSend(
  type: NewsletterType,
  triggeredBy: SendTrigger
): Promise<SendRunResult> {
  const newsletter = await getNextApprovedNewsletter(type)
  if (!newsletter) {
    const reason = `No approved, unsent ${type} newsletter found`
    await sendAdminOperationalNotification(
      `Newsletter not sent this week — nothing approved (${type})`,
      `${reason}.\n\nAdd content and approve it at ${BASE_URL}/admin/newsletter whenever it's ready — nothing is sent automatically until you do.`
    )
    return { skipped: true, reason }
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
      await sendAdminOperationalNotification(
        `Newsletter not sent — no active subscribers (issue #${newsletter.issue_number ?? newsletter.id})`,
        `This week's newsletter ("${newsletter.subject}") was fully approved and its content was generated, but there are no active subscribers on the ${type} list to send it to.`
      )
      return { skipped: false, newsletterId: newsletter.id, sent: 0, failed: 0, total: 0 }
    }

    const scope = type === 'weekly' ? 'weekly' : 'events'
    const html = renderNewsletterHtml({
      newsletter,
      items,
      unsubscribeUrl: `${BASE_URL}/api/newsletter/unsubscribe?token=${UNSUB_URL_TAG}&scope=${scope}`,
      preferencesUrl: `${BASE_URL}/newsletter/preferences?token=${PREF_URL_TAG}`,
    })
    const plainText = renderNewsletterPlainText({
      newsletter,
      items,
      unsubscribeUrl: `${BASE_URL}/api/newsletter/unsubscribe?token=${UNSUB_URL_TAG}&scope=${scope}`,
      preferencesUrl: `${BASE_URL}/newsletter/preferences?token=${PREF_URL_TAG}`,
    })

    const result = await sendNewsletterCampaign(
      subscribers.map((s) => ({
        email: s.email,
        unsubscribeUrl: `${BASE_URL}/api/newsletter/unsubscribe?token=${s.unsubscribe_token}&scope=${scope}`,
        preferencesUrl: `${BASE_URL}/newsletter/preferences?token=${s.unsubscribe_token}`,
      })),
      newsletter.subject,
      html,
      plainText,
      newsletter.id,
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
      await sendAdminOperationalNotification(
        `Newsletter send FAILED — issue #${newsletter.issue_number ?? newsletter.id}`,
        `The send for "${newsletter.subject}" failed for all ${subscribers.length} recipients.\n\nErrors:\n${result.errors.join('\n')}`
      )
    } else {
      await markNewsletterSent(newsletter.id)
      await sendAdminOperationalNotification(
        `Newsletter sent — issue #${newsletter.issue_number ?? newsletter.id}`,
        `"${newsletter.subject}" was sent successfully.\n\nRecipients: ${result.sent} sent, ${result.failed} failed of ${subscribers.length}\nSendGrid message id: ${result.lastMessageId ?? 'n/a'}\nSent at: ${new Date().toISOString()}${
          newsletter.slug ? `\n\nArchive page: ${BASE_URL}/newsletter/${newsletter.slug}` : ''
        }`
      )
    }

    return { skipped: false, newsletterId: newsletter.id, sent: result.sent, failed: result.failed, total: subscribers.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during send'
    await completeSend(send.id, { status: 'failed', sentCount: 0, failedCount: 0, errorMessage: message, totalRecipients: 0 })
    await markNewsletterFailed(newsletter.id)
    await sendAdminOperationalNotification(
      `Newsletter send CRASHED — issue #${newsletter.issue_number ?? newsletter.id}`,
      `The weekly newsletter send job crashed:\n\n${message}`
    )
    throw err
  }
}
