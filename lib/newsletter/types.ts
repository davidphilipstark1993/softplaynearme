export type NewsletterType = 'weekly' | 'events'
export type NewsletterStatus = 'draft' | 'ready_for_review' | 'approved' | 'sent' | 'failed'
export type NewsletterItemType = 'venue' | 'event' | 'offer' | 'news' | 'link'
export type SendStatus = 'running' | 'completed' | 'failed' | 'skipped'
export type SendTrigger = 'cron' | 'manual'

export interface NewsletterSubscriber {
  id: number
  email: string
  weekly_newsletter: boolean
  events_activities: boolean
  status: 'pending' | 'subscribed' | 'unsubscribed'
  source: string | null
  unsubscribe_token: string
  confirmed_at: string | null
  confirmation_token: string
  confirmation_sent_at: string | null
  pending_weekly: boolean
  pending_events: boolean
  sendgrid_synced: boolean
  sendgrid_contact_id: string | null
  subscribed_at: string
  unsubscribed_at: string | null
  created_at: string
  updated_at: string
}

export interface Newsletter {
  id: number
  type: NewsletterType
  issue_number: number | null
  slug: string | null
  week_of: string | null
  subject: string
  intro_html: string | null
  status: NewsletterStatus
  scheduled_send_at: string | null
  approved_at: string | null
  approved_by: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface NewsletterItem {
  id: number
  newsletter_id: number
  item_type: NewsletterItemType
  venue_id: number | null
  title: string
  description: string | null
  url: string | null
  image_url: string | null
  city_slug: string | null
  event_date: string | null
  approved: boolean
  display_order: number
  created_at: string
  // Populated by a join when item_type === 'venue'
  venue_slug?: string | null
  venue_name?: string | null
}

export interface NewsletterSend {
  id: number
  newsletter_id: number
  status: SendStatus
  triggered_by: SendTrigger
  total_recipients: number
  sent_count: number
  failed_count: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export type NewsletterEventType = 'open' | 'click' | 'bounce' | 'unsubscribe' | 'group_unsubscribe' | 'spamreport'

export interface NewsletterEvent {
  id: number
  newsletter_id: number | null
  event_type: NewsletterEventType
  email: string
  url: string | null
  sendgrid_group_id: number | null
  created_at: string
}
