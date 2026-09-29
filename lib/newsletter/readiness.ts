import type { NewsletterItem, NewsletterType } from './types'

export const WEEKLY_VENUE_PICKS = 5

/**
 * The per-type rule for when a newsletter is ready to be approved for sending.
 * Shared by the server (recomputeNewsletterStatus) and the admin editor so the
 * button and the gate can never disagree.
 *
 * - weekly: exactly 5 individually-approved venue picks.
 * - events: at least one item, and any venue items in it individually approved.
 *   Events/offers/news/links have no per-item approval toggle, so requiring
 *   5 venue picks here made events emails impossible to approve.
 */
export function isReadyForApproval(
  type: NewsletterType,
  items: Pick<NewsletterItem, 'item_type' | 'approved'>[]
): boolean {
  const venues = items.filter((i) => i.item_type === 'venue')
  const approvedVenues = venues.filter((i) => i.approved).length
  if (type === 'weekly') return approvedVenues === WEEKLY_VENUE_PICKS
  return items.length > 0 && approvedVenues === venues.length
}

export function readinessHint(type: NewsletterType): string {
  return type === 'weekly'
    ? `Approve exactly ${WEEKLY_VENUE_PICKS} venue picks above to unlock Sunday sending.`
    : 'Add at least one item (and approve any featured venues) to unlock sending.'
}
