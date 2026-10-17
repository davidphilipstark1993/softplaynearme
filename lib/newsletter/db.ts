import { getPool } from '@/lib/pool'
import type {
  Newsletter,
  NewsletterEventType,
  NewsletterItem,
  NewsletterSend,
  NewsletterStatus,
  NewsletterSubscriber,
  NewsletterType,
  SendTrigger,
} from './types'
import { isReadyForApproval, readinessHint } from './readiness'

// ─── Subscribers ────────────────────────────────────────────────────────────

export type SubscribeOutcome = 'confirmation_sent' | 'already_subscribed'

export interface SubscribeInput {
  email: string
  weeklyNewsletter: boolean
  eventsActivities: boolean
  source: string
}

/** Minimum gap between confirmation emails to one address, so the form can't be used to mail-bomb someone. */
const CONFIRMATION_COOLDOWN_MINUTES = 5
/** How long a confirmation link stays valid after it was sent. */
export const CONFIRMATION_TTL_DAYS = 7

/**
 * Double opt-in. Upserts by email so the same address never gets a second row,
 * but never switches a list on: the requested lists are parked in
 * pending_weekly / pending_events and only applied by confirmByToken() once
 * the address owner clicks the emailed link. Already-confirmed subscribers who
 * ask for an extra list go through the same confirmation.
 *
 * `sendConfirmation` tells the caller whether an email should go out now
 * (false when one was sent within the cooldown, or nothing new was requested).
 */
export async function subscribeEmail(
  input: SubscribeInput
): Promise<{ subscriber: NewsletterSubscriber; outcome: SubscribeOutcome; sendConfirmation: boolean }> {
  const email = input.email.trim().toLowerCase()
  const client = await getPool().connect()
  try {
    const existing = await client.query<NewsletterSubscriber>(
      `SELECT * FROM newsletter_subscribers WHERE email = $1`,
      [email]
    )

    if (existing.rows.length === 0) {
      const inserted = await client.query<NewsletterSubscriber>(
        `INSERT INTO newsletter_subscribers
           (email, weekly_newsletter, events_activities, pending_weekly, pending_events, source, status, confirmation_sent_at)
         VALUES ($1, false, false, $2, $3, $4, 'pending', NOW())
         RETURNING *`,
        [email, input.weeklyNewsletter, input.eventsActivities, input.source]
      )
      return { subscriber: inserted.rows[0], outcome: 'confirmation_sent', sendConfirmation: true }
    }

    const current = existing.rows[0]
    const alreadyHasEverythingRequested =
      current.status === 'subscribed' &&
      (!input.weeklyNewsletter || current.weekly_newsletter) &&
      (!input.eventsActivities || current.events_activities)

    if (alreadyHasEverythingRequested) {
      return { subscriber: current, outcome: 'already_subscribed', sendConfirmation: false }
    }

    const recentlySent =
      current.confirmation_sent_at != null &&
      Date.now() - new Date(current.confirmation_sent_at).getTime() < CONFIRMATION_COOLDOWN_MINUTES * 60 * 1000

    // Only the lists not already live are parked as pending. A fresh token is
    // issued whenever an email goes out, so older links stop working.
    const updated = await client.query<NewsletterSubscriber>(
      `UPDATE newsletter_subscribers SET
         pending_weekly = pending_weekly OR ($2 AND NOT weekly_newsletter),
         pending_events = pending_events OR ($3 AND NOT events_activities),
         status = CASE WHEN status = 'unsubscribed' THEN 'pending' ELSE status END,
         confirmation_token = CASE WHEN $4 THEN confirmation_token ELSE encode(gen_random_bytes(24), 'hex') END,
         confirmation_sent_at = CASE WHEN $4 THEN confirmation_sent_at ELSE NOW() END,
         updated_at = NOW()
       WHERE email = $1
       RETURNING *`,
      [email, input.weeklyNewsletter, input.eventsActivities, recentlySent]
    )
    return { subscriber: updated.rows[0], outcome: 'confirmation_sent', sendConfirmation: !recentlySent }
  } finally {
    client.release()
  }
}

/** Called when the confirmation email failed to send, so a retry isn't blocked by the cooldown. */
export async function resetConfirmationCooldown(email: string): Promise<void> {
  await getPool().query(
    `UPDATE newsletter_subscribers SET confirmation_sent_at = NULL WHERE email = $1 AND (status <> 'subscribed' OR pending_weekly OR pending_events)`,
    [email.trim().toLowerCase()]
  )
}

export type ConfirmResult =
  | { ok: true; subscriber: NewsletterSubscriber }
  | { ok: false; reason: 'invalid' | 'expired' }

/** Applies the pending list choices and marks the address confirmed. Idempotent for an already-confirmed link. */
export async function confirmByToken(token: string): Promise<ConfirmResult> {
  const client = await getPool().connect()
  try {
    const found = await client.query<NewsletterSubscriber>(
      `SELECT * FROM newsletter_subscribers WHERE confirmation_token = $1`,
      [token]
    )
    if (found.rows.length === 0) return { ok: false, reason: 'invalid' }
    const current = found.rows[0]

    const nothingPending = !current.pending_weekly && !current.pending_events
    if (nothingPending && current.status === 'subscribed') return { ok: true, subscriber: current }

    const sentAt = current.confirmation_sent_at ? new Date(current.confirmation_sent_at).getTime() : 0
    if (Date.now() - sentAt > CONFIRMATION_TTL_DAYS * 24 * 60 * 60 * 1000) return { ok: false, reason: 'expired' }

    const confirmed = await client.query<NewsletterSubscriber>(
      `UPDATE newsletter_subscribers SET
         weekly_newsletter = weekly_newsletter OR pending_weekly,
         events_activities = events_activities OR pending_events,
         pending_weekly = false,
         pending_events = false,
         status = 'subscribed',
         confirmed_at = COALESCE(confirmed_at, NOW()),
         subscribed_at = NOW(),
         unsubscribed_at = NULL,
         updated_at = NOW()
       WHERE confirmation_token = $1
       RETURNING *`,
      [token]
    )
    return { ok: true, subscriber: confirmed.rows[0] }
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
           pending_weekly = false, pending_events = false,
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
         pending_weekly = CASE WHEN $2 = 'weekly_newsletter' THEN false ELSE pending_weekly END,
         pending_events = CASE WHEN $2 = 'events_activities' THEN false ELSE pending_events END,
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
    unsynced: number
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'subscribed')::int AS total_subscribed,
      COUNT(*) FILTER (WHERE status = 'subscribed' AND weekly_newsletter)::int AS weekly_subscribed,
      COUNT(*) FILTER (WHERE status = 'subscribed' AND events_activities)::int AS events_subscribed,
      COUNT(*) FILTER (WHERE status = 'unsubscribed')::int AS total_unsubscribed,
      COUNT(*) FILTER (WHERE status = 'subscribed' AND NOT sendgrid_synced)::int AS unsynced
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

/** Public archive listing (/newsletter) — sent issues only, newest first. */
export async function listSentNewsletters(type?: NewsletterType): Promise<Newsletter[]> {
  const result = type
    ? await getPool().query<Newsletter>(`SELECT * FROM newsletters WHERE status = 'sent' AND type = $1 ORDER BY sent_at DESC LIMIT 100`, [type])
    : await getPool().query<Newsletter>(`SELECT * FROM newsletters WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 100`)
  return result.rows
}

export async function getNewsletterBySlug(slug: string): Promise<Newsletter | null> {
  const result = await getPool().query<Newsletter>(`SELECT * FROM newsletters WHERE slug = $1 AND status = 'sent'`, [slug])
  return result.rows[0] ?? null
}

export async function getNewsletter(id: number): Promise<Newsletter | null> {
  const result = await getPool().query<Newsletter>(`SELECT * FROM newsletters WHERE id = $1`, [id])
  return result.rows[0] ?? null
}

async function nextIssueNumber(): Promise<number> {
  const result = await getPool().query<{ max: number | null }>(`SELECT MAX(issue_number) AS max FROM newsletters`)
  return (result.rows[0]?.max ?? 0) + 1
}

export async function createNewsletter(input: {
  type: NewsletterType
  weekOf: string | null
  subject: string
}): Promise<Newsletter> {
  const issueNumber = await nextIssueNumber()
  const slug = `issue-${issueNumber}${input.weekOf ? `-${input.weekOf}` : ''}`
  const result = await getPool().query<Newsletter>(
    `INSERT INTO newsletters (type, week_of, subject, issue_number, slug, status)
     VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING *`,
    [input.type, input.weekOf, input.subject, issueNumber, slug]
  )
  return result.rows[0]
}

/**
 * Next Sunday (or today, if today is Sunday) as an ISO date — the weekly
 * newsletter always targets this date, so the admin UI and the Sunday send
 * job agree on which issue "this week" refers to.
 */
export function nextSunday(from = new Date()): string {
  const d = new Date(from)
  const day = d.getUTCDay()
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  d.setUTCDate(d.getUTCDate() + daysUntilSunday)
  return d.toISOString().slice(0, 10)
}

/**
 * Finds the draft/ready_for_review/approved weekly newsletter targeting the
 * upcoming Sunday, or creates one. This is "this week's newsletter" that the
 * admin editor and the Sunday send job both operate on — there is always
 * exactly one live weekly issue at a time, so there's nothing to remember to
 * create manually week to week.
 */
export async function getOrCreateThisWeeksNewsletter(): Promise<Newsletter> {
  const weekOf = nextSunday()
  const existing = await getPool().query<Newsletter>(
    `SELECT * FROM newsletters WHERE type = 'weekly' AND week_of = $1 AND status IN ('draft', 'ready_for_review', 'approved')`,
    [weekOf]
  )
  if (existing.rows[0]) return existing.rows[0]

  return createNewsletter({ type: 'weekly', weekOf, subject: "This week's family guide" })
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
  // Editing content after approval always requires re-confirming approval — see
  // recomputeNewsletterStatus. Re-fetch afterwards: the RETURNING row above is from
  // before the recompute's own status update, so returning it directly would hand
  // back a stale (still-'approved') status.
  if (!result.rows[0]) return null
  await recomputeNewsletterStatus(id)
  return getNewsletter(id)
}

/**
 * Recomputes a newsletter's status from its own items: 'ready_for_review' once
 * isReadyForApproval() passes for its type (weekly: exactly 5 approved venue
 * picks; events: any content, with venues approved), 'draft' otherwise.
 * Never sets 'approved' itself — only the explicit
 * approveForSending() action does that — so calling this after ANY content
 * change (add/edit/delete an item, edit subject/intro) always drops an
 * already-approved newsletter back down to ready_for_review/draft. A
 * last-minute edit can never sneak past re-confirmation of the send
 * approval. Leaves 'sent'/'failed' newsletters alone.
 */
export async function recomputeNewsletterStatus(newsletterId: number): Promise<{ approvedVenueCount: number; status: NewsletterStatus }> {
  const [newsletterResult, itemsResult] = await Promise.all([
    getPool().query<{ type: NewsletterType }>(`SELECT type FROM newsletters WHERE id = $1`, [newsletterId]),
    getPool().query<Pick<NewsletterItem, 'item_type' | 'approved'>>(
      `SELECT item_type, approved FROM newsletter_items WHERE newsletter_id = $1`,
      [newsletterId]
    ),
  ])
  const type = newsletterResult.rows[0]?.type ?? 'weekly'
  const items = itemsResult.rows
  const approvedVenueCount = items.filter((i) => i.item_type === 'venue' && i.approved).length
  const nextStatus: NewsletterStatus = isReadyForApproval(type, items) ? 'ready_for_review' : 'draft'

  await getPool().query(
    `UPDATE newsletters SET status = $2::varchar, updated_at = NOW()
     WHERE id = $1 AND status IN ('draft', 'ready_for_review', 'approved')`,
    [newsletterId, nextStatus]
  )

  return { approvedVenueCount, status: nextStatus }
}

export class NotReadyError extends Error {}

/**
 * The explicit, separate "sign off on sending" action — the Sunday job and
 * the admin "Send now" button both refuse to send anything that hasn't been
 * through this. Only reachable once recomputeNewsletterStatus has already
 * put the newsletter in 'ready_for_review'.
 */
export async function approveForSending(id: number, approvedBy: string): Promise<Newsletter> {
  // Recompute first so drafts created before the per-type readiness rule
  // (e.g. events emails stuck in 'draft') pick up their correct status.
  await recomputeNewsletterStatus(id)
  const newsletter = await getNewsletter(id)
  if (!newsletter) throw new Error('Newsletter not found')
  if (newsletter.status !== 'ready_for_review') {
    throw new NotReadyError(readinessHint(newsletter.type))
  }

  const result = await getPool().query<Newsletter>(
    `UPDATE newsletters SET status = 'approved', approved_at = NOW(), approved_by = $2, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, approvedBy]
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

export class DuplicateItemError extends Error {}

/**
 * Adding the same venue (or the same title) to one newsletter twice is
 * almost always a misclick, not intentional — block it up front rather than
 * silently sending a duplicated pick. Only checked within this newsletter's
 * own items, never against the wider venues table (that's a suggestion, not
 * a blocker — see the "possible match" pattern this is adapted from).
 */
export async function addNewsletterItem(
  newsletterId: number,
  item: NewItemInput
): Promise<NewsletterItem> {
  const dupe = await getPool().query(
    `SELECT id FROM newsletter_items WHERE newsletter_id = $1 AND (
       (venue_id IS NOT NULL AND venue_id = $2) OR lower(title) = lower($3)
     )`,
    [newsletterId, item.venueId ?? null, item.title]
  )
  if (dupe.rows.length > 0) {
    throw new DuplicateItemError(`"${item.title}" is already added to this newsletter`)
  }

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
  await recomputeNewsletterStatus(newsletterId)
  return result.rows[0]
}

/** Flips a venue item's individual approval — the per-item half of the "5/5 ready" gate. */
export async function toggleItemApproval(itemId: number): Promise<{ item: NewsletterItem; approvedVenueCount: number; status: NewsletterStatus }> {
  const result = await getPool().query<NewsletterItem>(
    `UPDATE newsletter_items SET approved = NOT approved WHERE id = $1 RETURNING *`,
    [itemId]
  )
  const item = result.rows[0]
  if (!item) throw new Error('Item not found')
  const { approvedVenueCount, status } = await recomputeNewsletterStatus(item.newsletter_id)
  return { item, approvedVenueCount, status }
}

/** A sent newsletter's items are a historical record and can no longer be edited. */
export async function deleteNewsletterItemIfEditable(itemId: number): Promise<{ ok: boolean; reason?: string }> {
  const result = await getPool().query<{ status: NewsletterStatus; newsletter_id: number }>(
    `SELECT n.status, ni.newsletter_id FROM newsletter_items ni JOIN newsletters n ON n.id = ni.newsletter_id WHERE ni.id = $1`,
    [itemId]
  )
  const row = result.rows[0]
  if (!row) return { ok: false, reason: 'Item not found' }
  if (row.status === 'sent') {
    return { ok: false, reason: 'A sent newsletter cannot be edited' }
  }
  await getPool().query(`DELETE FROM newsletter_items WHERE id = $1`, [itemId])
  await recomputeNewsletterStatus(row.newsletter_id)
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

// ─── SendGrid Marketing Contacts sync ──────────────────────────────────────
// Subscribing here always writes to newsletter_subscribers first (see
// subscribeEmail above) regardless of what happens with SendGrid — pushing a
// contact to SendGrid's own Marketing Contacts list is a secondary sync for
// suppression-group management and SendGrid-side visibility, tracked
// separately so a failed push can be retried without re-subscribing anyone.

export async function listUnsyncedSubscribers(): Promise<NewsletterSubscriber[]> {
  const result = await getPool().query<NewsletterSubscriber>(
    `SELECT * FROM newsletter_subscribers WHERE status = 'subscribed' AND sendgrid_synced = false`
  )
  return result.rows
}

export async function markSubscriberSynced(email: string, contactId: string): Promise<void> {
  await getPool().query(
    `UPDATE newsletter_subscribers SET sendgrid_synced = true, sendgrid_contact_id = $2, updated_at = NOW() WHERE email = $1`,
    [email.toLowerCase(), contactId]
  )
}

// ─── SendGrid webhook (unsubscribe/bounce sync-back + engagement) ─────────

const EVENT_STATUS: Partial<Record<NewsletterEventType, 'unsubscribed'>> = {
  unsubscribe: 'unsubscribed',
  group_unsubscribe: 'unsubscribed',
}

/**
 * Applies one SendGrid webhook event. A plain `unsubscribe` (the global
 * "block all mail" click) always sets status='unsubscribed' outright. A
 * `group_unsubscribe` is group-scoped — sendgridGroupId tells us which of
 * our two ASM groups (weekly/events) the recipient left, so only that list
 * is turned off, exactly like clicking our own scope-specific unsubscribe
 * link (see unsubscribeByToken) — someone leaving one list is never
 * silently unsubscribed from the other.
 */
export async function applySendGridEvent(
  email: string,
  eventType: NewsletterEventType,
  sendgridGroupId: number | null,
  groupIdToScope: (groupId: number) => UnsubscribeScope | null
): Promise<void> {
  const normalizedEmail = email.toLowerCase()

  if (eventType === 'bounce') {
    await getPool().query(`UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = NOW(), updated_at = NOW() WHERE email = $1`, [normalizedEmail])
    return
  }
  if (eventType === 'spamreport') {
    await getPool().query(`UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = NOW(), updated_at = NOW() WHERE email = $1`, [normalizedEmail])
    return
  }
  if (eventType === 'unsubscribe') {
    await getPool().query(`UPDATE newsletter_subscribers SET status = 'unsubscribed', weekly_newsletter = false, events_activities = false, unsubscribed_at = NOW(), updated_at = NOW() WHERE email = $1`, [normalizedEmail])
    return
  }
  if (eventType === 'group_unsubscribe' && sendgridGroupId != null) {
    const scope = groupIdToScope(sendgridGroupId)
    if (scope) {
      const subscriber = await getPool().query<NewsletterSubscriber>(`SELECT unsubscribe_token FROM newsletter_subscribers WHERE email = $1`, [normalizedEmail])
      if (subscriber.rows[0]) await unsubscribeByToken(subscriber.rows[0].unsubscribe_token, scope)
    }
  }
}

export async function recordNewsletterEvent(input: {
  newsletterId: number | null
  eventType: NewsletterEventType
  email: string
  url: string | null
  sendgridGroupId: number | null
}): Promise<void> {
  await getPool().query(
    `INSERT INTO newsletter_events (newsletter_id, event_type, email, url, sendgrid_group_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.newsletterId, input.eventType, input.email.toLowerCase(), input.url, input.sendgridGroupId]
  )
}
