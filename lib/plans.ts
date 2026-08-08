export type Plan = 'free' | 'premium' | 'bespoke'
export type PlanStatus = 'inactive' | 'active' | 'trialing' | 'past_due' | 'cancelled'

export const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  premium: 'Premium',
  bespoke: 'Bespoke',
}

interface PlanFields {
  plan?: string | null
  plan_status?: string | null
  claimed_by_owner?: boolean | null
}

/** A plan is "live" when it's paid and the subscription is in an active-ish state. */
export function isPaidActive(venue: PlanFields): boolean {
  return venue.plan === 'premium' || venue.plan === 'bespoke'
    ? venue.plan_status === 'active' || venue.plan_status === 'trialing'
    : false
}

/** Verified badge: paid plan, currently active, and an owner has actually claimed it. */
export function isVerified(venue: PlanFields): boolean {
  return isPaidActive(venue) && !!venue.claimed_by_owner
}

/** Paid plans can only be granted to venues an owner has actually claimed. */
export function canUpgradeToPaid(venue: PlanFields): boolean {
  return !!venue.claimed_by_owner
}
