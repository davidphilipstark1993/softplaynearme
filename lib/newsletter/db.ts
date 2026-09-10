import { getPool } from '@/lib/pool'
import type {
  Newsletter,
  NewsletterItem,
  NewsletterSend,
  NewsletterStatus,
  NewsletterSubscriber,
  NewsletterType,
  SendTrigger,
} from './types'

// ─── Subscribers ────────────────────────────────────────────────────────────

export type SubscribeOutcome = 'created' | 'updated' | 'already_subscribed'

export interface SubscribeInput {
  email: string
  weeklyNewsletter: boolean
  eventsActivities: boolean
  source: string
}

/**
 * Upserts by email so the same address never gets a second row. If the
 * subscriber already receives everything being requested, no write happens
 * and the caller gets 'already_subscribed' back.
 */
export async function subscribeEmail(
  input: SubscribeInput
): Promise<{ subscriber: NewsletterSubscriber; outcome: SubscribeOutcome }> {
  const email = input.email.trim().toLowerCase()
  const client = await getPool().connect()
  try {
    const existing = await client.query<NewsletterSubscriber>(
      `SELECT * FROM newsletter_subscribers WHERE email = $1`,
      [email]
    )

    if (existing.rows.length === 0) {
      const inserted = await client.query<NewsletterSubscriber>(
        `INSERT INTO newsletter_subscribers (email, weekly_newsletter, events_activities, source, status)
         VALUES ($1, $2, $3, $4, 'subscribed')
         RETURNING *`,
        [email, input.weeklyNewsletter, input.eventsActivities, input.source]
      )
      return { subscriber: inserted.rows[0], outcome: 'created' }
    }

    const current = existing.rows[0]
    const alreadyHasEverythingRequested =
      current.status === 'subscribed' &&
      (!input.weeklyNewsletter || current.weekly_newsletter) &&
      (!input.eventsActivities || current.events_activities)

    if (alreadyHasEverythingRequested) {
      return { subscriber: current, outcome: 'already_subscribed' }
    }

    const updated = await client.query<NewsletterSubscriber>(
      `UPDATE newsletter_subscribers SET
         weekly_newsletter = weekly_newsletter OR $2,
         events_activities = events_activities OR $3,
         status = 'subscribed',
         unsubscribed_at = NULL,
         updated_at = NOW()
       WHERE email = $1
       RETURNING *`,
      [email, input.weeklyNewsletter, input.eventsActivities]
    )
    return { subscriber: updated.rows[0], outcome: 'updated' }
  } finally {
    client.release()
  }
}

export async function getSubscriberByToken(token: string): Promise<NewsletterSubscriber | null> {
  const result = await getPool().query<NewsletterSubscriber>(
    `SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = $1`,
    [token]
  )
  return result.rows[0] ?? null
}

export type UnsubscribeScope = 'weekly' | 'events' | 'all'

export async function unsubscribeByToken(
  token: string,
  scope: UnsubscribeScope
): Promise<NewsletterSubscriber | null> {
  const client = await getPool().connect()
  try {
    const current = await client.query<NewsletterSubscriber>(
      `SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = $1`,
      [token]
    )
    if (current.rows.length === 0) return null

    if (scope === 'all') {
      const result = await client.query<NewsletterSubscriber>(
        `UPDATE newsletter_subscribers SET
           status = 'unsubscribed', weekly_newsletter = false, events_activities = false,
           unsubscribed_at = NOW(), updated_at = NOW()
         WHERE unsubscribe_token = $1 RETURNING *`,
        [token]
      )
      return result.rows[0]
    }

    const column = scope === 'weekly' ? 'weekly_newsletter' : 'events_activities'
    const result = await client.query<NewsletterSubscriber>(
      `UPDATE newsletter_subscribers SET
         ${column} = false,
         status = CASE WHEN NOT (
           CASE WHEN $2 = 'weekly_newsletter' THEN events_activities ELSE weekly_newsletter END
         ) THEN 'unsubscribed' ELSE status END,
         unsubscribed_at = CASE WHEN NOT (
           CASE WHEN $2 = 'weekly_newsletter' THEN events_activities ELSE weekly_newsletter END
         ) THEN NOW() ELSE unsubscribed_at END,
         updated_at = NOW()
       WHERE unsubscribe_token = $1 RETURNING *`,
      [token, column]
    )
    return result.rows[0]
  } finally {
    client.release()
  }
}

export async function updatePreferencesByToken(
  token: string,
  prefs: { weeklyNewsletter: boolean; eventsActivities: boolean }
): Promise<NewsletterSubscriber | null> {
  const bothOff = !prefs.weeklyNewsletter && !prefs.eventsActivities
  const result = await getPool().query<NewsletterSubscriber>(
    `UPDATE newsletter_subscribers SET
       weekly_newsletter = $2,
       events_activities = $3,
       status = CASE WHEN $4 THEN 'unsubscribed' ELSE 'subscribed' END,
       unsubscribed_at = CASE WHEN $4 THEN NOW() ELSE NULL END,
       updated_at = NOW()
     WHERE unsubscribe_token = $1 RETURNING *`,
    [token, prefs.weeklyNewsletter, prefs.eventsActivities, bothOff]
  )
  return result.rows[0] ?? null
}

export async function getEligibleSubscribers(type: NewsletterType): Promise<NewsletterSubscriber[]> {
  const column = type === 'weekly' ? 'weekly_newsletter' : 'events_activities'
  const result = await getPool().query<NewsletterSubscriber>(
    `SELECT * FROM newsletter_subscribers WHERE status = 'subscribed' AND ${column} = true ORDER BY id`
  )
  return result.rows
}

export interface SubscriberListParams {
  page: number
  search?: string
  status?: 'subscribed' | 'unsubscribed'
}

const SUBSCRIBER_PAGE_SIZE = 50

export async function listSubscribers(
  params: SubscriberListParams
): Promise<{ subscribers: NewsletterSubscriber[]; total: number }> {
  const where: string[] = []
  const values: unknown[] = []

  if (params.search) {
    values.push(`%${params.search}%`)
    where.push(`email ILIKE $${values.length}`)
  }
  if (params.status) {
    values.push(params.status)
    where.push(`status = $${values.length}`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const countResult = await getPool().query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM newsletter_subscribers ${whereSql}`,
    values
  )

  values.push(SUBSCRIBER_PAGE_SIZE, (params.page - 1) * SUBSCRIBER_PAGE_SIZE)
  const result = await getPool().query<NewsletterSubscriber>(
    `SELECT * FROM newsletter_subscribers ${whereSql}
     ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  )

  return { subscribers: result.rows, total: countResult.rows[0]?.total ?? 0 }
}

export async function getSubscriberStats() {
  const result = await getPool().query<{
    total_subscribed: number
    weekly_subscribed: number
    events_subscribed: number
    total_unsubscribed: number
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'subscribed')::int AS total_subscribed,
      COUNT(*) FILTER (WHERE status = 'subscribed' AND weekly_newsletter)::int AS weekly_subscribed,
      COUNT(*) FILTER (WHERE status = 'subscribed' AND events_activities)::int AS events_subscribed,
      COUNT(*) FILTER (WHERE status = 'unsubscribed')::int AS total_unsubscribed
    FROM newsletter_subscribers
  `)
  return result.rows[0]
}

export async function listAllSubscribersForExport(): Promise<NewsletterSubscriber[]> {
  const result = await getPool().query<NewsletterSubscriber>(
    `SELECT * FROM newsletter_subscribers ORDER BY created_at DESC`
  )
  return result.rows
}

// ─── Newsletters ────────────────────────────────────────────────────────────

export async function listNewsletters(): Promise<Newsletter[]> {
  const result = await getPool().query<Newsletter>(
    `SELECT * FROM newsletters ORDER BY created_at DESC LIMIT 100`
  )
  return result.rows
}

export async function getNewsletter(id: number): Promise<Newsletter | null> {
  const result = await getPool().query<Newsletter>(`SELECT * FROM newsletters WHERE id = $1`, [id])
  return result.rows[0] ?? null
}

export async function createNewsletter(input: {
  type: NewsletterType
  weekOf: string | null
  subject: string
}): Promise<Newsletter> {
  const result = await getPool().query<Newsletter>(
    `INSERT INTO newsletters (type, week_of, subject, status) VALUES ($1, $2, $3, 'draft') RETURNING *`,
    [input.type, input.weekOf, input.subject]
  )
  return result.rows[0]
}

export async function updateNewsletterContent(
  id: number,
  fields: { subject?: string; introHtml?: string; weekOf?: string | null; scheduledSendAt?: string | null }
): Promise<Newsletter | null> {
  const result = await getPool().query<Newsletter>(
    `UPDATE newsletters SET
       subject = COALESCE($2, subject),
       intro_html = COALESCE($3, intro_html),
       week_of = COALESCE($4, week_of),
       scheduled_send_at = COALESCE($5, scheduled_send_at),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, fields.subject ?? null, fields.introHtml ?? null, fields.weekOf ?? null, fields.scheduledSendAt ?? null]
  )
  return result.rows[0] ?? null
}

const ALLOWED_TRANSITIONS: Record<NewsletterStatus, NewsletterStatus[]> = {
  draft: ['ready_for_review'],
  ready_for_review: ['draft', 'approved'],
  approved: ['draft'], // pulling back an approval before send is allowed
  sent: [],
  failed: ['draft'],
}

export class InvalidTransitionError extends Error {}

export async function transitionNewsletterStatus(
  id: number,
  newStatus: NewsletterStatus,
  approvedBy?: string
): Promise<Newsletter> {
  const current = await getNewsletter(id)
  if (!current) throw new Error('Newsletter not found')

  if (!ALLOWED_TRANSITIONS[current.status].includes(newStatus)) {
    throw new InvalidTransitionError(
      `Cannot move newsletter from "${current.status}" to "${newStatus}"`
    )
  }

  // $2 is cast explicitly — used both as the assigned value and in a string comparison
  // below, and Postgres can't unify those two inferred types (varchar column vs text
  // literal) without it, failing with "inconsistent types deduced for parameter $2".
  const result = await getPool().query<Newsletter>(
    `UPDATE newsletters SET
       status = $2::varchar,
       approved_at = CASE WHEN $2::varchar = 'approved' THEN NOW() ELSE approved_at END,
       approved_by = CASE WHEN $2::varchar = 'approved' THEN $3 ELSE approved_by END,
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, newStatus, approvedBy ?? null]
  )
  return result.rows[0]
}

/** The one newsletter of this type the Sunday cron is allowed to send: approved and not yet sent. */
export async function getNextApprovedNewsletter(type: NewsletterType): Promise<Newsletter | null> {
  const result = await getPool().query<Newsletter>(
    `SELECT * FROM newsletters
     WHERE type = $1 AND status = 'approved' AND sent_at IS NULL
     ORDER BY COALESCE(scheduled_send_at, week_of::timestamptz, created_at) ASC
     LIMIT 1`,
    [type]
  )
  return result.rows[0] ?? null
}

export async function markNewsletterSent(id: number): Promise<void> {
  await getPool().query(
    `UPDATE newsletters SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id]
  )
}

export async function markNewsletterFailed(id: number): Promise<void> {
  await getPool().query(
    `UPDATE newsletters SET status = 'failed', updated_at = NOW() WHERE id = $1`,
    [id]
  )
}

// ─── Newsletter items ───────────────────────────────────────────────────────

export async function getNewsletterItems(newsletterId: number): Promise<NewsletterItem[]> {
  const result = await getPool().query<NewsletterItem>(
    `SELECT ni.*, v.slug AS venue_slug, v.name AS venue_name
     FROM newsletter_items ni
     LEFT JOIN venues v ON v.id = ni.venue_id
     WHERE ni.newsletter_id = $1
     ORDER BY ni.display_order ASC, ni.id ASC`,
    [newsletterId]
  )
  return result.rows
}

export interface NewItemInput {
  itemType: NewsletterItem['item_type']
  venueId?: number | null
  title: string
  description?: string | null
  url?: string | null
  imageUrl?: string | null
  citySlug?: string | null
  eventDate?: string | null
  displayOrder?: number
}

export async function addNewsletterItem(
  newsletterId: number,
  item: NewItemInput
): Promise<NewsletterItem> {
  const result = await getPool().query<NewsletterItem>(
    `INSERT INTO newsletter_items
       (newsletter_id, item_type, venue_id, title, description, url, image_url, city_slug, event_date, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      newsletterId,
      item.itemType,
      item.venueId ?? null,
      item.title,
      item.description ?? null,
      item.url ?? null,
      item.imageUrl ?? null,
      item.citySlug ?? null,
      item.eventDate ?? null,
      item.displayOrder ?? 0,
    ]
  )
  return result.rows[0]
}

/** Locks item deletion the same way content edits are locked — see PUT /api/admin/newsletter/[id]. */
export async function deleteNewsletterItemIfEditable(itemId: number): Promise<{ ok: boolean; reason?: string }> {
  const result = await getPool().query<{ status: NewsletterStatus }>(
    `SELECT n.status FROM newsletter_items ni JOIN newsletters n ON n.id = ni.newsletter_id WHERE ni.id = $1`,
    [itemId]
  )
  const status = result.rows[0]?.status
  if (!status) return { ok: false, reason: 'Item not found' }
  if (status !== 'draft' && status !== 'ready_for_review') {
    return { ok: false, reason: `Cannot edit a newsletter that is ${status.replace('_', ' ')} — move it back to draft first` }
  }
  await getPool().query(`DELETE FROM newsletter_items WHERE id = $1`, [itemId])
  return { ok: true }
}

// ─── Send log ───────────────────────────────────────────────────────────────

/**
 * Inserts the send record before any SendGrid call is made. The partial
 * unique index on (newsletter_id) WHERE status IN ('running','completed')
 * means a second concurrent/duplicate attempt fails here with a unique
 * violation instead of emailing subscribers twice.
 */
export async function startSend(
  newsletterId: number,
  triggeredBy: SendTrigger
): Promise<NewsletterSend | null> {
  try {
    const result = await getPool().query<NewsletterSend>(
      `INSERT INTO newsletter_sends (newsletter_id, status, triggered_by)
       VALUES ($1, 'running', $2) RETURNING *`,
      [newsletterId, triggeredBy]
    )
    return result.rows[0]
  } catch (err) {
    const pgErr = err as { code?: string }
    if (pgErr.code === '23505') {
      // Unique violation — a send for this newsletter is already running or completed.
      return null
    }
    throw err
  }
}

export async function completeSend(
  sendId: number,
  result: { status: 'completed' | 'failed'; sentCount: number; failedCount: number; errorMessage?: string | null; totalRecipients: number }
): Promise<void> {
  await getPool().query(
    `UPDATE newsletter_sends SET
       status = $2, sent_count = $3, failed_count = $4, error_message = $5,
       total_recipients = $6, completed_at = NOW()
     WHERE id = $1`,
    [sendId, result.status, result.sentCount, result.failedCount, result.errorMessage ?? null, result.totalRecipients]
  )
}

export async function recordSkippedSend(newsletterId: number, reason: string): Promise<void> {
  await getPool().query(
    `INSERT INTO newsletter_sends (newsletter_id, status, triggered_by, error_message, completed_at)
     VALUES ($1, 'skipped', 'cron', $2, NOW())`,
    [newsletterId, reason]
  )
}

export async function listSendsForNewsletter(newsletterId: number): Promise<NewsletterSend[]> {
  const result = await getPool().query<NewsletterSend>(
    `SELECT * FROM newsletter_sends WHERE newsletter_id = $1 ORDER BY started_at DESC`,
    [newsletterId]
  )
  return result.rows
}

export async function listRecentSends(limit = 20): Promise<(NewsletterSend & { subject: string; type: NewsletterType })[]> {
  const result = await getPool().query(
    `SELECT ns.*, n.subject, n.type FROM newsletter_sends ns
     JOIN newsletters n ON n.id = ns.newsletter_id
     ORDER BY ns.started_at DESC LIMIT $1`,
    [limit]
  )
  return result.rows
}
