import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

/** Lazily constructed — importing this module must not throw when the key isn't set yet. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  if (!_stripe) {
    _stripe = new Stripe(key)
  }
  return _stripe
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.softplaynearme.co.uk'
const PREMIUM_MONTHLY_PENCE = 2499
const PREMIUM_ANNUAL_PENCE = 24900

export type BillingInterval = 'month' | 'year'

/**
 * Creates a Checkout Session in subscription mode, restricted to UK Bacs
 * Direct Debit. Completing it both collects the mandate and starts the
 * Premium subscription in one step — Stripe handles the mandate/PCI side
 * entirely on its own hosted page; we never see bank details.
 */
export async function createPremiumCheckoutSession(opts: {
  email: string
  venueName: string
  claimId: number
  accessToken: string
  interval?: BillingInterval
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  const configId = process.env.STRIPE_BACS_PAYMENT_METHOD_CONFIG_ID
  if (!configId) {
    throw new Error('STRIPE_BACS_PAYMENT_METHOD_CONFIG_ID is not set')
  }
  const interval: BillingInterval = opts.interval === 'year' ? 'year' : 'month'
  const unitAmount = interval === 'year' ? PREMIUM_ANNUAL_PENCE : PREMIUM_MONTHLY_PENCE
  const planLabel = interval === 'year' ? 'Premium (annual)' : 'Premium'

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    // Never hardcode payment_method_types — per Stripe's current guidance
    // that disables dynamic payment methods. Instead we point at a Payment
    // Method Configuration (created once via the API, see project notes)
    // that has only Bacs Direct Debit switched on, so this stays Direct
    // Debit-only without touching payment_method_types.
    payment_method_configuration: configId,
    // This account has Stripe's Managed Payments (merchant-of-record, global
    // tax handling) on by default, which is incompatible with
    // payment_method_configuration — it insists on picking payment methods
    // itself. We don't want Managed Payments here (it's a much bigger
    // product than a single-country GBP subscription needs), so it's
    // explicitly turned off for this session, as Stripe's own API error
    // instructs.
    managed_payments: { enabled: false },
    customer_email: opts.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: unitAmount,
          recurring: { interval },
          product_data: {
            name: `Soft Play Near Me ${planLabel} — ${opts.venueName}`.slice(0, 250),
          },
        },
      },
    ],
    metadata: {
      claim_id: String(opts.claimId),
      venue_name: opts.venueName.slice(0, 200),
      billing_interval: interval,
    },
    success_url: `${BASE_URL}/premium/success?token=${opts.accessToken}&interval=${interval}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/premium?cancelled=1`,
    // Dashboard label for tracking this checkout flow, per Stripe's current
    // API guidance — needs a random suffix to stay unique.
    integration_identifier: `softplaynearme_premium_${randomLetters(8)}`,
  })
}

/**
 * Opens Stripe's hosted Customer Portal for an existing subscriber to
 * manage payment details or cancel — no custom cancel/billing UI needed.
 */
export async function createBillingPortalSession(opts: {
  stripeCustomerId: string
  returnUrl: string
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe()
  return stripe.billingPortal.sessions.create({
    customer: opts.stripeCustomerId,
    return_url: opts.returnUrl,
  })
}

function randomLetters(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

/**
 * Verifies the `Stripe-Signature` header against the raw request body and
 * returns the parsed event. Must be called with the *raw* body string.
 * https://docs.stripe.com/webhooks#verify-events
 */
export function constructStripeWebhookEvent(
  rawBody: string,
  signatureHeader: string | null
): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !signatureHeader) return null
  try {
    return getStripe().webhooks.constructEvent(rawBody, signatureHeader, secret)
  } catch (err) {
    console.error('[stripe] Webhook signature verification failed:', err)
    return null
  }
}
